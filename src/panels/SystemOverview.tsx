import { useEffect, useState } from 'react'
import type { Metrics, Overview } from '../api.ts'
import { fetchMetrics, fetchOverview } from '../api.ts'
import { IconClock, IconFolder, IconLayers, IconList, IconPlay } from '../icons.tsx'
import { ExecutionRow, SectionCard, TintStat } from '../ui.tsx'
import type { ExecRow } from '../ui.tsx'

function fmtUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  if (days > 0) return `${days} 天 ${hours} 小时`
  return `${hours} 小时 ${Math.floor((seconds % 3600) / 60)} 分钟`
}

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

export function SystemOverview({ tick }: { tick: number }) {
  const [overview, setOverview] = useState<Overview | null>(null)
  const [metrics, setMetrics] = useState<Metrics | null>(null)
  const [error, setError] = useState('')

  useEffect(() => {
    let alive = true
    setError('')
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

  if (error) {
    return (
      <div className="stack">
        <SectionCard icon={<IconList />} tone="orange" title="后端接口不可用" subtitle="请确认 npm run dev 已启动（/api 中间件）">
          <p className="node-line">{error}</p>
        </SectionCard>
      </div>
    )
  }

  if (!overview) {
    return (
      <div className="stack">
        <SectionCard icon={<IconList />} tone="blue" title="加载中" subtitle="正在读取后端真实数据" />
      </div>
    )
  }

  const lastRun = overview.recentRuns[0]
  const lastItems = overview.projects.reduce((max, project) => Math.max(max, project.lastItems ?? 0), 0)

  return (
    <div className="stack">
      <div className="stat-grid">
        <TintStat tone="blue" icon={<IconList />} value={overview.kpi.tasks} label="总任务数" />
        <TintStat tone="green" icon={<IconFolder />} value={overview.kpi.projects} label="爬虫项目" />
        <TintStat tone="purple" icon={<IconPlay />} value={overview.kpi.active} label="活跃任务" />
        <TintStat tone="orange" icon={<IconLayers />} value={overview.kpi.outputs} label="数据产出文件" />
      </div>

      <div className="overview-grid">
        <SectionCard icon={<IconLayers />} tone="blue" title="集群状态" subtitle={`${overview.node.hostname} · ${overview.node.platform}`}>
          <ul className="kv">
            <li>
              <span>在线节点</span>
              <b>1 / 1</b>
            </li>
            <li>
              <span>运行环境</span>
              <b className="ok">Python {overview.node.python} · Scrapy {overview.node.scrapy}</b>
            </li>
            <li>
              <span>逻辑核心</span>
              <b>{overview.node.cpus} 核</b>
            </li>
            <li>
              <span>主机运行时长</span>
              <b>{metrics ? fmtUptime(metrics.uptimeSec) : '—'}</b>
            </li>
          </ul>
        </SectionCard>

        <SectionCard icon={<IconClock />} tone="orange" title="今日爬虫运行" subtitle="来自 data/runs.json 的真实记录">
          <div className="hero-num">
            <strong>{overview.stats.runsToday}</strong>
            <span>次</span>
          </div>
          <span className="hero-label">今日运行 / 成功 {overview.stats.successToday} 次</span>
          <div className="track today-track">
            <div
              className="fill fill-blue"
              style={{ width: `${overview.stats.successRate ?? 0}%` }}
            />
          </div>
          <div className="mini-grid">
            <div>
              <b>{overview.stats.successRate !== null ? `${overview.stats.successRate}%` : '—'}</b>
              <span>成功率</span>
            </div>
            <div>
              <b>{overview.stats.avgDuration !== null ? `${overview.stats.avgDuration}s` : '—'}</b>
              <span>平均耗时</span>
            </div>
            <div>
              <b>{lastRun ? (lastRun.items ?? '—') : 0}</b>
              <span>最近抓取条数</span>
            </div>
            <div>
              <b>{lastItems}</b>
              <span>最大产出集</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard
        icon={<IconFolder />}
        tone="green"
        title="项目与环境"
        subtitle={`${overview.projects.length} 个爬虫项目 · ${overview.envs.length} 个虚拟环境`}
      >
        <div className="overview-grid">
          <div className="dist-list">
            {overview.projects.map((project) => (
              <div className="dist-row" key={project.name}>
                <i className="dot green" />
                <div className="dist-main">
                  <strong>{project.name}</strong>
                  <span>{project.tasks} 任务 · 最近 {project.lastRun ? fmtTime(project.lastRun) : '未运行'}</span>
                </div>
                <b className="dist-count green">{project.lastItems ?? project.tasks}</b>
              </div>
            ))}
          </div>
          <div className="dist-list">
            {overview.envs.map((env) => (
              <div className="dist-row" key={env.name}>
                <i className="dot purple" />
                <div className="dist-main">
                  <strong>{env.name}</strong>
                  <span>{env.tasks} 任务{env.python !== '—' ? ` · Python ${env.python}` : ''}</span>
                </div>
                <b className="dist-count purple">{env.tasks}</b>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={<IconClock />} tone="orange" title="最近执行" subtitle="真实爬虫运行记录（data/runs.json）">
        <div className="exec-grid">
          {overview.recentRuns.length ? (
            overview.recentRuns.map((run) => <ExecutionRow key={run.id} item={toExecRow(run)} />)
          ) : (
            <p className="node-line">还没有运行记录，去「任务管理」触发一次爬虫吧。</p>
          )}
        </div>
      </SectionCard>
    </div>
  )
}
