# -*- coding: utf-8 -*-
"""项目一：东方财富股票数据爬虫（默认贵州茅台 600519）。

数据来自东方财富网页使用的公开 JSON 行情接口：
- 实时快照: https://push2.eastmoney.com/api/qt/stock/get
- 日 K 线:  https://push2his.eastmoney.com/api/qt/stock/kline/get

本机 fake-ip(TUN) 代理环境下 push2 线路不稳，抓取前用 dnspin 探测并
钉扎可直连的真实 IP；请求失败时自动换 IP 重试（见 dnspin.py）。

用法：
    scrapy crawl eastmoney_stock -O ../data/eastmoney_600519_kline.json
    scrapy crawl eastmoney_stock -a code=000001 -a market=0 -O ../data/eastmoney_000001_kline.json
"""

import asyncio
import json
from datetime import datetime

import scrapy

from scrapytask_demo.dnspin import pin_hosts, rotate_pin
from scrapytask_demo.items import KlineItem, SnapshotItem

UT = "fa5fd1943c7b386f172d6893dbfba10b"  # 东财网页公开使用的 ut 令牌

# 本机 fake-ip(TUN) 环境下 push2/push2his 会被代理解析到 198.18.x 且上游不通，
# 抓取前把接口主机钉扎到「端到端探测通过」的真实 IP（见 dnspin.py）。
PIN_HOSTS = ("push2.eastmoney.com", "push2his.eastmoney.com")

# fields2 顺序：日期,开盘,收盘,最高,最低,成交量(手),成交额(元),振幅%,涨跌幅%,涨跌额,换手率%
KLINE_FIELDS = (
    "date",
    "open",
    "close",
    "high",
    "low",
    "volume",
    "amount",
    "amplitude",
    "pct_change",
    "change",
    "turnover",
)

MAX_PIN_RETRIES = 3


def to_number(text):
    """接口对停牌等场景会返回 '-'，统一转成 None/float。"""
    try:
        return float(text)
    except (TypeError, ValueError):
        return None


