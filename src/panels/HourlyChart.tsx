import type { Chart } from '@antv/g2'
import { useMemo } from 'react'
import { densitySeries } from '../data.ts'
import { G2Chart } from './G2Chart.tsx'

/** 与原 ECharts 版本一致的渐变面积填充（自上而下淡出）。 */
const AREA_GRADIENT =
  'linear-gradient(180deg, rgba(122, 166, 255, 0.62) 0%, rgba(146, 184, 255, 0.28) 55%, rgba(186, 210, 255, 0.05) 100%)'

export function HourlyChart() {
  const render = useMemo(
    () => (chart: Chart) => {
      const data = densitySeries().map((point, index) => ({ ...point, step: index / 4 }))

      chart
        .area()
        .data(data)
        .encode('x', 'step')
        .encode('y', 'value')
        .style('fill', AREA_GRADIENT)
        .tooltip({
          title: (datum) => `${datum.hour}:00`,
          items: [(datum) => ({ name: '计划', value: `${datum.count} 个任务` })],
        })

      chart
        .line()
        .data(data)
        .encode('x', 'step')
        .encode('y', 'value')
        .style('stroke', '#7aa6ff')
        .style('lineWidth', 1.6)
        .tooltip(false)

      chart.scale('x', { domainMin: 0, domainMax: 23, nice: false, tickCount: 24 })
      chart.scale('y', { domainMin: 0, domainMax: 2.08, nice: false, tickCount: 5 })

      chart.axis('x', {
        showLine: false,
        showTick: false,
        labelFontSize: 11,
        labelFill: '#b0b6c0',
        labelFormatter: (value: number) => `${value}:00`,
      })
      chart.axis('y', {
        showLine: false,
        showTick: false,
        labelFontSize: 11,
        labelFill: '#b0b6c0',
        gridStroke: '#e5e8ef',
        gridLineDash: [4, 4],
        labelFormatter: (value: number) => (Number.isInteger(value) ? String(value) : value.toFixed(1)),
      })

      chart.interaction('tooltip', { crosshairs: true })
    },
    [],
  )

  return <G2Chart render={render} className="chart-box" ariaLabel="今日任务小时分布，0 点、14 点和 20 点为峰值" />
}
