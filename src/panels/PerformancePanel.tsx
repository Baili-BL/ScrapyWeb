import { useEffect, useState } from 'react'
import type { Metrics } from '../api.ts'
import { fetchMetrics } from '../api.ts'
import { IconCpu, IconDisk, IconPulse } from '../icons.tsx'
import { CoreGrid, DiskUsage, MemoryBar, MetricTile, SectionCard } from '../ui.tsx'

function fmtUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  if (days > 0) return `${days}天${hours}时`
  return `${hours}时${minutes}分`
}

export function PerformancePanel({ tick }: { tick: number }) {
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchMetrics()
      .then((value) => {
        if (alive) setMetrics(value)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [tick])

  if (error || !metrics) {
    return (
      <div className="stack">
        <SectionCard
          icon={<IconCpu />}
          tone="blue"
          title={error ? '后端接口不可用' : '加载中'}
          subtitle={error || '正在采样真实系统指标'}
        />
      </div>
    )
  }

  const cpuPeak = metrics.cpu.cores.length ? Math.max(...metrics.cpu.cores) : 0

  return (
    <div className="stack">
      <SectionCard icon={<IconCpu />} tone="blue" title="CPU 性能" subtitle={`${metrics.cpu.cores.length} 逻辑核心（250ms 采样）`}>
        <div className="metric-grid">
          <MetricTile value={`${metrics.cpu.avg}%`} label="平均占用" color="#00b42a" />
          <MetricTile value={`${cpuPeak}%`} label="单核峰值" color="#ff7d00" />
          <MetricTile value={`${metrics.cpu.cores.length} 核`} label="逻辑核心" color="#165dff" />
          <MetricTile value={fmtUptime(metrics.uptimeSec)} label="主机运行时长" color="#f53f3f" />
        </div>
        <div className="core-block">
          <CoreGrid cores={metrics.cpu.cores} />
        </div>
      </SectionCard>

      <SectionCard icon={<IconPulse />} tone="green" title="内存性能" subtitle={`总计：${metrics.memory.totalGb.toFixed(2)} GB`}>
        <div className="metric-grid">
          <MetricTile value={`${metrics.memory.percent.toFixed(1)}%`} label="已用 %" color="#ff7d00" />
          <MetricTile value={`${metrics.memory.usedGb.toFixed(2)} GB`} label="已用容量" color="#165dff" />
          <MetricTile value={`${metrics.memory.availableMb.toFixed(0)} MB`} label="可用" color="#00b42a" />
          <MetricTile value={`${metrics.memory.totalGb.toFixed(2)} GB`} label="物理内存总量" color="#722ed1" />
        </div>
        <MemoryBar usedGb={metrics.memory.usedGb} totalGb={metrics.memory.totalGb} percent={metrics.memory.percent} />
      </SectionCard>

      <SectionCard icon={<IconDisk />} tone="purple" title="磁盘使用情况" subtitle="项目所在卷 · fs.statfs 实时读取">
        <DiskUsage disk={metrics.disk} />
      </SectionCard>
    </div>
  )
}
