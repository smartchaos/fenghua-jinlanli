#!/usr/bin/env python3
"""把微信群成员 AX 快照解析成成员表、户表与可视化数据。"""
import json
import re
import csv
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
RAW = ROOT / "data" / "raw"
DATA = ROOT / "data"

TOTAL_HOUSEHOLDS = 478
SNAPSHOT_DATE = "2026-11-11"   # 数据口径日期
SNAPSHOT_GROUP_SIZE = 316      # 群快照人数；快照后补录成员在此之上累加
MANUAL_FILE = RAW / "manual-members.csv"
OVERRIDES_FILE = RAW / "member-overrides.json"


# 昵称↔房号映射等本地覆盖数据不进仓库（data/raw 已忽略）
def load_overrides():
    if not OVERRIDES_FILE.exists():
        raise SystemExit(
            f"缺少 {OVERRIDES_FILE.relative_to(ROOT)}：昵称↔房号映射与合并规则不在仓库内。\n"
            '请从本地备份恢复该文件（结构：{"groupNick":{},"userConfirmed":{},"nickOnly":{},"noMerge":[]}），'
            "否则房号补全会静默少算。"
        )
    try:
        return json.loads(OVERRIDES_FILE.read_text(encoding="utf-8"))
    except json.JSONDecodeError as e:
        raise SystemExit(f"{OVERRIDES_FILE.relative_to(ROOT)} 解析失败：{e}")


OVER = load_overrides()
GROUP_NICK = OVER.get("groupNick", {})
USER_CONFIRMED = OVER.get("userConfirmed", {})
NICK_ONLY = OVER.get("nickOnly", {})
NO_MERGE = set(OVER.get("noMerge", []))
# 昵称被拆成多个 token 时的合并规则，同样只存在于本地覆盖文件
JOIN_NAME_TOKENS = set(OVER.get("joinWithRoom", []))
JOIN_PAIRS = {tuple(p) for p in OVER.get("joinPairs", [])}
PREFIX_RULES = [tuple(r) for r in OVER.get("prefixRules", [])]

