# ScrapyTask 演示爬虫工程

一个 Scrapy 工程，包含两个抓取「项目」（spider），对应仪表盘里的两个数据来源：

| 爬虫 | 目标 | 数据 |
| --- | --- | --- |
| `eastmoney_stock` | 东方财富公开行情接口，默认抓贵州茅台 `600519` | 实时快照 + 最近 120 个交易日日线 |
| `fcfco_reports` | 第一创业期货官网（fcfco.cn → futures.fcsc.com）「一创研究」栏目 | 研究报告标题/日期/详情链接/微信文章外链 |

## 运行

```powershell
# 首次：创建虚拟环境并安装 scrapy（本仓库已装好 .venv）
python -m venv .venv
.venv\Scripts\python -m pip install scrapy

# 进入工程目录
cd crawlers

# 项目一：东方财富股票数据（可用 -a code=000001 -a market=0 换成其它股票）
..\.venv\Scripts\scrapy crawl eastmoney_stock -O ../data/eastmoney_600519_kline.json -O ../data/eastmoney_600519_kline.csv

# 项目二：一创研究报告（默认前 3 页，可用 -a pages=5 调整，共 31 页）
..\.venv\Scripts\scrapy crawl fcfco_reports -O ../data/fcfco_reports.json
```

产出文件落在工作区根目录 `data/` 下：

- `eastmoney_600519_kline.json` / `.csv` —— 日线数据（120 条）
- `eastmoney_600519_snapshot.json` —— 实时快照（pipeline 单独落盘）
- `fcfco_reports.json` —— 研究报告列表

## 本机网络适配（dnspin.py）

本机若开启 Clash/Mihomo 类 **TUN + fake-ip** 代理，`push2/push2his` 会被解析成
`198.18.x.x` 假 IP，且经代理线路访问东财接口会被 WAF 重置（502/连接中断）。
`scrapytask_demo/dnspin.py` 的处理方式：

1. 用阿里 DoH（223.5.5.5 / 1.12.12.12）解析真实 IP；
2. 对候选 IP 做**端到端探测**（真实 GET 一次接口，要求 200 + JSON）；
3. 把首个探测通过的 IP 钉扎到本进程的 `socket.getaddrinfo`（不改系统 hosts）；
4. 请求失败时自动换下一个 IP 重试（最多 3 轮）。

只影响爬虫进程，不改系统代理/hosts 配置；代理关闭时同样能正常工作。

## 已知问题与注意事项

- **东财 WAF 限流**：短时间高频请求 push2 会被临时限流（502 / TLS 重置），
  等待几分钟后重跑即可。正常一次抓取只发 2 个请求，不会触发。
- **东财 robots**：push2/push2his 的 robots.txt 为全站 `Disallow: /`，
  `eastmoney_stock` 爬虫中显式关闭了 ROBOTSTXT_OBEY——仅用于本地演示，
  请勿高频采集。
- **微信外链**：一创研究的报告正文发布在微信公众号（详情页含 mp.weixin.qq.com
  外链）。微信 robots 对文章页同样是 `Disallow: /`，且日报正文以图片为主，
  故本工程只保留外链不做正文抓取。
- **Scrapy 2.19 兼容**：pipeline 丢弃 item 需 `raise DropItem`（返回 None 会被
  当作 item 继续传递）；spider 入口使用 `async def start()`（`start_requests`
  已移除）；pipeline 钩子不再接收 spider/crawler 参数，需用 `from_crawler`。

## 合规

两爬虫均为低频（DOWNLOAD_DELAY 0.3~1s）、小量、只读公开数据；期货官网
robots.txt 为 404（无限制），东财接口的 robots 限制已在上方说明。
