import type { Chart } from '@antv/g2'
import { useMemo } from 'react'
import type { KlineItem } from '../api.ts'
import { G2Chart } from './G2Chart.tsx'

/** 真实数据：贵州茅台近 120 个交易日收盘价（G2 面积图）。 */
export function KlineChart({ items }: { items: KlineItem[] }) {
  const render = useMemo(
    () => (chart: Chart) => {
      const data = items.map((item, index) => ({ ...item, i: index }))
      const labelAt = (value: number) => {
        const item = items[Math.round(value)]
        return item ? item.date.slice(5) : ''
      }

      chart
        .area()
        .data(data)
        .encode('x', 'i')
        .encode('y', 'close')
        .style('fill', 'linear-gradient(180deg, rgba(122, 166, 255, 0.55) 0%, rgba(146, 184, 255, 0.22) 55%, rgba(186, 210, 255, 0.04) 100%)')
        .tooltip({
          title: (datum) => `${datum.date}（${datum.name}）`,
          items: [
            (datum) => ({ name: '收盘', value: `¥${Number(datum.close).toFixed(2)}` }),
            (datum) => ({
              name: '涨跌幅',
              value: `${Number(datum.pct_change) > 0 ? '+' : ''}${Number(datum.pct_change).toFixed(2)}%`,
            }),
          ],
        })

      chart
        .line()
        .data(data)
        .encode('x', 'i')
        .encode('y', 'close')
        .style('stroke', '#7aa6ff')
        .style('lineWidth', 1.6)
        .tooltip(false)

      chart.scale('x', { domainMin: 0, domainMax: Math.max(1, items.length - 1), nice: false, tickCount: 8 })
      chart.scale('y', { nice: true })

      chart.axis('x', {
        showLine: false,
        showTick: false,
        labelFontSize: 11,
        labelFill: '#b0b6c0',
        labelFormatter: (value: number) => labelAt(value),
      })
      chart.axis('y', {
        showLine: false,
        showTick: false,
        labelFontSize: 11,
        labelFill: '#b0b6c0',
        gridStroke: '#e5e8ef',
        gridLineDash: [4, 4],
      })

      chart.interaction('tooltip', { crosshairs: true })
    },
    [items],
  )

  return <G2Chart render={render} className="chart-box" ariaLabel="贵州茅台近 120 个交易日收盘价走势图" />
}
