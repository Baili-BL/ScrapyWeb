import { Space, Tag } from '@arco-design/web-react'
import { ENVS, NODE, PROJECTS, DISK, metricsAt, recentExecutions } from '../data.ts'
import { IconBars, IconDesktop, IconDisk, IconPulse } from '../icons.tsx'
import { CoreGrid, DiskUsage, DistList, ExecutionRow, MemoryBar, MetricTile, SectionCard, StatusTiles } from '../ui.tsx'

export function WorkerNodes({ tick }: { tick: number }) {
  const metrics = metricsAt(tick)
  const latest = recentExecutions()[0]

  return (
    <div className="stack">
      <SectionCard
        icon={<IconDesktop />}
        tone="blue"
        title={NODE.name}
        subtitle={`${NODE.host} · ${NODE.os} ${NODE.arch} · Python ${NODE.python}`}
        extra={
          <Space size={8}>
            <Tag color="green">在线</Tag>
            <Tag>{NODE.role}</Tag>
          </Space>
        }
      >
        <p className="node-line">
          {NODE.cores} 核心 · {NODE.frequency} · 心跳 {NODE.heartbeat}
        </p>
        <div className="metric-grid">
          <MetricTile value={`${metrics.cpuAvg.toFixed(1)}%`} label="平均占用" color="#00b42a" />
          <MetricTile value={`${metrics.memUsedPercent.toFixed(1)}%`} label="内存已用" color="#ff7d00" />
          <MetricTile value={metrics.load1.toFixed(2)} label="1 分钟负载均值" color="#f53f3f" />
          <MetricTile value={`${metrics.cores.length} 核`} label="逻辑核心" color="#165dff" />
        </div>
        <div className="overview-grid resource-split">
          <CoreGrid cores={metrics.cores} />
          <MemoryBar
            className="mem-flat"
            usedGb={metrics.memUsedGb}
            totalGb={NODE.memTotalGb}
            percent={metrics.memUsedPercent}
          />
        </div>
      </SectionCard>

      <div className="overview-grid">
        <SectionCard icon={<IconPulse />} tone="purple" title="节点调度" subtitle="当前节点上的任务配置">
          <StatusTiles />
          {latest ? (
            <div className="latest-block">
              <ExecutionRow item={latest} />
            </div>
          ) : null}
        </SectionCard>
        <div className="stack">
          <SectionCard icon={<IconBars />} tone="green" title="项目任务分布" subtitle="按项目统计">
            <DistList items={PROJECTS} tone="green" />
          </SectionCard>
          <SectionCard icon={<IconPulse />} tone="purple" title="环境任务分布" subtitle="按环境统计">
            <DistList items={ENVS} tone="purple" />
          </SectionCard>
        </div>
      </div>

      <SectionCard icon={<IconDisk />} tone="purple" title="磁盘使用情况" subtitle={`分区: ${DISK.mounts.length}`}>
        <DiskUsage />
      </SectionCard>
    </div>
  )
}
