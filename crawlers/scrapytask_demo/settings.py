# -*- coding: utf-8 -*-
"""Scrapy 设置：礼貌抓取，utf-8 输出。"""

from pathlib import Path

BOT_NAME = "scrapytask_demo"

SPIDER_MODULES = ["scrapytask_demo.spiders"]
NEWSPIDER_MODULE = "scrapytask_demo.spiders"

# 遵守 robots.txt，限速限并发，仅抓公开数据
ROBOTSTXT_OBEY = True
CONCURRENT_REQUESTS = 4
CONCURRENT_REQUESTS_PER_DOMAIN = 2
DOWNLOAD_DELAY = 0.5
DOWNLOAD_TIMEOUT = 30

DEFAULT_REQUEST_HEADERS = {
    "Accept": "text/html,application/xhtml+xml,application/json;q=0.9,*/*;q=0.8",
    "Accept-Language": "zh-CN,zh;q=0.9,en;q=0.8",
}

USER_AGENT = (
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 "
    "(KHTML, like Gecko) Chrome/124.0 Safari/537.36 ScrapyTaskDemo/1.0"
)

ITEM_PIPELINES = {
    "scrapytask_demo.pipelines.EastMoneySnapshotPipeline": 300,
}

FEED_EXPORT_ENCODING = "utf-8"
FEED_EXPORT_INDENT = 2

# RemoteControl 扩展的任务目录放到工程内，避免写 AppData 被拒
REMOTE_CONTROL_JOBS_DIR = str(Path(__file__).resolve().parents[1] / ".scrapy_jobs")

LOG_LEVEL = "INFO"

REQUEST_FINGERPRINTER_IMPLEMENTATION = "2.7"
TWISTED_REACTOR = "twisted.internet.asyncioreactor.AsyncioSelectorReactor"
