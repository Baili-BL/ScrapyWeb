# -*- coding: utf-8 -*-
"""提取列表条目行结构 + 分页控件 + 表单隐藏字段"""
import re
import sys
from pathlib import Path

sys.stdout.reconfigure(encoding="utf-8")
HERE = Path(__file__).parent
html = (HERE / "list_page.html").read_text("utf-8", "ignore")

# 1. 所有 __doPostBack 目标(分页/排序控件)
targets = re.findall(r"__doPostBack\(&#39;([^&#]+)&#39;", html)
print("== __doPostBack 控件 ==")
for t in dict.fromkeys(targets):
    print("  ", t)

# 2. 隐藏表单字段
print("\n== 隐藏字段 ==")
for m in re.finditer(r'<input[^>]*type="hidden"[^>]*>', html):
    tag = m.group(0)
    name = re.search(r'name="([^"]+)"', tag)
    vid = re.search(r'id="([^"]+)"', tag)
    val = re.search(r'value="([^"]*)"', tag)
    v = (val.group(1)[:60] + "...") if val and len(val.group(1)) > 60 else (val.group(1) if val else "")
    print(f"  {name.group(1) if name else '?':<40} len={len(val.group(1)) if val else 0:<8} {v}")

# 3. 列表条目行: 找包含 分享时间 的 tr
print("\n== 列表条目结构 ==")
rows = re.findall(r"<tr[^>]*>.*?</tr>", html, re.S)
cnt = 0
for r in rows:
    if "分享时间" in r or ("页" in r and "K" in r and "20" in r):
        print(r[:4000])
        print("-" * 80)
        cnt += 1
        if cnt >= 2:
            break

# 4. 分页区域: 搜 pager / page 相关元素
print("\n== 分页相关片段 ==")
for m in re.finditer(r"(lkb\w*|lnk\w*|hp[lL]\w*)", html):
    pass
for m in re.finditer(r'id="(Body_code[^"]*[Pp]ag[^"]*)"', html):
    print("  id:", m.group(1))
for m in re.finditer(r'class="[^"]*page[^"]*"', html):
    print("  class:", m.group(0)[:80])
