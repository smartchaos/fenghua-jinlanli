#!/usr/bin/env python3
"""浏览器内验收周边城市生成器。用法: python3 scripts/check-cityscape.py [url]"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173/"

PROBE = r"""async () => {
  const c = window.__MODEL && window.__MODEL.cityscape;
  if (!c || !c.stats) return { ready: false };
  const s = c.stats;
  const S = s.surroundings;
  const canal = S.meta.canal;
  const segDist = (x,z,x0,z0,x1,z1) => {
    const vx = x1-x0, vz = z1-z0, L2 = vx*vx+vz*vz;
    const t = L2 ? Math.max(0, Math.min(1, ((x-x0)*vx+(z-z0)*vz)/L2)) : 0;
    return Math.hypot(x-(x0+t*vx), z-(z0+t*vz));
  };
  const inPoly = (x,z,poly) => {
    let inside = false;
    for(let i=0,j=poly.length-1;i<poly.length;j=i++){
      const [xi,zi]=poly[i],[xj,zj]=poly[j];
      if((zi>z)!==(zj>z) && x < (xj-xi)*(z-zi)/(zj-zi)+xi) inside = !inside;
    }
    return inside;
  };
  const forbidden = (x,z) =>
    (Math.abs(x) < 140 && Math.abs(z) < 210) ||
    (Math.abs(x - canal.center) < canal.width/2 + 40) ||
    (Math.abs(z - s.viaductZ) < 26) ||
    S.compounds.some(cp => inPoly(x,z,cp.poly)) ||
    (S.greenZones||[]).some(g => inPoly(x,z,g.poly)) ||
    (S.clearZones||[]).some(g => inPoly(x,z,g.poly)) ||
    (S.powerPlant && inPoly(x,z,S.powerPlant.poly)) ||
    S.roads.some(r => segDist(x,z,r.x0,r.z0,r.x1,r.z1) < r.w/2 + 8) ||
    S.waters.some(w => segDist(x,z,w.x0,w.z0,w.x1,w.z1) < w.w/2 + 8);
  const bad = s.instances.filter(i => !i.real && forbidden(i.x,i.z)).length;
  const nearRoad = (i) =>
    S.roads.concat(S.waters).some(r => segDist(i.x,i.z,r.x0,r.z0,r.x1,r.z1) < r.w/2 + Math.max(i.w,i.d)/2) ||
    Math.abs(i.x - canal.center) < canal.width/2 + Math.max(i.w,i.d)/2;
  const roadWaterHits = s.instances.filter(nearRoad).length;
  const realInSite = s.instances.filter(i => i.real && Math.abs(i.x) < 140 && Math.abs(i.z) < 210).length;

  const m = window.__MODEL;
  const canalMesh = m.scene.getObjectByName('canal-water');
  const meadow = m.scene.getObjectByName('meadow');
  const named = o => c.group.getObjectByName(o);
  const green = named('city-green');
  const viaduct = named('city-viaduct');
  const deck = named('city-viaduct-deck');
  const silhouette = named('city-silhouette');
  const realMesh = named('city-real');
  const roadsMesh = named('city-real-roads');
  const planeYs = [];
  c.group.traverse(o => { if(o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry')
    planeYs.push(Math.round(o.position.y * 100) / 100); });

  const texMesh = c.group.children.find(o => o.isInstancedMesh && o.material && o.material.map);
  m.applyTheme(true, true);
  const day = texMesh ? texMesh.material.map : null;
  m.applyTheme(false, true);
  const night = texMesh ? texMesh.material.map : null;
  m.applyTheme(true, true);

  let instanced = 0, textured = 0;
  c.group.traverse(o => {
    if(o.isInstancedMesh){ instanced++; if(o.material.map && o.material.map.image) textured++; }
  });

  m.renderer.render(m.scene, m.camera);
  const withCity = m.renderer.info.render.calls;
  c.group.visible = false;
  m.renderer.render(m.scene, m.camera);
  const without = m.renderer.info.render.calls;
  c.group.visible = true;
  const delta = withCity - without;

  m.applyTheme(true, true);
  await new Promise(r => setTimeout(r, 2500));
  let idle = 0;
  const origRender = m.renderer.render.bind(m.renderer);
  m.renderer.render = (...a) => { idle++; return origRender(...a); };
  await new Promise(r => setTimeout(r, 1200));
  m.renderer.render = origRender;

  return {
    ready: true,
    placed: s.placed,
    rejected: s.rejected,
    bad,
    byType: s.byType,
    instanced,
    textured,
    themeSwitches: day !== night && day !== null && night !== null,
    roadsAbsent: !named('city-roads'),
    greenY: green ? Math.round(green.position.y * 100) / 100 : null,
    viaductY: viaduct ? Math.round(viaduct.position.y * 100) / 100 : null,
    deckZ: deck ? Math.round(deck.position.z) : null,
    silhouette: silhouette ? silhouette.count : 0,
    forbiddenYs: planeYs.filter(y => [0, 0.02, 0.06, 1.8, 3.0].includes(y)),
    drawDelta: delta,
    idleRenders: idle,
    roadWaterHits,
    realInSite,
    realCount: s.real ? s.real.count : 0,
    realCompounds: s.real ? s.real.compounds : [],
    realMeshCount: realMesh ? realMesh.count : 0,
    roadsMesh: !!roadsMesh,
    canalX: canalMesh ? Math.round(canalMesh.position.x) : null,
    meadowW: meadow ? Math.round(meadow.geometry.parameters.width) : null,
    fogFar: Math.round(m.scene.fog.far),
    cameraFar: Math.round(m.camera.far),
    maxDistance: Math.round(m.controls.maxDistance),
    extent: s.extent,
    plant: s.plant,
    plantMesh: !!named('plant-halls') && !!named('plant-cyl'),
  };
}"""


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=[
            "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader", "--disable-dev-shm-usage",
            "--disable-background-timer-throttling", "--disable-renderer-backgrounding",
            "--disable-backgrounding-occluded-windows"])
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("console", lambda m: errors.append(m.text)
                if m.type == "error" and "Failed to load resource" not in m.text else None)
        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_function("window.__MODEL && window.__MODEL.scene", timeout=60000)
        page.wait_for_timeout(2600)
        result = page.evaluate(PROBE)
        browser.close()
    print("city probe:", {k: v for k, v in result.items() if k != "realCompounds"})
    comps = result.get("realCompounds") or []
    print("real compounds:", [(c["name"], c["count"]) for c in comps])
    names = {c["name"] for c in comps}
    checks = {
        "城市生成器已装配": result.get("ready") is True,
        "至少 500 栋落位": result.get("placed", 0) >= 500,
        "禁建区零命中": result.get("bad", 999) == 0,
        "无 JS 报错": not errors,
        "四类楼型齐备": all(result.get("byType", {}).get(k, 0) > 0
                         for k in ("slab", "tower", "podium", "landmark")),
        "8 个真实小区": len(comps) == 8,
        "真实小区楼栋 ≥95": result.get("realCount", 0) >= 95,
        "关键小区齐备": {"潮和阅江台轩", "月上锦澜府", "宸岸栖月轩", "绿城汀岸印月", "运晓花望府"} <= names,
        "半山电厂已还原": (result.get("plant") or {}).get("halls", 0) == 7
                            and (result.get("plant") or {}).get("towers", 0) == 8
                            and result.get("plantMesh") is True,
        "真实楼群独立实例化": result.get("realMeshCount", 0) == result.get("realCount", -1),
        "真实路网已生成": result.get("roadsMesh") is True,
        "真实楼不压小区本体": result.get("realInSite", 999) == 0,
        "至少 4 个 InstancedMesh": result.get("instanced", 0) >= 4,
        "楼体材质带贴图": result.get("textured", 0) >= 4,
        "日夜切换更换贴图": result.get("themeSwitches") is True,
        "无地块分割线且绿化在 y=-0.30": result.get("roadsAbsent") is True
                                       and result.get("greenY") == -0.30,
        "高架 y≈8 且在南侧远景": result.get("viaductY") is not None
                                  and abs(result["viaductY"] - 8) < 0.5
                                  and result.get("deckZ") == 1950,
        "远景剪影存在": result.get("silhouette", 0) > 0,
        "无既有共面 y 值": result.get("forbiddenYs") == [],
        "draw call 增量 ≤20": result.get("drawDelta", 999) <= 20,
        "闲置零渲染": result.get("idleRenders", 999) == 0,
        "运河在 x≈-1000": result.get("canalX") is not None and abs(result["canalX"] + 1000) <= 15,
        "地面扩到 ≥5000": result.get("meadowW", 0) >= 5000,
        "雾/相机已扩展": result.get("fogFar", 0) >= 2000
                          and result.get("cameraFar", 0) >= 8000
                          and result.get("maxDistance", 0) >= 900,
        "建筑不压道路/河道": result.get("roadWaterHits", 999) == 0,
    }
    for name, ok in checks.items():
        print(("PASS " if ok else "FAIL ") + name)
    if errors:
        print("errors:", errors[:5])
    sys.exit(0 if all(checks.values()) else 1)


if __name__ == "__main__":
    main()
