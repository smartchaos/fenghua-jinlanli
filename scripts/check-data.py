#!/usr/bin/env python3
"""数据门禁：校验解析产物自洽、快照口径、发布页与数据同步，并自动列出需人工确认的可疑户。

    python3 scripts/parse.py && python3 scripts/check-data.py

退出码 0 = 通过（可能带 WARN）；1 = 存在 ERROR。想连 WARN 也拦下就加 --strict。
"""
import csv
import json
import re
import subprocess
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import parse as P  # noqa: E402

ROOT, DATA, RAW = P.ROOT, P.DATA, P.RAW
STRICT = "--strict" in sys.argv
LIST = "--list" in sys.argv
errors, warns, infos, fixes = [], [], [], []


def err(msg):
    errors.append(msg)


def warn(msg):
    warns.append(msg)


def info(msg):
    infos.append(msg)


def read_js(path):
    s = path.read_text(encoding="utf-8")
    return json.loads(s[s.index("=") + 1:].strip().rstrip(";"))


def read_csv(path):
    with path.open(encoding="utf-8-sig") as f:
        return list(csv.DictReader(f))


def rooms_in(text):
    return {P.room_key(r) for r in P.parse_rooms(text)}


def check_snapshot(app):
    snaps = sorted(RAW.glob("dense_*.txt"))
    if not snaps:
        err("data/raw 下没有 dense_*.txt 快照，无法核对群人数")
        return
    size = P.snapshot_group_size()
    if size != app["meta"]["groupSize"]:
        err(f"群人数不一致：快照标题 {size} vs 产物 {app['meta']['groupSize']}，请重跑 parse.py")
    if app["meta"]["screens"] and app["meta"]["screens"] != len(snaps):
        warn(f"产物记录 {app['meta']['screens']} 屏，data/raw 现有 {len(snaps)} 屏，可能混入了旧快照")


def check_conservation(app, rooms, members):
    m = app["meta"]
    if m["captured"] != m["groupSize"]:
        err(f"成员数 {m['captured']} ≠ 群人数 {m['groupSize']}："
            "快照可能漏屏或被虚拟列表重复渲染污染，需重采后再解析")
    joined = sum(r["joined"] for r in rooms)
    if joined != m["identifiedMembers"]:
        err(f"户内人数合计 {joined} ≠ 已识别成员 {m['identifiedMembers']}：有成员没落到任何房号")
    if m["identifiedMembers"] + m["unresolved"] != m["groupSize"]:
        err("已识别 + 未识别 ≠ 群人数")
    if len(rooms) != m["totalHouseholds"]:
        err(f"房号清单 {len(rooms)} 个 ≠ 全盘户数 {m['totalHouseholds']}")
    keys = [r["key"] for r in rooms]
    dup = [k for k, v in Counter(keys).items() if v > 1]
    if dup:
        err(f"房号清单存在重复：{dup}")
    for b in app["buildings"]:
        if b["joined"] > b["total"]:
            err(f"{b['name']} 入群户数 {b['joined']} > 总户数 {b['total']}")
    bad = [r["key"] for r in rooms if r["joined"] > 6]
    if bad:
        err(f"单户入群人数异常（>6）：{bad}")


def check_nick_room(members):
    bad = []
    for row in members:
        rk = row["房号"]
        if not rk:
            continue
        found = rooms_in(row["昵称"])
        if found and rk not in found:
            bad.append(f"{row['昵称']} 归到 {rk}，昵称里却是 {sorted(found)}")
    if bad:
        err("昵称中的房号与归属不一致（可能被错并）：\n      - " + "\n      - ".join(bad))


