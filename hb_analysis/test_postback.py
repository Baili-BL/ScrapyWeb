# -*- coding: utf-8 -*-
"""验证 AspNetPager 翻页 POST + 提取分类 TypeID 映射 + 查看 Home/Pro"""
import re
import sys
from pathlib import Path
from urllib.parse import parse_qs, urlsplit

import requests

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).parent

# 复用 test_live 的会话构建逻辑
import shutil
import sqlite3

tmp = HERE / "Cookies_live"
shutil.copy2(Path(r"C:\HiborSystem\HiborTerminal\Cache\Cookies"), tmp)
db = sqlite3.connect(tmp)
rows = db.execute("SELECT host_key, name, value FROM cookies").fetchall()
db.close()

session = requests.Session()
session.trust_env = False
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.91 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
    "Referer": "https://win.hibor.com.cn/edayread/Default.aspx?TypeID=18",
})
for host, name, value in rows:
    if not value:
        continue
    domain = host.lstrip(".")
    session.cookies.set(name, value, domain=("." + domain) if host.startswith(".") else domain, path="/")

PARAMS = {
    "abc": "YWFUnQmOvMnPxPoMrNtRzQ",
    "def": "mOmMsQqOjMoPpPjMpNtRaQnMqPMYnNrQuOpPmM",
    "xyz": "mOsMzQqOpMwPpP",
    "vidd": "24",
    "keyy": "DLJOU45LJO",
    "op": "1",
}

def get_page(typeid):
    url = "https://win.hibor.com.cn/edayread/Default.aspx"
    p = {"TypeID": str(typeid), **PARAMS}
    r = session.get(url, params=p, timeout=20)
    return r

def rows_count(html):
    return html.count("viewtitle(this)")

def total_records(html):
    m = re.search(r"共找到\s*(\d+)\s*条记录", html)
    return int(m.group(1)) if m else -1

def hidden_fields(html):
    out = {}
    for m in re.finditer(r'<input[^>]*type="hidden"[^>]*>', html):
        tag = m.group(0)
        n = re.search(r'name="([^"]+)"', tag)
        v = re.search(r'value="([^"]*)"', tag)
        if n:
            out[n.group(1)] = v.group(1) if v else ""
    return out

def first_titles(html, k=3):
    return re.findall(r'viewtitle\(this\)" aid="titA\d+" target="_blank" href="[^"]*" class="" title="([^"]+)"', html)[:k]

# --- 第1页 ---
r1 = get_page(18)
h1 = r1.text
print("第1页: 记录数=", total_records(h1), " 条目=", rows_count(h1))
print("  前3条:", first_titles(h1))

# --- 翻页 POST 到第2页 ---
hf = hidden_fields(h1)
pager = re.findall(r"__doPostBack\(&#39;(ctl00\$Body_code\$AspNetPager1)&#39;,\s*&#39;(\d+)&#39;\)", h1)
print("  AspNetPager 链接样本:", pager[:5])
data = dict(hf)
data["__EVENTTARGET"] = "ctl00$Body_code$AspNetPager1"
data["__EVENTARGUMENT"] = "2"
r2 = session.post(r1.url, data=data, timeout=20)
h2 = r2.text
print("第2页 POST: status=", r2.status_code, " 条目=", rows_count(h2))
print("  前3条:", first_titles(h2))

# --- 排序 POST(按热度) ---
hf2 = hidden_fields(h2)
data2 = dict(hf2)
data2["__EVENTTARGET"] = "ctl00$Body_code$lkbHit"
data2["__EVENTARGUMENT"] = ""
r3 = session.post(r2.url, data=data2, timeout=20)
h3 = r3.text
print("排序POST(按热度): status=", r3.status_code, " 条目=", rows_count(h3))
print("  前3条:", first_titles(h3))

# --- 分类 TypeID 映射 ---
side = re.findall(r'href="[^"]*Default\.aspx\?TypeID=([^&"]+)[^"]*"[^>]*>\s*([^<]{2,20})\s*</a>', h1)
print("\n== 分类映射 ==")
for tid, name in side[:40]:
    print(f"  TypeID={tid:<6} {name.strip()}")

# --- Home/Pro 内容 ---
r4 = session.get("https://win.hibor.com.cn/winsystem/Home/Pro", timeout=15)
print("\n== winsystem/Home/Pro ==")
print(r4.text[:800])
