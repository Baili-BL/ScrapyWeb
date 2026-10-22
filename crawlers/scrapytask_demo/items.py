# -*- coding: utf-8 -*-
"""两个抓取项目的数据模型。"""

from scrapy import Field, Item


class KlineItem(Item):
    """东方财富日线（一交易一条）。"""

    type = Field()          # 'kline'
    code = Field()          # 股票代码，如 600519
    name = Field()          # 股票名称，如 贵州茅台
    date = Field()          # 交易日 YYYY-MM-DD
    open = Field()          # 开盘价
    close = Field()         # 收盘价
    high = Field()          # 最高价
    low = Field()           # 最低价
    volume = Field()        # 成交量（手）
    amount = Field()        # 成交额（元）
    amplitude = Field()     # 振幅 %
    pct_change = Field()    # 涨跌幅 %
    change = Field()        # 涨跌额
    turnover = Field()      # 换手率 %


class SnapshotItem(Item):
    """东方财富实时快照（一次抓取一条）。"""

    type = Field()          # 'snapshot'
    code = Field()
    name = Field()
    price = Field()         # 最新价
    prev_close = Field()    # 昨收
    open = Field()
    high = Field()
    low = Field()
    volume = Field()
    amount = Field()
    pct_change = Field()
    amplitude = Field()
    turnover = Field()
    pe_ttm = Field()        # 市盈率（动）
    market_cap = Field()    # 总市值（元）
    float_cap = Field()     # 流通市值（元）
    fetched_at = Field()    # 抓取时间


class ResearchReportItem(Item):
    """一创研究报告（一报告一条）。"""

    source = Field()        # 来源站点名
    category = Field()      # 栏目名，如 一创研究
    article_id = Field()    # 详情页数字 id
    title = Field()
    date = Field()          # 列表页日期 YYYY-MM-DD
    detail_url = Field()
    outbound_url = Field()  # 正文外链（如微信公众号文章），可为空
    attachments = Field()   # 站内附件（PDF/DOC 等）绝对链接列表
    body_text = Field()     # 站内正文摘要（前 2000 字）
    crawled_at = Field()
