import { useEffect, useState } from 'react'
import type { Overview, RunRecord } from '../api.ts'
import { fetchOverview } from '../api.ts'
import { IconBars, IconClock, IconPulse } from '../icons.tsx'
import { DistList, ExecutionRow, SectionCard, StatusTiles } from '../ui.tsx'
import type { ExecRow } from '../ui.tsx'

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function toExecRow(run: RunRecord): ExecRow {
  return {
    name: run.spider,
    time: fmtTime(run.finishedAt ?? run.startedAt),
    status: run.status === 'success' ? 'success' : 'pending',
    duration: run.durationSec !== null ? `${run.durationSec}s` : '—',
  }
}

export function TaskMonitor({ tick }: { tick: number }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    fetchOverview()
      .then((value) => {
        if (alive) setOverview(value)
      })
      .catch((err: Error) => {
        if (alive) setError(err.message)
      })
    return () => {
      alive = false
    }
  }, [tick])

  if (error || !overview) {
    return (
      <div className="stack">
        <SectionCard
          icon={<IconClock />}
          tone="orange"
          title={error ? '后端接口不可用' : '加载中'}
          subtitle={error || '正在读取后端真实数据'}
        />
      </div>
    )
  }

  const recent = overview.recentRuns.slice(0, 4)

  return (
    <div className="stack">
      <SectionCard icon={<IconClock />} tone="blue" title="任务状态分布" subtitle="来自 data/tasks.json 的真实任务">
        <StatusTiles running={overview.kpi.active} paused={overview.kpi.paused} />
      </SectionCard>

      <div className="split-3">
        <SectionCard icon={<IconClock />} tone="orange" title="最近执行" subtitle="真实爬虫运行记录">
          <div className="exec-list">
            {recent.length ? (
              recent.map((run) => <ExecutionRow key={run.id} item={toExecRow(run)} />)
            ) : (
              <p className="node-line">还没有运行记录</p>
            )}
          </div>
        </SectionCard>

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
  )
}
