# -*- coding: utf-8 -*-
"""在 CEF 缓存 f_* 响应体文件中定位 每日研报 列表页 HTML"""
import gzip
import sys
from pathlib import Path

INSTALL_CACHE = Path(r"C:\HiborSystem\HiborTerminal\Cache\Cache")
sys.stdout.reconfigure(encoding="utf-8")

MARKS = {
    "每日研报": "每日研报".encode("utf-8"),
    "edayread": b"edayread",
    "gaojisousuo": b"gaojisousuo",
    "共找到": "共找到".encode("utf-8"),
    "huisouchrome": b"huisouchrome",
}

def sniff(data: bytes) -> bytes:
    if data[:2] == b"\x1f\x8b":
        try:
            return gzip.decompress(data)
        except Exception:
            return data
    return data

for f in sorted(INSTALL_CACHE.glob("f_*")):
    try:
        data = f.read_bytes()
    except OSError:
        continue
    body = sniff(data)
    hits = [k for k, v in MARKS.items() if v in body]
    if hits:
        print(f"{f.name:>10}  {len(body):>8}B  gzip={data[:2]==b'\x1f\x8b'}  marks={hits}")
