#!/usr/bin/env python3
"""高德瓦片拼接 + 周边布局校准预览/校验。

用法:
  python3 scripts/map-calibrate.py stitch    # 生成 ref/amap-sat-site.jpg / ref/amap-road-site.jpg
  python3 scripts/map-calibrate.py preview   # 把 surroundings.json 叠到卫星图上, 存 shots/surroundings-calibration.jpg
  python3 scripts/map-calibrate.py check     # 校验数据: 越界/压路压水/压小区/重叠/计数
"""
import io
import json
import math
import os
import sys
import urllib.request

from PIL import Image, ImageDraw

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
REF = os.path.join(ROOT, "ref")
DATA = os.path.join(ROOT, "app/src/three/surroundings.json")
SHOTS = os.path.join(ROOT, "shots")

# 105 地块中心（WGS-84）: 顾扬路以西、朱家坝路以北、电厂河以南
ANCHOR_WGS = (120.1351, 30.36415)
Z = 17
SPAN = 11  # 11x11 瓦片 ≈ 2.9km
TILE = 256

PI = math.pi
A = 6378245.0
EE = 0.00669342162296594323


def _tf_lat(x, y):
    r = -100 + 2 * x + 3 * y + 0.2 * y * y + 0.1 * x * y + 0.2 * math.sqrt(abs(x))
    r += (20 * math.sin(6 * x * PI) + 20 * math.sin(2 * x * PI)) * 2 / 3
    r += (20 * math.sin(y * PI) + 40 * math.sin(y / 3 * PI)) * 2 / 3
    r += (160 * math.sin(y / 12 * PI) + 320 * math.sin(y * PI / 30)) * 2 / 3
    return r


def _tf_lng(x, y):
    r = 300 + x + 2 * y + 0.1 * x * x + 0.1 * x * y + 0.1 * math.sqrt(abs(x))
    r += (20 * math.sin(6 * x * PI) + 20 * math.sin(2 * x * PI)) * 2 / 3
    r += (20 * math.sin(x * PI) + 40 * math.sin(x / 3 * PI)) * 2 / 3
    r += (150 * math.sin(x / 12 * PI) + 300 * math.sin(x / 30 * PI)) * 2 / 3
    return r


def wgs2gcj(lng, lat):
    dlat = _tf_lat(lng - 105, lat - 35)
    dlng = _tf_lng(lng - 105, lat - 35)
    rl = lat / 180 * PI
    m = math.sin(rl)
    m = 1 - EE * m * m
    sm = math.sqrt(m)
    dlat = (dlat * 180) / ((A * (1 - EE)) / (m * sm) * PI)
    dlng = (dlng * 180) / (A / sm * math.cos(rl) * PI)
    return lng + dlng, lat + dlat


ANCHOR_GCJ = wgs2gcj(*ANCHOR_WGS)
MPP = 40075016.68557849 * math.cos(math.radians(ANCHOR_GCJ[1])) / (2 ** Z) / TILE


def anchor_px():
    """锚点在拼图里的像素坐标（瓦片按 int(tile) 对齐, 不是图像正中心）"""
    lng, lat = ANCHOR_GCJ
    n = 2 ** Z
    fx = (lng + 180) / 360 * n
    fy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / PI) / 2 * n
    half = SPAN // 2
    return (fx - (int(fx) - half)) * TILE, (fy - (int(fy) - half)) * TILE


ANCHOR_PX = anchor_px()


def scene_to_px(x, z):
    return ANCHOR_PX[0] + x / MPP, ANCHOR_PX[1] + z / MPP


def fetch(url):
    req = urllib.request.Request(
        url, headers={"User-Agent": "Mozilla/5.0", "Referer": "https://www.amap.com/"}
    )
    with urllib.request.urlopen(req, timeout=25) as r:
        return Image.open(io.BytesIO(r.read())).convert("RGB")


def stitch(style, out_path):
    lng, lat = ANCHOR_GCJ
    n = 2 ** Z
    fx = (lng + 180) / 360 * n
    fy = (1 - math.log(math.tan(math.radians(lat)) + 1 / math.cos(math.radians(lat))) / PI) / 2 * n
    cx, cy = int(fx), int(fy)
    half = SPAN // 2
    out = Image.new("RGB", (SPAN * TILE, SPAN * TILE))
    for j in range(SPAN):
        for i in range(SPAN):
            x, y = cx - half + i, cy - half + j
            url = (
                f"https://webst0{(abs(x + y) % 4) + 1}.is.autonavi.com/appmaptile"
                f"?style={style}&x={x}&y={y}&z={Z}"
            )
            try:
                out.paste(fetch(url), (i * TILE, j * TILE))
            except Exception as exc:  # 网络失败时保留品红块, 方便看出缺口
                print(f"  tile {x},{y} failed: {exc}")
                out.paste(Image.new("RGB", (TILE, TILE), (255, 0, 255)), (i * TILE, j * TILE))
    os.makedirs(os.path.dirname(out_path), exist_ok=True)
    out.save(out_path, quality=90)
    print(f"saved {out_path}  {out.size}  {MPP:.3f} m/px")


