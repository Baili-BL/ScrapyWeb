# -*- coding: utf-8 -*-
"""Item pipelines：把东财实时快照单独落盘，其余 item 交给 feed 导出。"""

import json
import logging
from datetime import datetime
from pathlib import Path

from scrapy.crawler import Crawler
from scrapy.exceptions import DropItem

LOGGER = logging.getLogger(__name__)

DATA_DIR = Path(__file__).resolve().parents[2] / "data"


class EastMoneySnapshotPipeline:
    """收集 SnapshotItem，爬虫结束时写出 data/eastmoney_{code}_snapshot.json。

    钩子使用 *args/**kwargs 以兼容新旧 Scrapy（2.19 起不再向 open/close 传参）。
    """

    def __init__(self, crawler: Crawler):
        self._crawler = crawler
        self._snapshots: list[dict] = []

    @classmethod
    def from_crawler(cls, crawler: Crawler) -> "EastMoneySnapshotPipeline":
        return cls(crawler)

    def open_spider(self, *args, **kwargs) -> None:
        self._snapshots = []

    def process_item(self, item, *args, **kwargs):
        if item.get("type") == "snapshot":
            self._snapshots.append(dict(item))
            # 快照由本 pipeline 单独落盘，不再进入 feed 导出
            raise DropItem("snapshot captured by EastMoneySnapshotPipeline")
        return item

    def close_spider(self, *args, **kwargs) -> None:
        if not self._snapshots:
            return
        DATA_DIR.mkdir(parents=True, exist_ok=True)
        code = self._snapshots[0].get("code", "unknown")
        target = DATA_DIR / f"eastmoney_{code}_snapshot.json"
        payload = {
            "spider": self._crawler.spider.name if self._crawler.spider else "eastmoney_stock",
            "saved_at": datetime.now().isoformat(timespec="seconds"),
            "snapshot": self._snapshots[0],
        }
        target.write_text(json.dumps(payload, ensure_ascii=False, indent=2), encoding="utf-8")
        LOGGER.info("snapshot saved to %s", target)
