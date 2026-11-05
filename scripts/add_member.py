#!/usr/bin/env python3
"""新增一名群成员并重算数据。

用法：
  python3 scripts/add_member.py 11-1-101              # 群昵称即房号
  python3 scripts/add_member.py 11-1-101 --nick 11-101
  python3 scripts/add_member.py 7-1303 --nick 示例昵称

写入 data/raw/manual-members.csv（已被 .gitignore 排除，含昵称不外传），
随后自动重跑 scripts/parse.py。同一房号重复添加只增人数、不增户。
"""
import argparse
import csv
import importlib.util
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
MANUAL = ROOT / "data" / "raw" / "manual-members.csv"
OWNERS = ROOT / "data" / "owners.csv"

HEADER = """# 快照后补录的群成员，每行一条；以 # 开头为注释。
# 单列：群昵称即房号
# 双列：昵称,房号
#
# 洋房（11#/12#）房号必须带单元：11-1-101 / 12-2-401
# 高层房号不带单元：7-1303 / 3-1101
#
# 同一房号可以出现多行——第二行起只增加该房号的进群人数，不新增户。
"""


def load_parse_module():
    spec = importlib.util.spec_from_file_location("parse_data", ROOT / "scripts" / "parse.py")
    mod = importlib.util.module_from_spec(spec)
    spec.loader.exec_module(mod)
    return mod


def existing_room_count(room_key):
    if not OWNERS.exists():
        return None
    with OWNERS.open(encoding="utf-8-sig") as f:
        for row in csv.DictReader(f):
            if row["房号"] == room_key:
                return int(row["进群人数"])
    return 0


def main():
    ap = argparse.ArgumentParser(description="新增一名群成员并重算数据")
    ap.add_argument("room", help="房号，如 7-1303 或 11-1-101")
    ap.add_argument("--nick", default=None, help="群昵称，缺省与房号相同")
    ap.add_argument("--no-parse", action="store_true", help="只登记，不立即重算")
    args = ap.parse_args()

    parse_mod = load_parse_module()
    room = parse_mod.norm(args.room.strip())
    rooms = parse_mod.parse_rooms(room)
    if not rooms:
        b = room.split("-")[0]
        hint = ""
        if b.isdigit() and parse_mod.BUILDINGS.get(int(b), {}).get("type") == "洋房":
            hint = f" 洋房需带单元，例如 {b}-1-{room.split('-')[-1]}"
        sys.exit(f"房号无法解析：{args.room!r}。{hint}")

    key = parse_mod.room_key(rooms[0])
    nick = (args.nick or args.room).strip()
    prev = existing_room_count(key)

    if not MANUAL.exists():
        MANUAL.parent.mkdir(parents=True, exist_ok=True)
        MANUAL.write_text(HEADER, encoding="utf-8")

    lines = MANUAL.read_text(encoding="utf-8-sig").splitlines()
    entry = key if nick == key else f"{nick},{key}"
    for line in lines:
        t = line.strip()
        if not t or t.startswith("#"):
            continue
        n, r = (x.strip() for x in t.split(",", 1)) if "," in t else (t, t)
        if r == key and n == nick:
            sys.exit(f"台账里已有该成员：{entry}")

    with MANUAL.open("a", encoding="utf-8") as f:
        f.write(entry + "\n")

    if prev is None:
        effect = "该房号此前未进群，本次新增 1 户"
    elif prev == 0:
        effect = "该房号此前未进群，本次新增 1 户"
    else:
        effect = f"该房号已有 {prev} 人进群，本次只增人数、不增户"

    print(f"已登记：{entry}")
    print(f"预期效果：{effect}")

    if args.no_parse:
        return
    subprocess.run([sys.executable, str(ROOT / "scripts" / "parse.py")], check=True)
    print("\n下一步重建页面：cd app && npm run build")


if __name__ == "__main__":
    main()
