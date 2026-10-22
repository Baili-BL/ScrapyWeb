import { Button } from '@arco-design/web-react'
import { IconLeft, IconRight } from '@arco-design/web-react/icon'
import type { ReactNode } from 'react'
import type { Metrics } from './api.ts'
import { IconPause, IconPlay } from './icons.tsx'

export type Tone = 'blue' | 'green' | 'purple' | 'orange'

/** 执行记录行：来自后端运行记录的展示投影。 */
export type ExecRow = {
  name: string
  time: string
  status: string
  duration: string
}

export function cx(...names: Array<string | false | null | undefined>): string {
  return names.filter(Boolean).join(' ')
}

export function SectionCard({
  icon,
  tone,
  title,
  subtitle,
  extra,
  children,
}: {
  icon: ReactNode
  tone: Tone
  title: string
  subtitle?: string
  extra?: ReactNode
  children?: ReactNode
}) {
  return (
    <section className="panel">
      <div className="panel-head">
        <span className={`panel-icon tone-${tone}`}>{icon}</span>
        <div className="panel-text">
          <h2>{title}</h2>
          {subtitle ? <p>{subtitle}</p> : null}
        </div>
        {extra}
      </div>
      {children}
    </section>
  )
}

export function TintStat({
  tone,
  icon,
  value,
  label,
}: {
  tone: Tone
  icon: ReactNode
  value: string | number
  label: string
}) {
  return (
    <div className={`stat-card ${tone}`}>
      <span className="bubble">{icon}</span>
      <div>
        <strong>{value}</strong>
        <em>{label}</em>
      </div>
    </div>
  )
}

export function MetricTile({ value, label, color }: { value: string; label: string; color: string }) {
  return (
    <div className="metric-tile">
      <strong style={{ color }}>{value}</strong>
      <span>{label}</span>
    </div>
  )
}

export function ExecutionRow({ item }: { item: ExecRow }) {
  return (
    <div className="exec-row">
      <span className="exec-icon">
        <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden="true">
          <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
          <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
        </svg>
      </span>
      <div className="exec-main">
        <strong>{item.name}</strong>
        <span>{item.time}</span>
      </div>
      <div className="exec-side">
        <em className={item.status}>{item.status}</em>
        <span>{item.duration}</span>
      </div>
    </div>
  )
}

export function StatusTiles({ running, paused }: { running: number; paused: number }) {
  return (
    <div className="status-grid">
      <div className="status-tile">
        <span className="status-glyph run">
          <IconPlay />
        </span>
        <div className="status-num">{running}</div>
        <span className="pill run">运行中</span>
      </div>
      <div className="status-tile">
        <span className="status-glyph pause">
          <IconPause />
        </span>
        <div className="status-num">{paused}</div>
        <span className="pill pause">已暂停</span>
      </div>
    </div>
  )
}

export function DistList({
  items,
  tone,
}: {
  items: { name: string; tasks: number }[]
  tone: 'green' | 'purple'
}) {
  return (
    <div className="dist-list">
      {items.map((item) => (
        <div className="dist-row" key={item.name}>
          <i className={`dot ${tone}`} />
          <div className="dist-main">
            <strong>{item.name}</strong>
            <span>{item.tasks} 任务</span>
          </div>
          <b className={`dist-count ${tone}`}>{item.tasks}</b>
        </div>
      ))}
    </div>
  )
}

function coreBackground(value: number): string {
  if (value <= 0) return '#e7f8ee'
  if (value < 5) return '#d4f5e2'
  if (value < 20) return '#b7eb8f'
  if (value < 50) return '#ffe58f'
  return '#ffbb96'
}

export function CoreGrid({ cores }: { cores: number[] }) {
  return (
    <div>
      <div className="block-label">核心占用分布</div>
      <div className="core-row">
        {cores.map((value, index) => (
          <div key={`core-${index}`} className="core" style={{ background: coreBackground(value) }}>
            <strong>{value}%</strong>
            <span>C{index}</span>
          </div>
        ))}
      </div>
    </div>
  )
}

export function MemoryBar({
  usedGb,
  totalGb,
  percent,
  className,
}: {
  usedGb: number
  totalGb: number
  percent: number
  className?: string
}) {
  return (
    <div className={cx('mem-bar', className)}>
      <div className="mem-label">
        <span>物理内存</span>
        <span>
          {usedGb.toFixed(2)} GB / {totalGb.toFixed(2)} GB
        </span>
      </div>
      <div className="track">
        <div className="fill fill-orange" style={{ width: `${Math.min(100, Math.max(0, percent))}%` }} />
      </div>
    </div>
  )
}

export function DiskUsage({ disk }: { disk: Metrics['disk'] }) {
  return (
    <div className="disk-usage">
      <div className="metric-grid">
        <MetricTile value={`${disk.usedGb.toFixed(2)} GB`} label="磁盘已用" color="#165dff" />
        <MetricTile value={`${disk.freeGb.toFixed(2)} GB`} label="磁盘可用" color="#00b42a" />
        <MetricTile value={`${disk.totalGb.toFixed(2)} GB`} label="磁盘总容量" color="#722ed1" />
        <MetricTile value={`${disk.percent.toFixed(1)}%`} label="磁盘使用率" color="#ff7d00" />
      </div>
      <ul className="disk-list">
        <li>
          <div className="disk-meta">
            <div>
              <strong>项目所在卷</strong>
              <span>实时读取自 fs.statfs</span>
            </div>
            <div className="disk-side">
              <strong>{disk.percent.toFixed(1)}%</strong>
              <span>
                {disk.usedGb.toFixed(2)} GB / {disk.totalGb.toFixed(2)} GB
              </span>
            </div>
          </div>
          <div className="track disk-track">
            <div className="fill fill-green" style={{ width: `${Math.min(100, Math.max(0, disk.percent))}%` }} />
          </div>
        </li>
      </ul>
    </div>
  )
}

export function Pager({
  title,
  onPrev,
  onNext,
  prevLabel,
  nextLabel,
  extra,
}: {
  title: string
  onPrev: () => void
  onNext: () => void
  prevLabel: string
  nextLabel: string
  extra?: ReactNode
}) {
  return (
    <div className="cal-head">
      <h3>{title}</h3>
      <div className="cal-nav">
        {extra}
        <Button className="nav-btn" aria-label={prevLabel} icon={<IconLeft />} onClick={onPrev} />
        <Button className="nav-btn" aria-label={nextLabel} icon={<IconRight />} onClick={onNext} />
      </div>
    </div>
  )
}
