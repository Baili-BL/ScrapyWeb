import type { Chart } from '@antv/g2'
import { useMemo, useState } from 'react'
import type { RunRecord } from '../api.ts'
import { Pager } from '../ui.tsx'
import { G2Chart } from './G2Chart.tsx'

const STATUS_LABEL: Record<string, string> = { success: '成功', failed: '失败', running: '运行中' }

type RunBar = {
  id: string
  name: string
  start: number
  end: number
  status: string
  timeLabel: string
  items: number | null
  durationSec: number | null
}

function hourOf(iso: string): number {
  const date = new Date(iso)
  return date.getHours() + date.getMinutes() / 60 + date.getSeconds() / 3600
}

function clockOf(iso: string): string {
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function sameDay(iso: string, date: Date): boolean {
  const run = new Date(iso)
  return run.getFullYear() === date.getFullYear() && run.getMonth() === date.getMonth() && run.getDate() === date.getDate()
}

/** 真实数据：当天爬虫运行甘特图（时间轴 0-24 时，条形 = 运行时段）。 */
export function RunGantt({ runs }: { runs: RunRecord[] }) {
  const now = new Date()
  const [date, setDate] = useState(() => new Date(now.getFullYear(), now.getMonth(), now.getDate()))
  const showNow = date.toDateString() === now.toDateString()
  const nowHour = now.getHours() + now.getMinutes() / 60 + now.getSeconds() / 3600

  const shift = (days: number) => {
    const next = new Date(date)
    next.setDate(date.getDate() + days)
    setDate(next)
  }

  const bars: RunBar[] = useMemo(
    () =>
      runs
        .filter((run) => sameDay(run.startedAt, date))
        .map((run) => {
          const start = hourOf(run.startedAt)
          const realEnd = run.finishedAt ? hourOf(run.finishedAt) : start
          // 真实时长可能只有几秒，最短画 2 分钟宽以保证可见
          const end = Math.min(24, Math.max(start + 2 / 60, realEnd))
          return {
            id: run.id,
            name: run.spider,
            start,
            end,
            status: run.status,
            timeLabel: clockOf(run.startedAt),
            items: run.items,
            durationSec: run.durationSec,
          }
        })
        .sort((a, b) => a.start - b.start),
    [runs, date],
  )

  const summary = {
    runs: bars.length,
    success: bars.filter((bar) => bar.status === 'success').length,
    failed: bars.filter((bar) => bar.status === 'failed').length,
    items: bars.reduce((sum, bar) => sum + (bar.items ?? 0), 0),
  }

  const render = useMemo(
    () => (chart: Chart) => {
      chart.coordinate({ transform: [{ type: 'transpose' }] })
      chart
        .interval()
        .data(bars)
        .encode('x', 'name')
        .encode('y', 'start')
        .encode('y1', 'end')
        .encode('color', 'status')
        .tooltip({
          title: (datum) => `${datum.name} · ${datum.timeLabel}`,
          items: [
            (datum) => ({ name: '状态', value: STATUS_LABEL[datum.status] ?? datum.status }),
            (datum) => ({ name: '抓取条数', value: `${datum.items ?? '—'} 条` }),
            (datum) => ({ name: '耗时', value: `${datum.durationSec ?? '—'}s` }),
          ],
        })

      chart.scale('y', { domainMin: 0, domainMax: 24, nice: false, tickCount: 24 })
      chart.scale('color', {
        domain: ['success', 'failed', 'running'],
        range: ['#3dcb6c', '#f53f3f', '#165dff'],
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
          .label({
            text: `${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`,
            position: 'top',
            dx: 4,
            dy: 2,
            fill: '#f53f3f',
            fontSize: 10,
          })
      }
    },
    [bars, showNow, nowHour, now],
  )

  return (
    <section className="panel">
      <Pager
        title={`${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日`}
        prevLabel="前一天"
        nextLabel="后一天"
        onPrev={() => shift(-1)}
        onNext={() => shift(1)}
        extra={
          showNow ? null : (
            <button
              type="button"
              className="today-link"
              onClick={() => setDate(new Date(now.getFullYear(), now.getMonth(), now.getDate()))}
            >
              回到今天
            </button>
          )
        }
      />
      <div className="gantt-summary">
        <span>运行 {summary.runs} 次</span>
        <span>成功 {summary.success}</span>
        <span>失败 {summary.failed}</span>
        <span>抓取 {summary.items} 条</span>
      </div>
      {bars.length === 0 ? (
        <p className="node-line">这一天没有运行记录（切换日期或先运行一次爬虫）。</p>
      ) : (
        <G2Chart render={render} className="gantt-chart" ariaLabel="当天爬虫运行甘特图，绿色为成功，红色为失败，蓝色为运行中" />
      )}
    </section>
  )
}
