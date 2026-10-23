# -*- coding: utf-8 -*-
"""查看列表页HTML的条目结构与分页机制"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).parent
html = (HERE / "list_page.html").read_text("utf-8", "ignore")

# 1. 定位 共找到 附近的分页区域
i = html.find("共找到")
print("===== 共找到 附近 =====")
print(html[i - 200 : i + 1500].replace("\r", ""))
print()

# 2. 找一条列表条目的 HTML(含 分享时间)
j = html.find("分享时间")
print("===== 第一条条目附近 =====")
if j > 0:
    print(html[j - 2500 : j + 800])
