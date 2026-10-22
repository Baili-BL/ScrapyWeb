# -*- coding: utf-8 -*-
"""项目二：第一创业期货官网研究报告爬虫。

fcfco.cn 是第一创业期货的旧域名，现跳转到 https://futures.fcsc.com/。
「一创研究」栏目地址为 /catalog_37.aspx，列表分页参数 ?Page=N。

每条报告产出一条 ResearchReportItem：
- 标题、日期、详情链接来自列表页；
- 详情页里再提取站内正文摘要、站内附件（PDF 等）、正文外链（如微信公众号文章）。

用法：
    scrapy crawl fcfco_reports -O ../data/fcfco_reports.json
    scrapy crawl fcfco_reports -a pages=5 -O ../data/fcfco_reports.json
"""

import re
from datetime import datetime

import scrapy

from scrapytask_demo.items import ResearchReportItem

ATTACH_RE = re.compile(r"\.(pdf|docx?|xlsx?|pptx?|zip)(\?|#|$)", re.I)
ARTICLE_ID_RE = re.compile(r"D=17,(\d+)")


class FcfcoReportsSpider(scrapy.Spider):
    name = "fcfco_reports"
    allowed_domains = ["futures.fcsc.com"]

    custom_settings = {"DOWNLOAD_DELAY": 1.0}

    def __init__(self, pages="3", *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.pages = max(1, int(pages))

    async def start(self):
        base = "https://futures.fcsc.com/catalog_37.aspx"
        for page in range(1, self.pages + 1):
            url = base if page == 1 else f"{base}?Page={page}"
            yield scrapy.Request(url, callback=self.parse_list, meta={"page": page})

    def parse_list(self, response):
        page = response.meta["page"]
        anchors = response.xpath('//a[contains(@href, "Detail.aspx")]')
        count = 0
        for anchor in anchors:
            href = anchor.attrib.get("href", "")
            match = ARTICLE_ID_RE.search(href)
            if not match:
                continue
            date_text = anchor.xpath(
                'ancestor::tr[1]//span[contains(@class,"orage2")]/text()'
            ).get(default="").strip().strip("() ")

            item = ResearchReportItem()
            item["source"] = "第一创业期货 fcfco.cn"
            item["category"] = "一创研究"
            item["article_id"] = match.group(1)
            item["title"] = " ".join(anchor.xpath(".//text()").getall()).strip()
            item["date"] = date_text or None
            item["detail_url"] = response.urljoin(href)
            item["outbound_url"] = None
            item["attachments"] = []
            item["body_text"] = None
            item["crawled_at"] = datetime.now().isoformat(timespec="seconds")

            count += 1
            yield scrapy.Request(item["detail_url"], callback=self.parse_detail, meta={"item": item})
        self.logger.info("list page %s: %s reports", page, count)

    def parse_detail(self, response):
        item = response.meta["item"]
        content = response.css("#fcfco_content")

        page_title = response.css(".js_title_inner ::text").getall()
        if page_title:
            item["title"] = " ".join(t.strip() for t in page_title).strip() or item["title"]

        if content:
            links = [l for l in content.xpath(".//a/@href").getall() if l]
            outbound = [
                response.urljoin(l)
                for l in links
                if l.startswith(("http://", "https://")) and "futures.fcsc.com" not in l
            ]
            item["outbound_url"] = outbound[0] if outbound else None
            item["attachments"] = [response.urljoin(l) for l in links if ATTACH_RE.search(l)]
            text = " ".join(t.strip() for t in content.xpath(".//text()").getall() if t.strip())
            item["body_text"] = re.sub(r"\s+", " ", text)[:2000] or None

        yield item