class EastMoneyStockSpider(scrapy.Spider):
    name = "eastmoney_stock"
    allowed_domains = ["push2.eastmoney.com", "push2his.eastmoney.com"]

    custom_settings = {
        "DOWNLOAD_DELAY": 0.3,
        "RETRY_TIMES": 4,
        # 东财 push2/push2his 接口主机 robots.txt 为全站 Disallow: /，
        # 本爬虫仅发起 2 次与网页浏览等量的公开接口请求，仅作本地演示用途。
        "ROBOTSTXT_OBEY": False,
    }

    def __init__(self, code="600519", market="1", kline_count="120", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.code = code
        self.market = market  # 1=沪市 0=深市
        self.kline_count = int(kline_count)
        self.secid = f"{market}.{code}"

    def _probe_paths(self) -> dict[str, str]:
        """钉扎探测用的最小接口路径（每主机一次 200+JSON 校验）。"""
        return {
            "push2.eastmoney.com": (
                f"/api/qt/stock/get?secid={self.secid}&invt=2&fltt=2&ut={UT}&fields=f57,f58"
            ),
            "push2his.eastmoney.com": (
                f"/api/qt/stock/kline/get?secid={self.secid}&klt=101&fqt=1&lmt=1"
                f"&end=20500101&ut={UT}&fltt=2&fields1=f1&fields2=f51"
            ),
        }

    async def start(self):
        try:
            pinned = await asyncio.to_thread(pin_hosts, self._probe_paths())
            for host, ip in pinned.items():
                self.logger.info("DNS pinned: %s -> %s", host, ip)
        except Exception as exc:  # noqa: BLE001 - 钉扎失败不影响尝试正常解析
            self.logger.warning("DNS pinning failed: %s (fallback to system DNS)", exc)

        referer = {"Referer": "https://quote.eastmoney.com/"}
        snapshot_url = (
            "https://push2.eastmoney.com/api/qt/stock/get"
            f"?secid={self.secid}&invt=2&fltt=2&ut={UT}"
            "&fields=f43,f44,f45,f46,f47,f48,f57,f58,f60,f116,f117,f162,f168,f170,f171"
        )
        kline_url = (
            "https://push2his.eastmoney.com/api/qt/stock/kline/get"
            f"?secid={self.secid}&klt=101&fqt=1&lmt={self.kline_count}&end=20500101"
            f"&ut={UT}&fltt=2"
            "&fields1=f1,f2,f3,f4,f5,f6"
            "&fields2=f51,f52,f53,f54,f55,f56,f57,f58,f59,f60,f61"
        )
        yield scrapy.Request(
            snapshot_url,
            callback=self.parse_snapshot,
            errback=self.on_download_error,
            headers=referer,
            meta={"pin_retries": 0},
        )
        yield scrapy.Request(
            kline_url,
            callback=self.parse_kline,
            errback=self.on_download_error,
            headers=referer,
            meta={"pin_retries": 0},
        )

    def _retry_with_new_ip(self, request, reason: str):
        """换一个探测通过的真实 IP 后重试同一请求。"""
        retries = request.meta.get("pin_retries", 0)
        host = request.url.split("/")[2].split(":")[0]
        if retries >= MAX_PIN_RETRIES:
            self.logger.error("give up on %s after %s pin retries (last reason: %s)", host, retries, reason)
            return None
        new_ip = rotate_pin(host, self._probe_paths().get(host, "/"))
        if not new_ip:
            self.logger.error("no reachable IP left for %s (last reason: %s)", host, reason)
            return None
        self.logger.warning("rotated %s -> %s (%s), retrying", host, new_ip, reason)
        retry = request.copy()
        retry.meta["pin_retries"] = retries + 1
        retry.dont_filter = True
        return retry

    def on_download_error(self, failure):
        """下载层失败（连接重置等）：换 IP 重试。"""
        request = failure.request
        return self._retry_with_new_ip(request, "download error")

    def _load_json(self, response):
        try:
            return json.loads(response.text)
        except (ValueError, TypeError):
            return None

    def parse_snapshot(self, response):
        payload = self._load_json(response)
        if payload is None:
            # 502/网关页等非 JSON 响应：换 IP 重试
            retry = self._retry_with_new_ip(response.request, f"bad response {response.status}")
            if retry:
                yield retry
            return
        data = payload.get("data") or {}
        if not data:
            self.logger.warning("snapshot is empty for secid=%s", self.secid)
            return
        yield SnapshotItem(
            type="snapshot",
            code=data.get("f57"),
            name=data.get("f58"),
            price=to_number(data.get("f43")),
            prev_close=to_number(data.get("f60")),
            open=to_number(data.get("f46")),
            high=to_number(data.get("f44")),
            low=to_number(data.get("f45")),
            volume=data.get("f47"),
            amount=to_number(data.get("f48")),
            pct_change=to_number(data.get("f170")),
            amplitude=to_number(data.get("f171")),
            turnover=to_number(data.get("f168")),
            pe_ttm=to_number(data.get("f162")),
            market_cap=to_number(data.get("f116")),
            float_cap=to_number(data.get("f117")),
            fetched_at=datetime.now().isoformat(timespec="seconds"),
        )

    def parse_kline(self, response):
        payload = self._load_json(response)
        if payload is None:
            retry = self._retry_with_new_ip(response.request, f"bad response {response.status}")
            if retry:
                yield retry
            return
        data = payload.get("data") or {}
        klines = data.get("klines") or []
        if not klines:
            self.logger.warning("kline is empty for secid=%s", self.secid)
            return
        code = data.get("code") or self.code
        name = data.get("name") or self.code
        for row in klines:
            values = dict(zip(KLINE_FIELDS, row.split(",")))
            volume = to_number(values["volume"])
            yield KlineItem(
                type="kline",
                code=code,
                name=name,
                date=values["date"],
                open=to_number(values["open"]),
                close=to_number(values["close"]),
                high=to_number(values["high"]),
                low=to_number(values["low"]),
                volume=int(volume) if volume is not None else None,
                amount=to_number(values["amount"]),
                amplitude=to_number(values["amplitude"]),
                pct_change=to_number(values["pct_change"]),
                change=to_number(values["change"]),
                turnover=to_number(values["turnover"]),
            )
        self.logger.info("kline parsed: %s bars for %s(%s)", len(klines), name, code)
