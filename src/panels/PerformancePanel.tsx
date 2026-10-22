import { NODE, DISK, metricsAt } from '../data.ts'
import { IconCpu, IconDisk, IconPulse } from '../icons.tsx'
import { CoreGrid, DiskUsage, MemoryBar, MetricTile, SectionCard } from '../ui.tsx'

export function PerformancePanel({ tick }: { tick: number }) {
  const metrics = metricsAt(tick)

  return (
    <div className="stack">
      <SectionCard icon={<IconCpu />} tone="blue" title="CPU 性能" subtitle={`${NODE.cores} 核心`}>
        <div className="metric-grid">
          <MetricTile value={`${metrics.cpuAvg.toFixed(1)}%`} label="平均占用" color="#00b42a" />
          <MetricTile value={NODE.frequency} label="当前频率" color="#00b42a" />
          <MetricTile value={`${metrics.cpuPeak.toFixed(1)}%`} label="峰值占用" color="#00b42a" />
          <MetricTile value={metrics.load1.toFixed(2)} label="1 分钟负载均值" color="#f53f3f" />
        </div>
        <div className="core-block">
          <CoreGrid cores={metrics.cores} />
        </div>
      </SectionCard>

      <SectionCard icon={<IconPulse />} tone="green" title="内存性能" subtitle={`总计：${NODE.memTotalGb.toFixed(2)} GB`}>
        <div className="metric-grid">
          <MetricTile value={`${metrics.memUsedPercent.toFixed(1)}%`} label="已用 %" color="#ff7d00" />
          <MetricTile value={`${metrics.memAvailableMb.toFixed(2)} MB`} label="可用" color="#165dff" />
          <MetricTile value={`${metrics.memCacheMb.toFixed(2)} MB`} label="缓存" color="#722ed1" />
          <MetricTile value={`${metrics.swapPercent.toFixed(1)}%`} label="交换分区占用" color="#ff7d00" />
        </div>
        <MemoryBar usedGb={metrics.memUsedGb} totalGb={NODE.memTotalGb} percent={metrics.memUsedPercent} />
      </SectionCard>

      <SectionCard icon={<IconDisk />} tone="purple" title="磁盘使用情况" subtitle={`分区: ${DISK.mounts.length}`}>
        <DiskUsage />
      </SectionCard>
    </div>
  )
}