# 规划口径：8 幢 16F + 1 幢 13F + 1 幢 11F + 2 幢洋房（7F/6F）
# 小高层 1F 架空，住宅从 2F 起，两梯三户；洋房一梯两户、每幢两单元、1F 起住。
BUILDINGS: OrderedDict[int, dict] = OrderedDict([
    (1,  {"name": "1#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (2,  {"name": "2#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (3,  {"name": "3#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (4,  {"name": "4#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (5,  {"name": "5#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (6,  {"name": "6#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (7,  {"name": "7#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (8,  {"name": "8#",  "type": "高层", "floors": 16, "resident_from": 2, "units": 3, "total": 45}),
    (9,  {"name": "9#",  "type": "高层", "floors": 11, "resident_from": 2, "units": 3, "total": 30}),
    (10, {"name": "10#", "type": "高层", "floors": 13, "resident_from": 2, "units": 3, "total": 36}),
    (11, {"name": "11#", "type": "洋房", "floors": 7,  "resident_from": 1, "units": 4, "total": 26, "stacks": 2}),
    (12, {"name": "12#", "type": "洋房", "floors": 7,  "resident_from": 1, "units": 4, "total": 26, "stacks": 2}),
])

# 示意图坐标（米），依据官方楼栋分布图相对位置重排，非实测总平。
# 场地南北长、东西短：西/中/东三列；各列错位排布，楼间距适当放大。
LAYOUT = {
    # 最前排：2#（西）1#（东）；左右间距较上版扩大 30%，且收回朱家坝路内侧
    2:  {"x": -46.8, "z": 85},
    1:  {"x": 46.8,  "z": 85},
    # 3# 位于 1/2/4/5 正中
    3:  {"x": 0,   "z": 57.5},
    # 第二排：5#（西）4#（东）
    5:  {"x": -46.8, "z": 37},
    4:  {"x": 46.8,  "z": 37},
    # 第三排：7#（西）6#（东）—— 与 4# 间距加大
    7:  {"x": -46.8, "z": -6},
    6:  {"x": 46.8,  "z": -6},
    # 8# 位于 6/7/9/10 正中
    8:  {"x": 0,   "z": -28},
    # 第四排：10#（西）9#（东）
    10: {"x": -46.8, "z": -49},
    9:  {"x": 46.8,  "z": -49},
    # 最后排：12#（西）11#（东）—— 与 9# 间距加大（洋房进深更大）
    12: {"x": -46.8, "z": -88},
    11: {"x": 46.8,  "z": -88},
}

ROOM_RE = re.compile(
    r"(?<!\d)(\d{1,2})-(\d)-(\d{3,4})(?!\d)"
    r"|(?<!\d)(\d{1,2})-(\d{3,4})(?!\d)"
    r"|(?<!\d)(\d{1,2})号楼(\d{3,4})(?!\d)"
)


def norm(text: str) -> str:
    for ch in "—–~～－一":
        text = text.replace(ch, "-")
    return text


def parse_rooms(text: str):
    out = []
    for m in ROOM_RE.finditer(norm(text)):
        if m.group(1):
            b, u, r = int(m.group(1)), int(m.group(2)), int(m.group(3))
        elif m.group(4):
            b, u, r = int(m.group(4)), 0, int(m.group(5))
        else:
            b, u, r = int(m.group(6)), 0, int(m.group(7))
        fl, no = divmod(r, 100)
        spec = BUILDINGS.get(b)
        if not spec:
            continue
        if spec["type"] == "洋房":
            max_stack = spec.get("stacks", 1)
            if not (1 <= u <= max_stack and 1 <= fl <= spec["floors"] and 1 <= no <= 2):
                continue
        else:
            if u not in (0, 1):
                continue
            if not (spec["resident_from"] <= fl <= spec["floors"] and 1 <= no <= spec["units"]):
                continue
        out.append((b, u, fl, no))
    return out


def pure_room(text: str):
    rs = parse_rooms(text)
    if len(rs) != 1:
        return None
    n = norm(text)
    if re.fullmatch(r"\d{1,2}-(?:\d-)?\d{3,4}", n) or re.fullmatch(r"\d{1,2}号楼\d{3,4}", n):
        return rs[0]
    return None


def extract_pages():
    pages = []
    for f in sorted(RAW.glob("*.txt")):
        s = f.read_text(encoding="utf-8")
        m = re.search(r"列表 聊天成员[^\n]*\n\s*\d+ StaticText ([^\n]+)", s)
        if m:
            toks = [t for t in m.group(1).split() if t not in ("添加", "邀请")]
            if toks:
                pages.append(toks)
    return pages


def stitch(pages):
    seq = pages[0][:]
    for p in pages[1:]:
        best = 0
        for k in range(min(len(seq), len(p)), 0, -1):
            if seq[-k:] == p[:k]:
                best = k
                break
        seq.extend(p[best:])
    return seq


def join_letter_runs(seq):
    out, buf = [], []
    for t in seq:
        if re.fullmatch(r"[A-Za-z]", t):
            buf.append(t)
        else:
            if buf:
                out.append("".join(buf))
                buf = []
            out.append(t)
    if buf:
        out.append("".join(buf))
    return out


def build_members(seq):
    seq = join_letter_runs(seq)
    members, i = [], 0
    while i < len(seq):
        t = seq[i]
        rs = parse_rooms(t)
        if rs:
            nxt = seq[i + 1] if i + 1 < len(seq) else ""
            # 群昵称含空格的成员在成员列表里被拆成「房号 + 后半段」两个 token，实为同一人
            if nxt and not parse_rooms(nxt):
                tail_rooms = parse_rooms(GROUP_NICK.get(nxt, ""))
                if (tail_rooms and tail_rooms[0] == rs[0]) or nxt in JOIN_NAME_TOKENS:
                    members.append({"nick": t + " " + nxt, "rooms": rs, "note": "合并空格昵称"})
                    i += 2
                    continue
            members.append({"nick": t, "rooms": rs, "note": ""})
            i += 1
            continue
        nxt = seq[i + 1] if i + 1 < len(seq) else ""
        nxt_room = pure_room(nxt) if nxt else None
        if t not in NO_MERGE:
            if nxt_room:
                members.append({"nick": t + " " + nxt, "rooms": [nxt_room], "note": "合并空格昵称"})
                i += 2
                continue
            if t in JOIN_NAME_TOKENS and nxt and parse_rooms(nxt):
                members.append({"nick": t + " " + nxt, "rooms": parse_rooms(nxt), "note": "合并空格昵称"})
                i += 2
                continue
            merged = False
            for prefix, token, room in PREFIX_RULES:
                buf = seq[i:i + 3]
                if t.startswith(prefix) and token in buf:
                    members.append({"nick": " ".join(buf), "rooms": parse_rooms(room),
                                    "note": f"用户确认 {token} 为 {room}"})
                    i += 3
                    merged = True
                    break
            if merged:
                continue
            if (t, nxt) in JOIN_PAIRS:
                members.append({"nick": t + " " + nxt, "rooms": [], "note": "无有效房号"})
                i += 2
                continue
        members.append({"nick": t, "rooms": [], "note": "未识别房号"})
        i += 1
    return members


def room_key(r):
    b, u, fl, no = r
    return f"{b}-{u}-{fl}{no:02d}" if u else f"{b}-{fl}{no:02d}"


def build_households(members):
    households = {}
    for m in members:
        if not m["rooms"]:
            continue
        key = room_key(m["rooms"][0])
        h = households.setdefault(key, {"key": key, "members": [], "status": "confirmed", "note": ""})
        h["members"].append(m["nick"])
        if "推测" in m["note"]:
            h["status"] = "inferred"
            h["note"] = m["note"]

    # 昵称无法解析但用户已确认归属的成员：只增人不新增户。
    for nick, key in NICK_ONLY.items():
        owner = next((x for x in members if x["nick"] == nick), None)
        if not owner:
            continue
        h = households.setdefault(key, {"key": key, "members": [], "status": "confirmed", "note": ""})
        h["members"].append(nick)
        h["note"] = f"含用户确认归属：{nick}（昵称无楼栋，归为 {key}）"
        owner["note"] = f"用户确认归为 {key}（昵称无楼栋）"
    return households


def build_rooms():
    rooms = []
    for b, spec in BUILDINGS.items():
        if spec["type"] == "洋房":
            for u in range(1, spec.get("stacks", 1) + 1):
                for fl in range(1, spec["floors"] + 1):
                    for no in (1, 2):
                        # 洋房 1F 只有一单元的两户，2F-7F 每单元两户
                        # 12# 的 1F 两户属 2 单元：西侧 col 2/3 即 2 单元列位，群昵称 12-2-102 佐证
                        if fl == 1 and u != (2 if b == 12 else 1):
                            continue
                        col = (u - 1) * 2 + no - 1
                        rooms.append({"key": f"{b}-{u}-{fl}{no:02d}", "b": b, "u": u,
                                      "f": fl, "no": no, "col": col})
        else:
            for fl in range(spec["resident_from"], spec["floors"] + 1):
                for no in range(1, spec["units"] + 1):
                    rooms.append({"key": f"{b}-{fl}{no:02d}", "b": b, "u": 0,
                                  "f": fl, "no": no, "col": no - 1})
    return rooms


# 快照后补录的成员：从 data/raw/manual-members.csv 读取。
# 每行「房号」或「昵称,房号」；同一房号可多行（第二人起只增人数，不增户）。
def load_manual_members():
    if not MANUAL_FILE.exists():
        return []
    out, seen = [], set()
    for lineno, raw in enumerate(MANUAL_FILE.read_text(encoding="utf-8-sig").splitlines(), 1):
        line = raw.strip()
        if not line or line.startswith("#"):
            continue
        if "," in line:
            nick, room = (x.strip() for x in line.split(",", 1))
        else:
            nick, room = line, line
        nick = nick or room
        if (nick, room) in seen:
            continue
        seen.add((nick, room))
        rooms = parse_rooms(room)
        if not rooms:
            raise SystemExit(
                f"manual-members.csv 第 {lineno} 行房号无法解析：{room!r}。"
                "洋房请写 楼-单元-房号（如 11-1-101 / 12-2-401），高层写 楼-房号（如 7-1303）。"
            )
        out.append({"nick": nick, "rooms": rooms, "note": "快照后手工补录"})
    return out


def apply_group_nicknames(members):
    for m in members:
        g = GROUP_NICK.get(m["nick"])
        if not g:
            continue
        old = m["nick"]
        m["nick"] = g
        m["rooms"] = parse_rooms(g)
        note = f"群昵称补全（原显示名 {old}）"
        if "链家" in g:
            note += "；疑似中介"
        m["note"] = note


def apply_user_confirmed(members):
    for m in members:
        key = USER_CONFIRMED.get(m["nick"])
        if not key:
            continue
        m["rooms"] = parse_rooms(key)
        m["note"] = f"用户确认归为 {key}"


def nick_key(text: str) -> str:
    return re.sub(r"\s+", "", norm(text)).lower()


# 快照后补录的台账与新快照可能指向同一个人：昵称命中即视为重复，只提示不自动删。
def dedup_manual(manual, snapshot_members):
    snap_nicks = {}
    for m in snapshot_members:
        snap_nicks.setdefault(nick_key(m["nick"]), m["nick"])
    by_room = {}
    for m in snapshot_members:
        if m["rooms"]:
            by_room.setdefault(room_key(m["rooms"][0]), []).append(m["nick"])

    kept, dropped, review = [], [], []
    for e in manual:
        k = nick_key(e["nick"])
        hit = snap_nicks.get(k)
        if not hit:
            hit = next((n for key, n in snap_nicks.items() if k and (k in key or key in k)), None)
        if hit:
            dropped.append((e["nick"], f"昵称已在新快照中：{hit}"))
            continue
        rk = room_key(e["rooms"][0])
        if rk in by_room:
            review.append((e["nick"], rk, by_room[rk]))
        kept.append(e)
    return kept, dropped, review


def main():
    print(f"覆盖项：groupNick {len(GROUP_NICK)} / userConfirmed {len(USER_CONFIRMED)} "
          f"/ nickOnly {len(NICK_ONLY)} / noMerge {len(NO_MERGE)}")
    seq = stitch(extract_pages())
    members = build_members(seq)
    apply_group_nicknames(members)
    apply_user_confirmed(members)
    snapshot = members[:]
    base_keys = set(build_households(snapshot))
    manual_all = load_manual_members()
    manual, dropped, review = dedup_manual(manual_all, snapshot)
    for nick, why in dropped:
        print(f"补录去重：{nick} —— {why}（本次快照已含，不再累加）")
    for nick, rk, nicks in review:
        print(f"补录待确认：{nick} 的房号 {rk} 新快照里已有 {len(nicks)} 人 {nicks}，"
              "若为同住户第二人则保留，若为同一人请从台账删除")
    members.extend(manual)
    group_size = SNAPSHOT_GROUP_SIZE + len(manual)
    households = build_households(members)
    manual_keys = {room_key(m["rooms"][0]) for m in manual if m["rooms"]}
    new_keys = manual_keys - base_keys
    print(f"补录 {len(manual)}/{len(manual_all)} 名（去重 {len(dropped)}）："
          f"新增房号 {len(new_keys)} 户，已入群房号加人 {len(manual) - len(new_keys)} 名")
    rooms = build_rooms()

    DATA.mkdir(exist_ok=True)
    with (DATA / "members.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["昵称", "楼栋", "单元", "楼层", "室号", "房号", "备注"])
        for m in members:
            if m["rooms"]:
                b, u, fl, no = m["rooms"][0]
                w.writerow([m["nick"], b, u or "", fl, f"{fl}{no:02d}", room_key(m["rooms"][0]), m["note"]])
            else:
                w.writerow([m["nick"], "", "", "", "", "", m["note"]])

    with (DATA / "owners.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["房号", "楼栋", "单元", "楼层", "进群人数", "状态"])
        for key in sorted(households, key=lambda k: (int(k.split("-")[0]), k)):
            b = int(key.split("-")[0])
            rest = key.split("-", 1)[1]
            r = rest.split("-")[-1]
            u = rest.split("-")[0] if rest.count("-") else ""
            w.writerow([key, b, u, int(r[:-2]), len(households[key]["members"]),
                        "推测" if households[key]["status"] == "inferred" else "确认"])

    with (DATA / "unresolved.csv").open("w", newline="", encoding="utf-8-sig") as f:
        w = csv.writer(f)
        w.writerow(["昵称", "说明"])
        for m in members:
            if not m["rooms"] and m["nick"] != "301业主":
                w.writerow([m["nick"], m["note"]])

    by_b = Counter(int(k.split("-")[0]) for k in households)
    dist = Counter(len(h["members"]) for h in households.values())

    floor_matrix = {}
    for b, spec in BUILDINGS.items():
        floor_matrix[str(b)] = {str(fl): 0 for fl in range(1, spec["floors"] + 1)}
    for key in households:
        b, rest = key.split("-", 1)
        r = rest.split("-")[-1]
        floor_matrix[b][str(int(r[:-2]))] += 1

    buildings = []
    for b, spec in BUILDINGS.items():
        joined = by_b.get(b, 0)
        buildings.append({
            "id": b, "name": spec["name"], "type": spec["type"],
            "floors": spec["floors"], "residentFrom": spec["resident_from"],
            "units": spec["units"], "stacks": spec.get("stacks", 1),
            "total": spec["total"], "joined": joined,
            "rate": round(joined / spec["total"], 4),
            **LAYOUT[b],
        })

    unresolved = sum(1 for m in members if not m["rooms"] and m["nick"] not in NICK_ONLY)
    # 已匹配成员以群人数为权威口径：captured 是含虚拟列表重复渲染的原始记录数，
    # 不能直接当成员数（capturedExtra 即该假象）；按房号归并的户数不受影响。
    identified = group_size - unresolved
    stats = {
        "groupName": "风华锦澜里业主群",
        "groupSize": group_size,
        "captured": len(members),
        "identifiedMembers": identified,
        "unresolvedMembers": unresolved,
        "households": len(households),
        "confirmedHouseholds": sum(1 for h in households.values() if h["status"] == "confirmed"),
        "inferredHouseholds": sum(1 for h in households.values() if h["status"] == "inferred"),
        "totalHouseholds": TOTAL_HOUSEHOLDS,
        "coverage": round(len(households) / TOTAL_HOUSEHOLDS, 4),
        "memberDistribution": {str(k): v for k, v in sorted(dist.items())},
        "buildings": buildings,
        "floorMatrix": floor_matrix,
        "capturedExtra": len(members) - group_size,
    }
    (DATA / "stats.json").write_text(json.dumps(stats, ensure_ascii=False, indent=2), encoding="utf-8")

    # 前端数据（无昵称）
    app = {
        "meta": {
            "title": "风华锦澜里 · 业主入群分布",
            "groupName": stats["groupName"],
            "date": SNAPSHOT_DATE,
            "totalHouseholds": TOTAL_HOUSEHOLDS,
            "households": stats["households"],
            "coverage": stats["coverage"],
            "groupSize": group_size,
            "captured": len(members),
            "identifiedMembers": identified,
            "unresolved": stats["unresolvedMembers"],
            "inferred": stats["inferredHouseholds"],
        },
        "buildings": buildings,
        "rooms": [
            {**r, "joined": len(households[r["key"]]["members"]) if r["key"] in households else 0,
             "status": households[r["key"]]["status"] if r["key"] in households else ""}
            for r in rooms
        ],
        "floorMatrix": floor_matrix,
    }
    payload = json.dumps(app, ensure_ascii=False, separators=(",", ":")) + ";\n"
    # data/app-data.js: window 全局, 供 report.html 使用
    (DATA / "app-data.js").write_text("window.APP_DATA = " + payload, encoding="utf-8")
    # app/src/data/app-data.js: ESM, 供 model.html(Vite 构建)使用; 同一份数据两个出口, 勿手改
    (Path(__file__).resolve().parent.parent / "app" / "src" / "data" / "app-data.js").write_text(
        "export default " + payload, encoding="utf-8"
    )

    print(json.dumps({k: stats[k] for k in (
        "groupSize", "captured", "identifiedMembers", "unresolvedMembers",
        "households", "confirmedHouseholds", "inferredHouseholds",
        "totalHouseholds", "coverage", "memberDistribution")}, ensure_ascii=False, indent=2))
    print("buildings:", {b["name"]: f'{b["joined"]}/{b["total"]}' for b in buildings})
    print("rooms total:", len(rooms), "joined rooms:", sum(1 for r in rooms if r["key"] in households))


if __name__ == "__main__":
    main()
