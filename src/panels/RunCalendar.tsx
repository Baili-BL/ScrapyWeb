import { Drawer } from '@arco-design/web-react'
import { useMemo, useState } from 'react'
import type { RunRecord } from '../api.ts'
import { Pager } from '../ui.tsx'

const WEEK_LABELS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']

/** 一律按本地时区的年月日分桶（toISOString 会切到 UTC 导致跨天错位）。 */
function dayKeyOfDate(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

function monthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []
  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({ date: new Date(year, month, index - firstWeekday + 1), inMonth: false })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true })
  }
  let extra = 1
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, extra), inMonth: false })
    extra += 1
  }
  return cells
}

function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 真实数据：任务运行日历（每天爬虫运行次数，点击查看当天明细）。 */
export function RunCalendar({ runs }: { runs: RunRecord[] }) {
  const now = new Date()
  const [cursor, setCursor] = useState(() => new Date(now.getFullYear(), now.getMonth(), 1))
  const [selected, setSelected] = useState<Date | null>(null)

  const runsByDay = useMemo(() => {
    const map = new Map<string, RunRecord[]>()
    for (const run of runs) {
      const key = dayKeyOfDate(new Date(run.startedAt))
      const list = map.get(key) ?? []
      list.push(run)
      map.set(key, list)
    }
    return map
  }, [runs])

  const cells = useMemo(() => monthCells(cursor.getFullYear(), cursor.getMonth()), [cursor])
  const viewingTodayMonth = cursor.getFullYear() === now.getFullYear() && cursor.getMonth() === now.getMonth()

  const dayRuns = useMemo(() => {
    if (!selected) return []
    return runsByDay.get(dayKeyOfDate(selected)) ?? []
  }, [selected, runsByDay])

  return (
    <section className="panel">
      <Pager
        title={`${MONTHS[cursor.getMonth()]} ${cursor.getFullYear()}`}
        prevLabel="上个月"
        nextLabel="下个月"
        onPrev={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        onNext={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        extra={
          viewingTodayMonth ? null : (
            <button type="button" className="today-link" onClick={() => setCursor(new Date(now.getFullYear(), now.getMonth(), 1))}>
              回到本月
            </button>
          )
        }
      />
      <div className="cal-weeks">
        {WEEK_LABELS.map((label) => (
          <span key={label}>{label}</span>
        ))}
      </div>
      <div className="cal-grid">
        {cells.map((cell) => {
          const dayRuns = runsByDay.get(dayKeyOfDate(cell.date)) ?? []
          const hasRuns = cell.inMonth && dayRuns.length > 0
          const className = [
            'cal-cell',
            cell.inMonth ? 'in-month' : 'outside',
            hasRuns ? 'has-task' : 'empty',
            cell.inMonth && isSameDay(cell.date, now) ? 'is-today' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              className={className}
              disabled={!cell.inMonth}
              onClick={() => setSelected(cell.date)}
            >
              <span className="day-num">{cell.date.getDate()}</span>
              {hasRuns ? <span className="task-count">{dayRuns.length}次</span> : null}
            </button>
          )
        })}
      </div>

      <Drawer
        className="day-drawer"
        width={480}
        title={
          selected ? (
            <div className="drawer-heading">
              <strong>
                {selected.getFullYear()}年{selected.getMonth() + 1}月{selected.getDate()}日 {WEEK_LABELS[selected.getDay()]}
              </strong>
              <span>当天爬虫运行明细（真实记录）</span>
            </div>
          ) : null
        }
        visible={selected !== null}
        footer={null}
        unmountOnExit
        onCancel={() => setSelected(null)}
      >
        {dayRuns.length === 0 ? (
          <p className="node-line">这一天没有爬虫运行记录。</p>
        ) : (
          <>
            <div className="drawer-stats">
              <div>
                <strong>{dayRuns.filter((run) => run.status === 'success').length}</strong>
                <span>成功</span>
              </div>
              <div>
                <strong>{dayRuns.filter((run) => run.status === 'failed').length}</strong>
                <span>失败</span>
              </div>
              <div>
                <strong>{dayRuns.reduce((sum, run) => sum + (run.items ?? 0), 0)}</strong>
                <span>抓取条数</span>
              </div>
            </div>
            <div className="exec-list">
              {dayRuns.map((run) => (
                <div className="exec-row" key={run.id}>
                  <div className="exec-main">
                    <strong>{run.spider}</strong>
                    <span>
                      {fmtTime(run.startedAt)} - {fmtTime(run.finishedAt)}
                    </span>
                  </div>
                  <div className="exec-side">
                    <em className={run.status}>{run.status === 'success' ? '成功' : run.status === 'failed' ? '失败' : '运行中'}</em>
                    <span>
                      {run.items ?? '—'} 条 · {run.durationSec ?? '—'}s
                    </span>
                  </div>
                </div>
              ))}
            </div>
          </>
        )}
      </Drawer>
    </section>
  )
}
