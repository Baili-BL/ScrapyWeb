import { Space, Tag } from '@arco-design/web-react'
import { useEffect, useState } from 'react'
import type { Metrics, Overview } from '../api.ts'
import { fetchMetrics, fetchOverview } from '../api.ts'
import { IconBars, IconDesktop, IconPulse } from '../icons.tsx'
import { CoreGrid, DiskUsage, DistList, ExecutionRow, MemoryBar, MetricTile, SectionCard, StatusTiles } from '../ui.tsx'
import type { ExecRow } from '../ui.tsx'
import { NODE } from '../data.ts'

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function toExecRow(run: Overview['recentRuns'][number]): ExecRow {
  return {
    name: run.spider,
    time: fmtTime(run.finishedAt ?? run.startedAt),
    status: run.status === 'success' ? 'success' : 'pending',
    duration: run.durationSec !== null ? `${run.durationSec}s` : '—',
  }
}

export function WorkerNodes({ tick }: { tick: number }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    Promise.all([fetchOverview(), fetchMetrics()])
      .then(([nextOverview, nextMetrics]) => {
        if (!alive) return
        setOverview(nextOverview)
        setMetrics(nextMetrics)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [tick])

  if (error || !overview || !metrics) {
    return (
      <div className="stack">
        <SectionCard
          icon={<IconDesktop />}
          tone="blue"
          title={error ? '后端接口不可用' : '加载中'}
          subtitle={error || '正在读取真实系统指标'}
        />
      </div>
    )
  }

  const latest = overview.recentRuns[0]
  const cpuPeak = metrics.cpu.cores.length ? Math.max(...metrics.cpu.cores) : 0

  return (
    <div className="stack">
      <SectionCard
        icon={<IconDesktop />}
        tone="blue"
        title={overview.node.hostname}
        subtitle={`${overview.node.platform} · Python ${overview.node.python} · Scrapy ${overview.node.scrapy}`}
        extra={
          <Space size={8}>
            <Tag color="green">在线</Tag>
            <Tag>{NODE.role}</Tag>
          </Space>
        }
      >
        <p className="node-line">
          {overview.node.cpus} 逻辑核心 · 心跳 {fmtTime(metrics.ts)} · 主机运行 {Math.floor(metrics.uptimeSec / 3600)} 小时
        </p>
        <div className="metric-grid">
          <MetricTile value={`${metrics.cpu.avg}%`} label="CPU 平均占用" color="#00b42a" />
          <MetricTile value={`${metrics.memory.percent.toFixed(1)}%`} label="内存已用" color="#ff7d00" />
          <MetricTile value={`${metrics.disk.percent.toFixed(1)}%`} label="磁盘已用" color="#f53f3f" />
          <MetricTile value={`${metrics.cpu.cores.length} 核`} label="逻辑核心" color="#165dff" />
        </div>
        <div className="overview-grid resource-split">
          <CoreGrid cores={metrics.cpu.cores} />
          <MemoryBar
            className="mem-flat"
            usedGb={metrics.memory.usedGb}
            totalGb={metrics.memory.totalGb}
            percent={metrics.memory.percent}
          />
        </div>
      </SectionCard>

      <div className="overview-grid">
        <SectionCard icon={<IconPulse />} tone="purple" title="节点调度" subtitle="来自后端的任务与最近运行">
          <StatusTiles running={overview.kpi.active} paused={overview.kpi.paused} />
          {latest ? (
            <div className="latest-block">
              <ExecutionRow item={toExecRow(latest)} />
            </div>
          ) : null}
        </SectionCard>
        <div className="stack">
          <SectionCard icon={<IconBars />} tone="green" title="项目任务分布" subtitle="按项目统计">
            <DistList
              items={overview.projects.map((project) => ({ name: project.name, tasks: project.tasks }))}
              tone="green"
            />
          </SectionCard>
          <SectionCard icon={<IconPulse />} tone="purple" title="环境任务分布" subtitle="按环境统计">
            <DistList items={overview.envs.map((env) => ({ name: env.name, tasks: env.tasks }))} tone="purple" />
          </SectionCard>
        </div>
      </div>

      <SectionCard icon={<IconPulse />} tone="purple" title="磁盘使用情况" subtitle={`CPU 峰值 ${cpuPeak}%（单核采样）`}>
        <DiskUsage disk={metrics.disk} />
      </SectionCard>
    </div>
  )
}
