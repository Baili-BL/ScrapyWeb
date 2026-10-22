import type { Chart } from '@antv/g2'
import { useMemo, useState } from 'react'
import { DEMO_NOW, daySummary, executionsFor, formatDayTitle, isSameDay } from '../data.ts'
import { Pager } from '../ui.tsx'
import { G2Chart } from './G2Chart.tsx'

const STATUS_LABEL: Record<string, string> = { success: '已完成', pending: '待执行' }

type Segment = {
  id: string
  name: string
  time: string
  status: string
  duration: string
  start: number
  end: number
}

/** 把执行记录展开为甘特图的时间段（每条占半小时，第二个任务从半点开始）。 */
function buildSegments(date: Date): Segment[] {
  const seen = new Map<number, number>()
  return executionsFor(date).map((item) => {
    const index = seen.get(item.hour) ?? 0
    seen.set(item.hour, index + 1)
    const start = item.hour + index * 0.5
    return {
      id: item.id,
      name: item.name,
      time: item.time,
      status: item.status,
      duration: item.duration,
      start,
      end: start + 0.5,
    }
  })
}

function formatClock(date: Date): string {
  const hh = String(date.getHours()).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${hh}:${mm}`
}

export function GanttChart() {
  const [date, setDate] = useState(() => new Date(DEMO_NOW))
  const summary = daySummary(date)
  const showNow = isSameDay(date, DEMO_NOW)
  const nowHour = DEMO_NOW.getHours() + DEMO_NOW.getMinutes() / 60
  const nowLabel = formatClock(DEMO_NOW)

  const shift = (days: number) => {
    const next = new Date(date)
    next.setDate(date.getDate() + days)
    setDate(next)
  }

  const render = useMemo(
    () => (chart: Chart) => {
      const segments = buildSegments(date)

      chart.coordinate({ transform: [{ type: 'transpose' }] })
      chart
        .interval()
        .data(segments)
        .encode('x', 'name')
        .encode('y', 'start')
        .encode('y1', 'end')
        .encode('color', 'status')
        .tooltip({
          title: (datum) => datum.time,
          items: [
            (datum) => ({ name: '状态', value: STATUS_LABEL[datum.status] ?? datum.status }),
            (datum) => ({ name: '耗时', value: datum.duration }),
          ],
        })

      chart.scale('y', { domainMin: 0, domainMax: 24, nice: false, tickCount: 24 })
      chart.scale('color', {
        domain: ['success', 'pending'],
        range: ['#3dcb6c', '#e5e6eb'],
        formatter: (value: string) => STATUS_LABEL[value] ?? value,
      })

      chart.axis('x', false)
      chart.axis('y', {
        showLine: false,
        showTick: false,
        labelFontSize: 11,
        labelFill: '#b0b6c0',
        labelFormatter: (value: number) => (value === 24 ? '' : String(value)),
      })

      chart.legend('color', { position: 'bottom' })

      if (showNow) {
        chart
          .lineY()
          .data([nowHour])
          .style('stroke', '#f53f3f')
          .style('lineWidth', 1)
          .style('lineDash', [4, 3])
          .label({ text: nowLabel, position: 'top', dx: 4, dy: 2, fill: '#f53f3f', fontSize: 10 })
      }
    },
    [date, showNow, nowHour, nowLabel],
  )

  return (
    <section className="panel">
      <Pager
        title={formatDayTitle(date)}
        prevLabel="前一天"
        nextLabel="后一天"
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        extra={
          showNow ? null : (
            <button type="button" className="today-link" onClick={() => setDate(new Date(DEMO_NOW))}>
              回到今天
            </button>
          )
        }
      />
      <div className="gantt-summary">
        <span>计划 {summary.planned}</span>
        <span>已完成 {summary.done}</span>
        <span>待执行 {summary.pending}</span>
      </div>
      <G2Chart render={render} className="gantt-chart" ariaLabel="当天任务甘特图，绿条为已完成，灰条为待执行，红色虚线为当前时间" />
    </section>
  )
}