def load_data():
    with open(DATA, encoding="utf-8") as f:
        return json.load(f)


def rot_rect(x, z, w, d, deg):
    a = math.radians(deg)
    c, s = math.cos(a), math.sin(a)
    pts = []
    for dx, dz in ((-w / 2, -d / 2), (w / 2, -d / 2), (w / 2, d / 2), (-w / 2, d / 2)):
        pts.append((x + dx * c - dz * s, z + dx * s + dz * c))
    return pts


def point_in_poly(x, z, poly):
    inside = False
    for i in range(len(poly)):
        x1, z1 = poly[i]
        x2, z2 = poly[(i + 1) % len(poly)]
        if (z1 > z) != (z2 > z) and x < (x2 - x1) * (z - z1) / (z2 - z1) + x1:
            inside = not inside
    return inside


def road_dist(x, z, road):
    x0, z0, x1, z1 = road["x0"], road["z0"], road["x1"], road["z1"]
    vx, vz = x1 - x0, z1 - z0
    L2 = vx * vx + vz * vz
    t = 0 if L2 == 0 else max(0, min(1, ((x - x0) * vx + (z - z0) * vz) / L2))
    return math.hypot(x - (x0 + t * vx), z - (z0 + t * vz))


def preview():
    ref = os.path.join(REF, "amap-sat-site.jpg")
    im = Image.open(ref).convert("RGB")
    d = ImageDraw.Draw(im, "RGBA")
    data = load_data()
    # 500m 网格
    for v in range(-2000, 2001, 500):
        for a, b in (((v, -2000), (v, 2000)), ((-2000, v), (2000, v))):
            p, q = scene_to_px(*a), scene_to_px(*b)
            d.line([p, q], fill=(255, 255, 255, 60), width=1)
            d.text((p[0] + 2, p[1] + 2), str(v), fill=(255, 255, 255, 160))
    # 运河带
    canal = data["meta"]["canal"]
    x0, x1 = canal["center"] - canal["width"] / 2, canal["center"] + canal["width"] / 2
    p, q = scene_to_px(x0, -2000), scene_to_px(x1, 2000)
    d.rectangle([p[0], p[1], q[0], q[1]], outline=(80, 160, 255, 220), width=3, fill=(80, 160, 255, 40))
    # 道路
    for road in data.get("roads", []):
        p = scene_to_px(road["x0"], road["z0"])
        q = scene_to_px(road["x1"], road["z1"])
        wpx = max(2, road["w"] / MPP)
        d.line([p, q], fill=(255, 80, 80, 200), width=int(wpx))
    # 空地/绿地（不建楼）
    for key, col in (("clearZones", (255, 150, 40, 200)), ("greenZones", (120, 255, 120, 160))):
        for g in data.get(key, []):
            poly = [scene_to_px(*pt) for pt in g["poly"]]
            d.polygon(poly, outline=col)
            d.text((poly[0][0] + 3, poly[0][1] + 3), g["name"], fill=col)
    # 电厂
    plant = data.get("powerPlant")
    if plant:
        poly = [scene_to_px(*pt) for pt in plant["poly"]]
        d.polygon(poly, outline=(230, 120, 255, 230))
        d.text((poly[0][0] + 3, poly[0][1] + 3), plant["name"], fill=(230, 120, 255, 255))
        for h in plant.get("halls", []):
            pts = [scene_to_px(*pt) for pt in rot_rect(h["x"], h["z"], h["w"], h["d"], h.get("rot", 0))]
            d.polygon(pts, outline=(255, 90, 200, 255), fill=(255, 90, 200, 60))
        for t in plant.get("towers", []) + plant.get("tanks", []):
            p = scene_to_px(t["x"], t["z"])
            d.ellipse([p[0]-9, p[1]-9, p[0]+9, p[1]+9], outline=(255, 90, 200, 255))
        bg = plant.get("bagua")
        if bg:
            p = scene_to_px(bg["x"], bg["z"]); r = bg["r"] / MPP
            d.ellipse([p[0]-r, p[1]-r, p[0]+r, p[1]+r], outline=(230, 120, 255, 255))
        st = plant.get("stadium")
        if st:
            p = scene_to_px(st["x"], st["z"])
            d.ellipse([p[0]-st["rx"]/MPP, p[1]-st["rz"]/MPP, p[0]+st["rx"]/MPP, p[1]+st["rz"]/MPP], outline=(230, 120, 255, 255))
    # 小区与楼栋
    for comp in data.get("compounds", []):
        poly = [scene_to_px(*pt) for pt in comp["poly"]]
        d.polygon(poly, outline=(255, 220, 60, 255))
        for b in comp.get("buildings", []):
            pts = [scene_to_px(*pt) for pt in rot_rect(b["x"], b["z"], b["w"], b["d"], b.get("rot", 0))]
            d.polygon(pts, outline=(0, 255, 255, 255), fill=(0, 255, 255, 70))
        if poly:
            d.text((poly[0][0] + 3, poly[0][1] + 3), comp["name"], fill=(255, 255, 0, 255))
    # 小区本体
    p, q = scene_to_px(-120, -180), scene_to_px(120, 180)
    d.rectangle([p[0], p[1], q[0], q[1]], outline=(0, 255, 120, 230), width=3)
    os.makedirs(SHOTS, exist_ok=True)
    out = os.path.join(SHOTS, "surroundings-calibration.jpg")
    im.save(out, quality=90)
    print(f"saved {out}")


