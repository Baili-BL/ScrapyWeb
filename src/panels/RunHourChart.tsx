import type { Chart } from '@antv/g2'
import { useMemo } from 'react'
import type { RunRecord } from '../api.ts'
import { G2Chart } from './G2Chart.tsx'

export type HourBucket = { label: string; hour: number; count: number; items: number }

/** 按小时聚合真实运行记录（本地时区）。 */
export function bucketRunsByHour(runs: RunRecord[]): HourBucket[] {
  const buckets: HourBucket[] = Array.from({ length: 24 }, (_, hour) => ({
    label: `${hour}时`,
    hour,
    count: 0,
    items: 0,
  }))
  for (const run of runs) {
    const hour = new Date(run.startedAt).getHours()
    buckets[hour].count += 1
    buckets[hour].items += run.items ?? 0
  }
  return buckets
}

/** 真实数据：爬虫运行的小时分布（全部运行历史）。 */
export function RunHourChart({ runs }: { runs: RunRecord[] }) {
  const render = useMemo(
    () => (chart: Chart) => {
      const buckets = bucketRunsByHour(runs)

      chart
        .interval()
        .data(buckets)
        .encode('x', 'label')
        .encode('y', 'count')
        .style('fill', '#7aa6ff')
        .style('radius', 3)
        .tooltip({
          title: (datum) => `${datum.label}`,
          items: [
            (datum) => ({ name: '运行次数', value: `${datum.count} 次` }),
            (datum) => ({ name: '抓取条数', value: `${datum.items} 条` }),
          ],
        })

      chart.scale('x', { paddingInner: 0.35, paddingOuter: 0.2 })
      chart.scale('y', { domainMin: 0, nice: true, tickCount: 5 })

      chart.axis('x', {
        showLine: false,
        showTick: false,
        labelFontSize: 10,
        labelFill: '#b0b6c0',
      })
      chart.axis('y', {
        showLine: false,
        showTick: false,
        labelFontSize: 11,
        labelFill: '#b0b6c0',
        gridStroke: '#e5e8ef',
        gridLineDash: [4, 4],
        labelFormatter: (value: number) => String(Math.round(value)),
      })

      chart.interaction('tooltip', { crosshairs: true })
    },
    [runs],
  )

  return <G2Chart render={render} className="chart-box" ariaLabel="爬虫运行小时分布柱状图" />
}
