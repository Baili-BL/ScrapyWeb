# -*- coding: utf-8 -*-
"""验证: 用慧博终端的 Cookies 直接请求 win.hibor.com.cn 列表页"""
import shutil
import sqlite3
import sys
import tempfile
from pathlib import Path

import requests

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).parent
SRC = Path(r"C:\HiborSystem\HiborTerminal\Cache\Cookies")

# 1. 读取 CEF Cookies(先复制避免锁冲突)
tmp = HERE / "Cookies_live"
shutil.copy2(SRC, tmp)
db = sqlite3.connect(tmp)
rows = db.execute("SELECT host_key, name, value FROM cookies").fetchall()
db.close()

session = requests.Session()
session.trust_env = False  # 不走系统代理
session.headers.update({
    "User-Agent": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/61.0.3163.91 Safari/537.36",
    "Accept-Language": "zh-CN,zh;q=0.9",
})
for host, name, value in rows:
    if not value:
        continue
    domain = host.lstrip(".")
    session.cookies.set(name, value, domain=("." + domain) if host.startswith(".") else domain, path="/")
    print(f"cookie -> {host:<22} {name}")

# 2. 测试首页登录态
r0 = session.get("https://win.hibor.com.cn/winsystem/Home/Pro", timeout=15)
print("\n[winsystem/Home/Pro]", r0.status_code, "len=", len(r0.text))
t = r0.text
for kw in ("退出", "登录", "login", "username", "HW"):
    if kw in t:
        print("  含关键字:", kw)

# 3. 测试纯 Cookie + TypeID=18(金融工程)
url1 = "https://win.hibor.com.cn/edayread/Default.aspx?TypeID=18"
r1 = session.get(url1, timeout=20)
print("\n[纯Cookie TypeID=18]", r1.status_code, "final=", r1.url, "len=", len(r1.text))
txt = r1.text
print("  含 '共找到':", "共找到" in txt, "| 含 '登录':", ("登录" in txt), "| title:", end=" ")
import re
m = re.search(r"<title>([^<]*)</title>", txt)
print(m.group(1) if m else "?")
m2 = re.search(r"共找到\s*(\d+)\s*条记录", txt)
print("  记录数:", m2.group(1) if m2 else "-")

# 4. 测试带 abc/def/xyz 混淆参数(缓存里的本次会话参数)
url2 = ("https://win.hibor.com.cn/edayread/Default.aspx?TypeID=18"
        "&abc=YWFUnQmOvMnPxPoMrNtRzQ&def=mOmMsQqOjMoPpPjMpNtRaQnMqPMYnNrQuOpPmM"
        "&xyz=mOsMzQqOpMwPpP&vidd=24&keyy=DLJOU45LJO&op=1")
r2 = session.get(url2, timeout=20)
print("\n[带混淆参数 TypeID=18]", r2.status_code, "final=", r2.url, "len=", len(r2.text))
txt2 = r2.text
m3 = re.search(r"共找到\s*(\d+)\s*条记录", txt2)
print("  记录数:", m3.group(1) if m3 else "-")
print("  含 条目行:", txt2.count('viewtitle(this)'), "条")
m4 = re.search(r"<title>([^<]*)</title>", txt2)
print("  title:", m4.group(1) if m4 else "?")
