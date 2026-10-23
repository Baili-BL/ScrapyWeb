# -*- coding: utf-8 -*-
"""分析慧博终端 CEF 缓存: 提取 Cookies 与请求过的 URL"""
import re
import sqlite3
import sys
from pathlib import Path
from collections import Counter

BASE = Path(__file__).parent
INSTALL_CACHE = Path(r"C:\HiborSystem\HiborTerminal\Cache\Cache")

sys.stdout.reconfigure(encoding="utf-8")

# ---------- 1. Cookies ----------
print("=" * 60)
print("COOKIES")
print("=" * 60)
db = sqlite3.connect(BASE / "Cookies")
cur = db.cursor()
try:
    rows = cur.execute(
        "SELECT host_key, name, value, encrypted_value, path, is_secure, is_httponly FROM cookies"
    ).fetchall()
except Exception as e:
    print("cookies 表读取失败:", e)
    rows = []
for host, name, value, enc, path, secure, httponly in rows:
    v = value if value else ("<encrypted %d bytes>" % len(enc) if enc else "<empty>")
    print(f"host={host:<28} name={name:<25} value={v:<40} path={path} secure={secure} httponly={httponly}")
db.close()

# ---------- 2. 从缓存 data_* 块提取 URL ----------
print()
print("=" * 60)
print("URLS IN HTTP CACHE")
print("=" * 60)
url_re = re.compile(rb"https?://[\x21-\x7e]+")
urls = Counter()
for f in sorted(BASE.glob("data_*")):
    data = f.read_bytes()
    for m in url_re.findall(data):
        u = m.decode("ascii", "ignore").rstrip("\\\"'<>)}]")
        urls[u] += 1

# 也扫一下独立缓存文件(响应体)的头部
for f in sorted(INSTALL_CACHE.glob("f_*"))[:200]:
    try:
        head = f.open("rb").read(4096)
    except OSError:
        continue
    for m in url_re.findall(head):
        u = m.decode("ascii", "ignore").rstrip("\\\"'<>)}]")
        urls[u] += 1

host_counter = Counter()
for u in urls:
    m = re.match(r"https?://([^/]+)", u)
    if m:
        host_counter[m.group(1).lower()] += 1

print("\n-- 按主机统计 --")
for h, c in host_counter.most_common():
    print(f"{c:>6}  {h}")

print("\n-- 含 hibor 的 URL(去重, 截断查询串展示) --")
seen = set()
for u, c in sorted(urls.items(), key=lambda kv: -kv[1]):
    if "hibor" in u.lower():
        base = u.split("?")[0]
        if base in seen:
            continue
        seen.add(base)
        show = u if len(u) <= 160 else u[:157] + "..."
        print(f"{c:>4}  {show}")

print("\n-- 非静态资源的其他 URL (php/aspx/json/action/api) --")
for u, c in sorted(urls.items(), key=lambda kv: -kv[1]):
    low = u.lower()
    if ("hibor" not in low) and any(k in low for k in (".php", ".aspx", ".json", "action", "api", "/s?", "query")):
        base = u.split("?")[0]
        if base in seen:
            continue
        seen.add(base)
        show = u if len(u) <= 160 else u[:157] + "..."
        print(f"{c:>4}  {show}")
