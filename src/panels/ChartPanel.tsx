import { Select, Tabs } from '@arco-design/web-react'
import { useEffect, useMemo, useState } from 'react'
import type { Overview, RunRecord } from '../api.ts'
import { fetchOverview, fetchRuns } from '../api.ts'
import { IconBars, IconClock, IconList, IconPulse } from '../icons.tsx'
import { TintStat } from '../ui.tsx'
import { bucketRunsByHour, RunHourChart } from './RunHourChart.tsx'
import { RunCalendar } from './RunCalendar.tsx'
import { RunGantt } from './RunGantt.tsx'
import { ReportsPanel } from './ReportsPanel.tsx'

export function ChartPanel({ tick }: { tick: number }) {
  const [sub, setSub] = useState('hour')
  const [node, setNode] = useState('local')
  const [runs, setRuns] = useState<RunRecord[] | null>(null)
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([fetchRuns(undefined, 200), fetchOverview()])
      .then(([runList, nextOverview]) => {
        if (!alive) return
        setRuns(runList)
        setOverview(nextOverview)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [tick])

  const busiestHour = useMemo(() => {
    if (!runs?.length) return null
    const buckets = bucketRunsByHour(runs).filter((bucket) => bucket.count > 0)
    if (!buckets.length) return null
    return buckets.reduce((top, bucket) => (bucket.count > top.count ? bucket : top))
  }, [runs])

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
        <Tabs.TabPane key="hour" title="任务小时分布">
          <section className="panel">
            <div className="panel-head">
              <span className="panel-icon tone-orange">
                <IconClock />
              </span>
              <div className="panel-text">
                <h2>爬虫运行小时分布</h2>
                <p>按小时统计全部真实运行记录（data/runs.json）</p>
              </div>
            </div>
            <div className="stat-grid">
              <TintStat tone="blue" icon={<IconList />} value={overview?.stats.runsToday ?? '—'} label="今日运行次数" />
              <TintStat
                tone="green"
                icon={<IconClock />}
                value={busiestHour ? busiestHour.label.replace('时', ':00') : '—'}
                label="最活跃小时"
              />
              <TintStat
                tone="purple"
                icon={<IconPulse />}
                value={busiestHour ? `${busiestHour.count} 次` : '—'}
                label="该小时运行数"
              />
              <TintStat
                tone="orange"
                icon={<IconBars />}
                value={overview?.stats.avgDuration !== null && overview ? `${overview.stats.avgDuration}s` : '—'}
                label="平均耗时"
              />
            </div>
            {error ? (
              <p className="node-line">后端接口不可用：{error}</p>
            ) : runs === null ? (
              <p className="node-line">加载中…</p>
            ) : (
              <RunHourChart runs={runs} />
            )}
          </section>
        </Tabs.TabPane>
        <Tabs.TabPane key="calendar" title="任务日历">
          {runs === null ? <p className="node-line">加载中…</p> : <RunCalendar runs={runs} />}
        </Tabs.TabPane>
        <Tabs.TabPane key="gantt" title="运行甘特图">
          {runs === null ? <p className="node-line">加载中…</p> : <RunGantt runs={runs} />}
        </Tabs.TabPane>
        <Tabs.TabPane key="reports" title="研报数据">
          <ReportsPanel />
        </Tabs.TabPane>
      </Tabs>
    </div>
  )
}
