import { Button } from '@arco-design/web-react'
import { useState } from 'react'
import { DEMO_NOW, WEEK_LABELS, completedCount, formatMonthTitle, isSameDay, monthCells } from '../data.ts'
import { Pager } from '../ui.tsx'

export function TaskCalendar({ onOpen }: { onOpen: (date: Date) => void }) {
  const [cursor, setCursor] = useState(() => new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth(), 1))
  const cells = monthCells(cursor.getFullYear(), cursor.getMonth())
  const viewingDemo = cursor.getFullYear() === DEMO_NOW.getFullYear() && cursor.getMonth() === DEMO_NOW.getMonth()

  return (
    <section className="panel">
      <Pager
        title={formatMonthTitle(cursor)}
        prevLabel="上个月"
        nextLabel="下个月"
        onPrev={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() - 1, 1))}
        onNext={() => setCursor(new Date(cursor.getFullYear(), cursor.getMonth() + 1, 1))}
        extra={
          viewingDemo ? null : (
            <Button className="today-btn" onClick={() => setCursor(new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth(), 1))}>
              今天
            </Button>
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
          const count = cell.inMonth ? completedCount(cell.date) : null
          const hasTask = count !== null && count > 0
          const className = [
            'cal-cell',
            cell.inMonth ? 'in-month' : 'outside',
            hasTask ? 'has-task' : 'empty',
            cell.inMonth && isSameDay(cell.date, DEMO_NOW) ? 'is-today' : '',
          ]
            .filter(Boolean)
            .join(' ')
          return (
            <button
              key={cell.date.toISOString()}
              type="button"
              className={className}
              disabled={!cell.inMonth}
              onClick={() => onOpen(cell.date)}
            >
              <span className="day-num">{cell.date.getDate()}</span>
              {hasTask ? <span className="task-count">{count}任务</span> : null}
            </button>
          )
        })}
      </div>
    </section>
  )
}