def check():
    data = load_data()
    errors = []
    meta = data["meta"]
    extent = meta["extent"]
    canal = meta["canal"]
    roads = data.get("roads", [])
    water = data.get("waters", [])
    comps = data.get("compounds", [])
    kinds = {}
    total = 0
    for comp in comps:
        poly = comp["poly"]
        for b in comp["buildings"]:
            total += 1
            kinds[comp["kind"]] = kinds.get(comp["kind"], 0) + 1
            name = f'{comp["name"]}/{b.get("tag", "")}'
            if abs(b["x"]) + b["w"] / 2 > extent or abs(b["z"]) + b["d"] / 2 > extent:
                errors.append(f"{name} 越界 {b['x']},{b['z']}")
            if not point_in_poly(b["x"], b["z"], poly):
                errors.append(f"{name} 不在小区轮廓内")
            if abs(b["x"]) < 140 and abs(b["z"]) < 210:
                errors.append(f"{name} 压到小区本体")
            for road in roads + water:
                margin = road["w"] / 2 + max(b["w"], b["d"]) / 2 + 6
                if road_dist(b["x"], b["z"], road) < margin:
                    errors.append(f"{name} 压到 {road.get('name', '道路')}")
            if abs(b["x"] - canal["center"]) < canal["width"] / 2 + 30:
                errors.append(f"{name} 压到运河")
            for g in data.get("clearZones", []) + data.get("greenZones", []):
                if point_in_poly(b["x"], b["z"], g["poly"]):
                    errors.append(f"{name} 落在 {g['name']} 内")
            plant = data.get("powerPlant")
            if plant and point_in_poly(b["x"], b["z"], plant["poly"]):
                errors.append(f"{name} 落在 {plant['name']} 内")
    # 楼栋重叠（同小区允许相邻，跨小区检查）
    boxes = []
    for ci, comp in enumerate(comps):
        for b in comp["buildings"]:
            boxes.append((ci, comp["name"], b))
    for i in range(len(boxes)):
        for j in range(i + 1, len(boxes)):
            ci, ni, a = boxes[i]
            cj, nj, b = boxes[j]
            if ci == cj:
                continue
            if math.hypot(a["x"] - b["x"], a["z"] - b["z"]) < max(a["w"], a["d"]) / 2 + max(b["w"], b["d"]) / 2 - 4:
                errors.append(f"{ni}/{nj} 楼栋过近")
    for comp in comps:
        if not comp.get("buildings"):
            errors.append(f'{comp["name"]} 没有楼栋')
    print(f"compounds={len(comps)} buildings={total} kinds={kinds}")
    for comp in comps:
        fs = sorted({b["f"] for b in comp["buildings"]})
        print(f'  {comp["name"]:<10} {len(comp["buildings"]):>3} 栋  {comp["kind"]:<4} 层数 {fs}')
    if errors:
        print(f"FAIL {len(errors)} 项")
        for e in errors[:30]:
            print("  -", e)
        sys.exit(1)
    print("PASS 数据校验通过")


def main():
    cmd = sys.argv[1] if len(sys.argv) > 1 else "check"
    if cmd in ("stitch", "all"):
        stitch(6, os.path.join(REF, "amap-sat-site.jpg"))
        stitch(7, os.path.join(REF, "amap-road-site.jpg"))
    if cmd in ("preview", "all"):
        preview()
    if cmd in ("check", "all"):
        check()


if __name__ == "__main__":
    main()
