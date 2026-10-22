import { Select, Tabs } from '@arco-design/web-react'
import { useEffect, useState } from 'react'
import type { KlineItem } from '../api.ts'
import { fetchKline } from '../api.ts'
import { IconBars, IconClock, IconTrend } from '../icons.tsx'
import { TintStat } from '../ui.tsx'
import { KlineChart } from './KlineChart.tsx'
import { ReportsPanel } from './ReportsPanel.tsx'

export function ChartPanel({ tick }: { tick: number }) {
  const [sub, setSub] = useState('trend')
  const [node, setNode] = useState('local')
  const [kline, setKline] = useState<KlineItem[] | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    if (sub !== 'trend') return
    let alive = true
    fetchKline()
      .then((items) => {
        if (alive) setKline(items)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [sub, tick])

  const latest = kline?.at(-1)
  const high = kline?.length ? Math.max(...kline.map((item) => item.high ?? 0)) : null
  const low = kline?.length
    ? Math.min(...kline.map((item) => item.low ?? Number.POSITIVE_INFINITY))
    : null

  return (
    <div className="chart-page">
      <div className="chart-toolbar">
        <h2>监控图表</h2>
        <div className="node-picker">
          <span>选择节点：</span>
          <Select
            value={node}
            style={{ width: 160 }}
            onChange={(value) => {
              if (typeof value === 'string') setNode(value)
            }}
          >
            <Select.Option value="local">本地节点</Select.Option>
          </Select>
        </div>
      </div>

      <Tabs className="sub-tabs capsule-left" type="capsule" size="small" lazyload animation={false} activeTab={sub} onChange={setSub}>
        <Tabs.TabPane key="trend" title="股价走势">
          <section className="panel">
            <div className="panel-head">
              <span className="panel-icon tone-orange">
                <IconClock />
              </span>
              <div className="panel-text">
                <h2>贵州茅台（600519）收盘价</h2>
                <p>最近 120 个交易日 · 真实抓取自东方财富</p>
              </div>
            </div>
            <div className="stat-grid">
              <TintStat tone="blue" icon={<IconTrend />} value={latest ? `¥${Number(latest.close).toFixed(2)}` : '—'} label="最新收盘" />
              <TintStat
                tone={latest && Number(latest.pct_change) >= 0 ? 'green' : 'orange'}
                icon={<IconTrend />}
                value={latest ? `${Number(latest.pct_change) > 0 ? '+' : ''}${Number(latest.pct_change).toFixed(2)}%` : '—'}
                label="当日涨跌幅"
              />
              <TintStat tone="purple" icon={<IconClock />} value={high !== null ? `¥${high.toFixed(2)}` : '—'} label="区间最高" />
              <TintStat tone="orange" icon={<IconBars />} value={low !== null && Number.isFinite(low) ? `¥${low.toFixed(2)}` : '—'} label="区间最低" />
            </div>
            {error ? (
              <p className="node-line">暂无行情数据：{error}（请先在任务管理运行 eastmoney_stock）</p>
            ) : kline ? (
              <KlineChart items={kline} />
            ) : (
              <p className="node-line">加载中…</p>
            )}
          </section>
        </Tabs.TabPane>
        <Tabs.TabPane key="reports" title="研报数据">
          <ReportsPanel />
        </Tabs.TabPane>
      </Tabs>
    </div>
  )
}
