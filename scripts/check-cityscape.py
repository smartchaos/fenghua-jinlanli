#!/usr/bin/env python3
"""浏览器内验收周边城市生成器。用法: python3 scripts/check-cityscape.py [url]"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173/"

PROBE = r"""async () => {
  const c = window.__MODEL && window.__MODEL.cityscape;
  if (!c || !c.stats) return { ready: false };
  const s = c.stats;
  const hills = [[330,-350,120],[450,150,140],[300,470,130],
                 [-95,590,150],[-660,-640,170],[560,480,130]];
  const mtns = [[-805,-575,260],[288,-874,300],[805,-483,240],[897,230,260],
                [575,782,280],[-518,874,300],[-909,345,260]];
  const disc = (x,z,cx,cz,r) => Math.hypot(x-cx,z-cz) < r;
  const forbidden = (x,z) =>
    (Math.abs(x) < 140 && Math.abs(z) < 210) ||
    (x > -460 && x < -240) ||
    Math.abs(x - 110) < 25 ||
    Math.abs(z - 150) < 25 ||
    Math.abs(z + 161) < 28 ||
    hills.some(h => disc(x,z,h[0],h[1],h[2])) ||
    mtns.some(m => disc(x,z,m[0],m[1],m[2]));

  let instanced = 0, textured = 0;
  c.group.traverse(o => {
    if(o.isInstancedMesh){ instanced++; if(o.material.map && o.material.map.image) textured++; }
  });
  const named = o => c.group.getObjectByName(o);
  const roads = named('city-roads');
  const green = named('city-green');
  const viaduct = named('city-viaduct');
  const silhouette = named('city-silhouette');
  const planeYs = [];
  c.group.traverse(o => { if(o.isMesh && o.geometry && o.geometry.type === 'PlaneGeometry')
    planeYs.push(Math.round(o.position.y * 100) / 100); });

  /* 建筑占地包围盒不得与实体道路/河道相交；坐标取自场景实际几何 */
  const bands = [
    [-440, -230, -900, 900],   // 运河 + 驳岸 + 滨河绿带
    [-900, 900, -185, -138],   // 电厂河
    [-900, 900, 138, 162],     // 南路 / 朱家坝路 + 斜拉桥桥面
    [98, 122, -900, 900],      // 顾扬路 / 东路
    [-750, 750, -308, -292],   // 高架桥面
  ];
  const roadWaterHits = s.instances.filter(i => bands.some(b =>
    i.x - i.w/2 < b[1] && i.x + i.w/2 > b[0] &&
    i.z - i.d/2 < b[3] && i.z + i.d/2 > b[2])).length;

  const west = s.instances.filter(i => i.group === 'west');
  const westInBox = west.every(i => i.x > -235 && i.x < -145 && i.z > -125 && i.z < 125);
  const westIntruders = s.instances.filter(i => i.group !== 'west' &&
    i.x > -235 && i.x < -145 && i.z > -125 && i.z < 125).length;

  const m = window.__MODEL;
  const firstMesh = c.group.children.find(o => o.isInstancedMesh);
  m.applyTheme(true, true);
  const day = firstMesh ? firstMesh.material.map : null;
  m.applyTheme(false, true);
  const night = firstMesh ? firstMesh.material.map : null;
  m.applyTheme(true, true);

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
    bad: s.instances.filter(i => forbidden(i.x, i.z)).length,
    byType: s.byType,
    instanced,
    textured,
    themeSwitches: day !== night && day !== null && night !== null,
    roadsAbsent: !roads,
    greenY: green ? Math.round(green.position.y * 100) / 100 : null,
    viaductY: viaduct ? Math.round(viaduct.position.y * 100) / 100 : null,
    silhouette: silhouette ? silhouette.count : 0,
    forbiddenYs: planeYs.filter(y => [0, 0.02, 0.06, 1.8, 3.0].includes(y)),
    drawDelta: delta,
    idleRenders: idle,
    roadWaterHits,
    westCount: west.length,
    westInBox,
    westIntruders,
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
    print("city probe:", result)
    checks = {
        "城市生成器已装配": result.get("ready") is True,
        "至少 80 栋落位": result.get("placed", 0) >= 80,
        "禁建区零命中": result.get("bad", 999) == 0,
        "无 JS 报错": not errors,
        "四类楼型齐备": all(result.get("byType", {}).get(k, 0) > 0
                         for k in ("slab", "tower", "podium", "landmark")),
        "至少 4 个 InstancedMesh": result.get("instanced", 0) >= 4,
        "楼体材质带贴图": result.get("textured", 0) >= 4,
        "日夜切换更换贴图": result.get("themeSwitches") is True,
        "无地块分割线且绿化在 y=-0.30": result.get("roadsAbsent") is True
                                       and result.get("greenY") == -0.30,
        "高架在 y≈8": result.get("viaductY") is not None and abs(result["viaductY"] - 8) < 0.5,
        "远景剪影存在": result.get("silhouette", 0) > 0,
        "无既有共面 y 值": result.get("forbiddenYs") == [],
        "draw call 增量 ≤20": result.get("drawDelta", 999) <= 20,
        "闲置零渲染": result.get("idleRenders", 999) == 0,
        "西侧组团至少 8 栋": result.get("westCount", 0) >= 8,
        "西侧组团都在地块内": result.get("westInBox") is True,
        "西侧地块无其他楼群": result.get("westIntruders", 999) == 0,
        "建筑不压道路/河道": result.get("roadWaterHits", 999) == 0,
    }
    for name, ok in checks.items():
        print(("PASS " if ok else "FAIL ") + name)
    if errors:
        print("errors:", errors[:5])
    sys.exit(0 if all(checks.values()) else 1)


if __name__ == "__main__":
    main()
