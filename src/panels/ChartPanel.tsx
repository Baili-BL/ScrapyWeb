import { Select, Tabs } from '@arco-design/web-react'
import { useState } from 'react'
import { DEMO_NOW, formatAverage, formatShare, planSummary } from '../data.ts'
import { IconClock, IconList, IconPulse, IconTrend } from '../icons.tsx'
import { TintStat } from '../ui.tsx'
import { DayDrawer } from './DayDrawer.tsx'
import { GanttChart } from './GanttChart.tsx'
import { HourlyChart } from './HourlyChart.tsx'
import { TaskCalendar } from './TaskCalendar.tsx'

export function ChartPanel() {
  const [sub, setSub] = useState('trend')
  const [node, setNode] = useState('local')
  const [drawerDate, setDrawerDate] = useState<Date | null>(null)
  const peak = planSummary(DEMO_NOW)

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
        <Tabs.TabPane key="trend" title="趋势概览">
          <section className="panel">
            <div className="panel-head">
              <span className="panel-icon tone-orange">
                <IconClock />
              </span>
              <div className="panel-text">
                <h2>任务小时分布</h2>
                <p>展示一天内各时间段的任务密度</p>
              </div>
            </div>
            <div className="stat-grid">
              <TintStat tone="blue" icon={<IconList />} value={peak.total} label="今日任务" />
              <TintStat tone="green" icon={<IconTrend />} value={`${peak.peakHour}:00`} label="最活跃" />
              <TintStat tone="purple" icon={<IconPulse />} value={peak.peakCount} label={`${formatShare(peak.peakCount, peak.total)} 占总数`} />
              <TintStat tone="orange" icon={<IconClock />} value={formatAverage(peak.average)} label="任务/小时" />
            </div>
            <HourlyChart />
          </section>
        </Tabs.TabPane>
        <Tabs.TabPane key="calendar" title="任务日历">
          <TaskCalendar onOpen={setDrawerDate} />
        </Tabs.TabPane>
        <Tabs.TabPane key="gantt" title="甘特图">
          <GanttChart />
        </Tabs.TabPane>
      </Tabs>

      <DayDrawer date={drawerDate} onClose={() => setDrawerDate(null)} />
    </div>
  )
}