def check_published(app):
    mh = ROOT / "model.html"
    if not mh.exists():
        warn("model.html 不存在，3D 页未构建")
    else:
        s = mh.read_text(encoding="utf-8")
        meta = app["meta"]
        for label, pat in [
            ("群人数", rf"groupSize:{meta['groupSize']}\b"),
            ("户数", rf"households:{meta['households']}\b"),
            ("口径日期", rf'date:"{meta["date"]}"'),
        ]:
            if not re.search(pat, s):
                err(f"model.html 未内联最新{label}，3D 页与数据脱节：请重跑 cd app && npm run build")

    rh = ROOT / "report.html"
    if not rh.exists():
        err("report.html 不存在")
        return
    html = rh.read_text(encoding="utf-8")
    for ph in ["hTotal", "hHomes", "kHome", "kMembers", "miniNote", "mScreens", "mCaptured", "barHigh"]:
        if f'id="{ph}"' not in html:
            err(f'report.html 缺少数据占位符 id="{ph}"：数字可能又被写死，页面会再次过期')
    ver = re.search(r'app-data\.js\?v=([^"]+)"', html)
    if ver and ver.group(1) != app["meta"]["date"]:
        new = re.sub(r'(app-data\.js\?v=)[^"]+', rf'\g<1>{app["meta"]["date"]}', html)
        rh.write_text(new, encoding="utf-8")
        fixes.append(f"report.html 缓存版本号 {ver.group(1)} → {app['meta']['date']}（防浏览器读到旧数据）")


def check_review(app, rooms, members):
    by_room = defaultdict(list)
    for row in members:
        if row["房号"]:
            by_room[row["房号"]].append(row["昵称"])

    # 同户同名：既可能是同户真有重名，也可能是虚拟列表重复渲染。多次独立重采结果一致，
    # 因此按"真"计数；这里只报总数备案，--list 才展开，避免门禁每次都刷屏。
    same = {k: v for k, v in by_room.items() if len(v) != len(set(v))}
    if same:
        heavy = {k: v for k, v in same.items() if max(Counter(v).values()) >= 3}
        line = f"同户同名（同户重名或渲染重复）{len(same)} 户，其中同名≥3 的 {len(heavy)} 户"
        if LIST:
            line += "：\n      - " + "\n      - ".join(f"{k}: {v}" for k, v in sorted(same.items()))
        info(line)

    three = sorted(k for k, v in by_room.items() if len(v) >= 3)
    if three:
        warn("三人及以上进群户，建议抽查：" + "、".join(three))

    unresolved = [r["昵称"] for r in members if not r["房号"] and r["昵称"] not in P.NICK_ONLY]
    if unresolved:
        warn("未识别房号成员：" + "、".join(unresolved))

    human = [r["昵称"] for r in members
             if r["房号"] and not rooms_in(r["昵称"]) and not re.search(r"\d", r["昵称"])]
    if human:
        info("归属完全依赖人工确认（已在覆盖表备案）：" + "、".join(human))


def check_trend(app):
    try:
        head = subprocess.run(["git", "show", "HEAD:data/stats.json"], cwd=ROOT,
                              capture_output=True, text=True, check=True).stdout
        prev = json.loads(head)
    except Exception:
        return
    dh = app["meta"]["households"] - prev.get("households", 0)
    dg = app["meta"]["groupSize"] - prev.get("groupSize", 0)
    if abs(dg) > max(5, prev.get("groupSize", 0) * 0.05):
        warn(f"群人数较上一版变化 {dg:+d}（{prev.get('groupSize')} → {app['meta']['groupSize']}），幅度偏大，确认是否真有这么多人进出")
    if abs(dh) > max(5, prev.get("households", 0) * 0.05):
        warn(f"入群户数较上一版变化 {dh:+d}（{prev.get('households')} → {app['meta']['households']}），幅度偏大，确认归并口径")


def main():
    app = read_js(DATA / "app-data.js")
    rooms = app["rooms"]
    members = read_csv(DATA / "members.csv")

    check_snapshot(app)
    check_conservation(app, rooms, members)
    check_nick_room(members)
    check_published(app)
    check_review(app, rooms, members)
    check_trend(app)

    for f in fixes:
        print(f"[FIX ] {f}")
    for i in infos:
        print(f"[INFO] {i}")
    for w in warns:
        print(f"[WARN] {w}")
    for e in errors:
        print(f"[FAIL] {e}")

    m = app["meta"]
    print(f"\n门禁结果：{len(errors)} 错误 / {len(warns)} 警告 / {len(infos)} 备案 / {len(fixes)} 自动修正")
    print(f"  群人数 {m['groupSize']} · 抓到 {m['captured']} · 未识别 {m['unresolved']} · "
          f"覆盖 {m['households']}/{m['totalHouseholds']} 户（{m['coverage']*100:.2f}%）")
    if errors or (STRICT and warns):
        print("==> 未通过，先处理上面的 FAIL 再发布")
        return 1
    print("==> 通过")
    return 0


if __name__ == "__main__":
    sys.exit(main())
