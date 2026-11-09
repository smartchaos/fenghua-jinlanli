#!/usr/bin/env python3
"""在真实浏览器里验收 3D 场景的写实化效果。

用法: python3 scripts/check-realism.py [url]
"""
import sys
from playwright.sync_api import sync_playwright

URL = sys.argv[1] if len(sys.argv) > 1 else "http://127.0.0.1:5173/"

PROBE = r"""() => {
  const M = window.__MODEL;
  if (!M || !M.scene) return { ready: false };
  const scene = M.scene;
  let sun = null;
  scene.traverse(o => { if (o.isDirectionalLight && o.castShadow) sun = o; });
  const elevation = sun
    ? Math.atan2(sun.position.y, Math.hypot(sun.position.x, sun.position.z)) * 180 / Math.PI
    : 999;

  // 贴图细颗粒: 取纯色区域相邻像素差的平均绝对值; 平面填色接近 0
  const grain = (canvas, x, y, w, h) => {
    const d = canvas.getContext('2d').getImageData(x, y, w, h).data;
    let sum = 0, n = 0;
    for (let j = 0; j < h; j++) {
      for (let i = 0; i < w - 1; i++) {
        const a = (j * w + i) * 4, b = a + 4;
        sum += Math.abs(d[a] - d[b]) + Math.abs(d[a+1] - d[b+1]) + Math.abs(d[a+2] - d[b+2]);
        n += 3;
      }
    }
    return sum / n;
  };
  const minGrain = (canvas, points) =>
    Math.min(...points.map(([x, y]) => grain(canvas, x, y, 32, 32)));
  const facadePts = [[6,6],[6,320],[6,700],[992,6],[992,420],[992,820]];
  const groundPts = [[80,80],[640,260],[1200,520],[260,900],[980,1180],[1440,1500]];

  let facade = 0, ground = 0;
  scene.traverse(o => {
    const mats = Array.isArray(o.material) ? o.material : [o.material];
    for (const m of mats) {
      if (!m || !m.map || !m.map.image || !m.map.image.getContext) continue;
      const c = m.map.image;
      if (c.width === 1024 && c.height === 1024) facade = Math.max(facade, minGrain(c, facadePts));
      if (c.width === 1680 && c.height === 1960) ground = Math.max(ground, minGrain(c, groundPts));
    }
  });

  return {
    ready: true,
    envMap: !!scene.environment,
    sunElevationDeg: Math.round(elevation * 10) / 10,
    facadeGrain: Math.round(facade * 100) / 100,
    groundGrain: Math.round(ground * 100) / 100,
  };
}"""


def main():
    errors = []
    with sync_playwright() as p:
        browser = p.chromium.launch(
            channel="chrome",
            args=["--enable-webgl", "--use-gl=angle", "--use-angle=swiftshader",
                  "--enable-unsafe-swiftshader", "--disable-dev-shm-usage"],
        )
        page = browser.new_page(viewport={"width": 1440, "height": 900})
        page.on("pageerror", lambda e: errors.append(str(e)))
        page.on("response", lambda r: errors.append(f"HTTP {r.status} {r.url}")
                if r.status >= 400 and "favicon" not in r.url else None)
        page.on("console", lambda m: errors.append(m.text)
                if m.type == "error" and "Failed to load resource" not in m.text else None)
        page.goto(URL, wait_until="load", timeout=60000)
        page.wait_for_function("window.__MODEL && window.__MODEL.scene", timeout=60000)
        page.wait_for_timeout(2500)
        result = page.evaluate(PROBE)
        browser.close()

    print("scene probe:", result)
    checks = {
        "场景已初始化": result["ready"],
        "存在环境反射贴图": result["envMap"],
        "日光为低角度(<=40°)": result["sunElevationDeg"] <= 40,
        "立面有材质颗粒(>=1)": result["facadeGrain"] >= 1,
        "地面有材质颗粒(>=1)": result["groundGrain"] >= 1,
        "无 JS 报错": not errors,
    }
    for name, ok in checks.items():
        print(("PASS " if ok else "FAIL ") + name)
    if errors:
        print("console errors:", errors[:5])
    sys.exit(0 if all(checks.values()) else 1)


if __name__ == "__main__":
    main()
