#!/usr/bin/env python3
"""共面/近共面深度竞争回归检查。

透视深度在 near=1 / far=2000 下，距离 z 处的可分辨世界间距约为
    dz = (far-near) * z^2 / (far * near * (2^24 - 1))
拉到 maxDistance=620 时约 2.3cm；因此任意两个大面积重叠的水平上表面
间距必须 >= 5cm（见 docs/2026-11-05-z-fighting-perf-fix.md）。

用法: python3 scripts/check-depth.py [url]
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "file:///Users/leerobbin/game/spax/model.html"
MIN_GAP = 0.05
MIN_OVERLAP_AREA = 100

PROBE = r"""() => {
  const m = window.__MODEL;
  const surf = [];
  m.scene.traverse(o => {
    if(!o.isMesh || o.isInstancedMesh || !o.geometry) return;
    const mat = o.material;
    if(mat && (mat.transparent || mat.depthWrite === false)) return;
    const g = o.geometry;
    if(!g.boundingBox) g.computeBoundingBox();
    const bb = g.boundingBox; if(!bb) return;
    let x0=Infinity, x1=-Infinity, y0=Infinity, y1=-Infinity, z0=Infinity, z1=-Infinity;
    for(const X of [bb.min.x, bb.max.x])
      for(const Y of [bb.min.y, bb.max.y])
        for(const Z of [bb.min.z, bb.max.z]){
          const v = o.position.clone().set(X, Y, Z).applyMatrix4(o.matrixWorld);
          x0=Math.min(x0,v.x); x1=Math.max(x1,v.x);
          y0=Math.min(y0,v.y); y1=Math.max(y1,v.y);
          z0=Math.min(z0,v.z); z1=Math.max(z1,v.z);
        }
    if((x1-x0) < 2 || (z1-z0) < 2) return;
    surf.push({ n:o.name || g.type, top:+y1.toFixed(3),
                x0:+x0.toFixed(1), x1:+x1.toFixed(1),
                z0:+z0.toFixed(1), z1:+z1.toFixed(1) });
  });

  const risks = [];
  for(let i=0; i<surf.length; i++) for(let j=i+1; j<surf.length; j++){
    const a = surf[i], b = surf[j];
    if(Math.abs(a.top - b.top) >= MIN_GAP) continue;
    const ow = Math.min(a.x1,b.x1) - Math.max(a.x0,b.x0);
    const od = Math.min(a.z1,b.z1) - Math.max(a.z0,b.z0);
    if(ow > 0.5 && od > 0.5 && ow*od > MIN_OVERLAP_AREA)
      risks.push({ gap:+Math.abs(a.top-b.top).toFixed(3),
                   area:Math.round(ow*od),
                   a:`${a.n}@${a.top}`, b:`${b.n}@${b.top}` });
  }
  return { surfaces: surf.length, risks };
}""".replace("MIN_GAP", str(MIN_GAP)).replace("MIN_OVERLAP_AREA", str(MIN_OVERLAP_AREA))


def depth_resolution(z, near=1, far=2000, bits=24):
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
    for z in (400, 600, 620):
        print(f"  dist={z}: 深度分辨率≈{depth_resolution(z)*100:.2f}cm")
    print(f"近共面风险对: {len(result['risks'])}")
    for r in result["risks"]:
        print(" ", r)
    if errors:
        print("page errors:", errors[:5])
    sys.exit(0 if not result["risks"] and not errors else 1)


if __name__ == "__main__":
    main()
