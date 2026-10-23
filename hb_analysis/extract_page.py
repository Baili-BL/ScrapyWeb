# -*- coding: utf-8 -*-
"""解压列表页缓存, 提取分页与字段结构"""
import gzip
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
INSTALL = Path(r"C:\HiborSystem\HiborTerminal\Cache\Cache")
OUT = Path(__file__).parent / "list_page.html"

src = (INSTALL / "f_000048").read_bytes()
body = gzip.decompress(src) if src[:2] == b"\x1f\x8b" else src
OUT.write_bytes(body)
html = body.decode("utf-8", "ignore")
print("saved", OUT, len(html))

pats = {
    "PageNo出现": r"PageNo[^\"'<> ]{0,40}",
    "pageindex出现": r"pageindex[^\"'<> ]{0,40}",
    "Default.aspx链接": r"Default\.aspx\?[^\"'<>]{0,160}",
    "分页相关函数": r"function\s+\w*[Pp]age\w*[^{]{0,80}",
    "记录总数": r"共找到[^<]{0,30}",
    "分类链接(a含TypeID)": r"[a-z]+\.aspx\?TypeID=\d+[^\"'<>]{0,80}",
}
for name, pat in pats.items():
    ms = re.findall(pat, html)
    uniq = []
    for m in ms:
        if m not in uniq:
            uniq.append(m)
    print(f"--- {name} ({len(ms)} hits, {len(uniq)} uniq)")
    for m in uniq[:12]:
        print("   ", m[:170])
