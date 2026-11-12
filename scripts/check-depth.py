#!/usr/bin/env python3
"""共面/近共面深度竞争回归检查。

透视深度在 near=1 / far=8000 下，距离 z 处的可分辨世界间距约为
    dz = (far-near) * z^2 / (far * near * (2^24 - 1))
拉到 maxDistance=1000 时约 6cm；因此任意两个大面积重叠的水平上表面
间距必须 >= 5cm（回归底线），新增几何建议 >= 10cm
（见 docs/2026-11-05-z-fighting-perf-fix.md）。

覆盖所有 Mesh（含 InstancedMesh 逐实例展开）；设了 polygonOffset 的贴花层
由深度偏移固定层级，透明/不写深度层沿用既有豁免。

用法: python3 scripts/check-depth.py [url]
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "file:///Users/leerobbin/game/spax/model.html"
MIN_GAP = 0.05
MIN_OVERLAP_AREA = 100

PROBE = r"""() => {
  const m = window.__MODEL;
  const Mat4 = m.camera.matrixWorld.constructor;
  const im = new Mat4(), wm = new Mat4();
  const surf = [];
  function collect(g, world, name){
    if(!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox; if(!bb) return;
    const e = world.elements;
    let x0=Infinity, x1=-Infinity, y1=-Infinity, z0=Infinity, z1=-Infinity;
    for(const X of [bb.min.x, bb.max.x])
      for(const Y of [bb.min.y, bb.max.y])
        for(const Z of [bb.min.z, bb.max.z]){
          const x = e[0]*X+e[4]*Y+e[8]*Z+e[12];
          const y = e[1]*X+e[5]*Y+e[9]*Z+e[13];
          const z = e[2]*X+e[6]*Y+e[10]*Z+e[14];
          if(x<x0)x0=x; if(x>x1)x1=x;
          if(y>y1)y1=y;
          if(z<z0)z0=z; if(z>z1)z1=z;
        }
    if((x1-x0) < 2 || (z1-z0) < 2) return;
    surf.push({ n:name, top:+y1.toFixed(3),
                x0:+x0.toFixed(1), x1:+x1.toFixed(1),
                z0:+z0.toFixed(1), z1:+z1.toFixed(1) });
  }
  m.scene.traverse(o => {
    if(!o.isMesh || !o.geometry) return;
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    /* polygonOffset 已固定深度层级；透明/不写深度的贴花层由偏移保证，
     * 但 InstancedMesh 必须纳入——上一轮新增的整片城市建筑全是实例化网格。 */
    if(mats.some(x => x.polygonOffset || x.transparent || x.depthWrite === false)) return;
    const name = o.name || o.geometry.type;
    if(o.isInstancedMesh){
      for(let i=0; i<o.count; i++){
        im.fromArray(o.instanceMatrix.array, i*16);
        wm.copy(o.matrixWorld).multiply(im);
        collect(o.geometry, wm, name);
      }
    }else collect(o.geometry, o.matrixWorld, name);
  });

  surf.sort((a,b) => a.top - b.top);
  const risks = [];
  for(let i=0; i<surf.length; i++){
    const a = surf[i];
    for(let j=i+1; j<surf.length && surf[j].top - a.top < MIN_GAP; j++){
      const b = surf[j];
      const ow = Math.min(a.x1,b.x1) - Math.max(a.x0,b.x0);
      const od = Math.min(a.z1,b.z1) - Math.max(a.z0,b.z0);
      if(ow > 0.5 && od > 0.5 && ow*od > MIN_OVERLAP_AREA)
        risks.push({ gap:+(b.top-a.top).toFixed(3),
                     area:Math.round(ow*od),
                     a:`${a.n}@${a.top}`, b:`${b.n}@${b.top}` });
    }
  }
  return { surfaces: surf.length, riskCount: risks.length, risks: risks.slice(0, 40) };
}""".replace("MIN_GAP", str(MIN_GAP)).replace("MIN_OVERLAP_AREA", str(MIN_OVERLAP_AREA))


def depth_resolution(z, near=1, far=8000, bits=24):
    return (far - near) * z * z / (far * near * (2 ** bits - 1))


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(channel="chrome", args=[
            "--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
            "--enable-unsafe-swiftshader"])
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_function("window.__MODEL && window.__MODEL.scene", timeout=60000)
        page.wait_for_timeout(2600)
        result = page.evaluate(PROBE)
        browser.close()

    print(f"扫描水平上表面 {result['surfaces']} 个，阈值 {MIN_GAP*100:.0f}cm / 重叠 >{MIN_OVERLAP_AREA}")
    for z in (400, 600, 1000):
        print(f"  dist={z}: 深度分辨率≈{depth_resolution(z)*100:.2f}cm")
    print(f"近共面风险对: {result['riskCount']}")
    for r in result["risks"]:
        print(" ", r)
    if errors:
        print("page errors:", errors[:5])
    sys.exit(0 if not result["riskCount"] and not errors else 1)


if __name__ == "__main__":
    main()
