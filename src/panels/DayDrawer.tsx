import { Drawer, Empty } from '@arco-design/web-react'
import { formatDayTitle, splitExecutions } from '../data.ts'
import { ExecutionRow } from '../ui.tsx'

export function DayDrawer({ date, onClose }: { date: Date | null; onClose: () => void }) {
  const parts = date ? splitExecutions(date) : { done: [], pending: [] }
  const planned = parts.done.length + parts.pending.length

  return (
    <Drawer
      className="day-drawer"
      width={480}
      title={
        date ? (
          <div className="drawer-heading">
            <strong>{formatDayTitle(date)}</strong>
            <span>当天任务执行明细</span>
          </div>
        ) : null
      }
      visible={date !== null}
      footer={null}
      unmountOnExit
      onCancel={onClose}
    >
      {planned === 0 ? (
        <Empty description="当天没有任务记录" />
      ) : (
        <>
          <div className="drawer-stats">
            <div>
              <strong>{parts.done.length}</strong>
              <span>已完成</span>
            </div>
            <div>
              <strong>{parts.pending.length}</strong>
              <span>待执行</span>
            </div>
            <div>
              <strong>{planned}</strong>
              <span>计划</span>
            </div>
          </div>
          {parts.done.length ? (
            <section className="drawer-block">
              <h4>已完成</h4>
              <div className="exec-list">
                {parts.done.map((item) => (
                  <ExecutionRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
          {parts.pending.length ? (
            <section className="drawer-block">
              <h4>待执行</h4>
              <div className="exec-list">
                {parts.pending.map((item) => (
                  <ExecutionRow key={item.id} item={item} />
                ))}
              </div>
            </section>
          ) : null}
        </>
      )}
    </Drawer>
  )
}
