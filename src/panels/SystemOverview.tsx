import {
  DEMO_NOW,
  ENVS,
  KPI,
  NODE,
  PROJECTS,
  averageDuration,
  daySummary,
  planSummary,
  recentExecutions,
  successRate,
} from '../data.ts'
import { IconClock, IconFolder, IconLayers, IconList, IconPlay } from '../icons.tsx'
import { ExecutionRow, SectionCard, TintStat } from '../ui.tsx'

export function SystemOverview() {
  const summary = daySummary(DEMO_NOW)
  const peak = planSummary(DEMO_NOW)
  const recent = recentExecutions()
  const progress = summary.planned ? (summary.done / summary.planned) * 100 : 0

  return (
    <div className="stack">
      <div className="stat-grid">
        <TintStat tone="blue" icon={<IconList />} value={KPI.tasks} label="总任务数" />
        <TintStat tone="green" icon={<IconFolder />} value={KPI.projects} label="总项目数" />
        <TintStat tone="purple" icon={<IconPlay />} value={KPI.active} label="活跃任务" />
        <TintStat tone="orange" icon={<IconLayers />} value={KPI.envs} label="虚拟环境" />
      </div>

      <div className="overview-grid">
        <SectionCard icon={<IconLayers />} tone="blue" title="集群状态" subtitle="主控节点与服务健康度">
          <ul className="kv">
            <li>
              <span>在线节点</span>
              <b>1 / 1</b>
            </li>
            <li>
              <span>节点健康</span>
              <b className="ok">正常</b>
            </li>
            <li>
              <span>运行时长</span>
              <b>{NODE.uptime}</b>
            </li>
            <li>
              <span>服务状态</span>
              <b className="ok">可用</b>
            </li>
          </ul>
        </SectionCard>

        <SectionCard icon={<IconClock />} tone="orange" title="今日执行" subtitle="10月22日调度进度">
          <div className="hero-num">
            <strong>{summary.done}</strong>
            <span>/ {summary.planned}</span>
          </div>
          <span className="hero-label">已完成 / 计划任务</span>
          <div className="track today-track">
            <div className="fill fill-blue" style={{ width: `${progress}%` }} />
          </div>
          <div className="mini-grid">
            <div>
              <b>{successRate(recent)}</b>
              <span>成功率</span>
            </div>
            <div>
              <b>{averageDuration(recent)}</b>
              <span>平均耗时</span>
            </div>
            <div>
              <b>{peak.peakHour}:00</b>
              <span>峰值小时</span>
            </div>
            <div>
              <b>{peak.peakCount}</b>
              <span>峰值任务</span>
            </div>
          </div>
        </SectionCard>
      </div>

      <SectionCard icon={<IconList />} tone="green" title="项目与环境" subtitle={`${PROJECTS.length} 个项目 · ${ENVS.length} 个虚拟环境`}>
        <div className="overview-grid">
          <div className="dist-list">
            {PROJECTS.map((item) => (
              <div className="dist-row" key={item.name}>
                <i className="dot green" />
                <div className="dist-main">
                  <strong>{item.name}</strong>
                  <span>{item.tasks} 任务</span>
                </div>
                <b className="dist-count green">{item.tasks}</b>
              </div>
            ))}
          </div>
          <div className="dist-list">
            {ENVS.map((item) => (
              <div className="dist-row" key={item.name}>
                <i className="dot purple" />
                <div className="dist-main">
                  <strong>{item.name}</strong>
                  <span>{item.tasks} 任务</span>
                </div>
                <b className="dist-count purple">{item.tasks}</b>
              </div>
            ))}
          </div>
        </div>
      </SectionCard>

      <SectionCard icon={<IconClock />} tone="orange" title="最近执行" subtitle="最新的任务执行记录">
        <div className="exec-grid">
          {recent.map((item) => (
            <ExecutionRow key={item.id} item={item} />
          ))}
        </div>
      </SectionCard>
    </div>
  )
}
