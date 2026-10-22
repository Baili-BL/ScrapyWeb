import { ENVS, PROJECTS, recentExecutions } from '../data.ts'
import { IconBars, IconClock, IconPulse } from '../icons.tsx'
import { DistList, ExecutionRow, SectionCard, StatusTiles } from '../ui.tsx'

export function TaskMonitor() {
  const recent = recentExecutions()

  return (
    <div className="stack">
      <SectionCard icon={<IconClock />} tone="blue" title="任务状态分布" subtitle="当前任务状态概览">
        <StatusTiles />
      </SectionCard>

      <div className="split-3">
        <SectionCard icon={<IconClock />} tone="orange" title="最近执行" subtitle="最新的任务执行记录">
          <div className="exec-list">
            {recent.map((item) => (
              <ExecutionRow key={item.id} item={item} />
            ))}
          </div>
        </SectionCard>

        <SectionCard icon={<IconBars />} tone="green" title="项目任务分布" subtitle="按项目统计">
          <DistList items={PROJECTS} tone="green" />
        </SectionCard>

        <SectionCard icon={<IconPulse />} tone="purple" title="环境任务分布" subtitle="按环境统计">
          <DistList items={ENVS} tone="purple" />
        </SectionCard>
      </div>
    </div>
  )
}
