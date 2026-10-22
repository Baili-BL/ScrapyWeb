import { IconPlus } from '@arco-design/web-react/icon'
import { useState } from 'react'
import { FlowEditor } from './FlowEditor.tsx'
import { SEED_FLOWS, blankFlow, nextFlowId } from './model.ts'
import type { FlowRecord } from './model.ts'

const STATUS_TEXT = {
  draft: '草稿',
  paused: '已暂停',
  saved: '已保存',
}

export function FlowList({ onNotify }: { onNotify: (text: string) => void }) {
  const [flows, setFlows] = useState<FlowRecord[]>(SEED_FLOWS)
  const [editing, setEditing] = useState<FlowRecord | null>(null)

  const store = (next: FlowRecord) => {
    setFlows((list) => {
      const exists = list.some((item) => item.id === next.id)
      return exists ? list.map((item) => (item.id === next.id ? next : item)) : [next, ...list]
    })
    setEditing(next)
  }

  if (editing) {
    return (
      <FlowEditor
        key={editing.id}
        flow={editing}
        onNotify={onNotify}
        onBack={(next) => {
          store(next)
          setEditing(null)
        }}
        onSave={(next) => {
          store(next)
          onNotify(`已保存 ${next.name}`)
        }}
      />
    )
  }

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>流程编排</h1>
            <p>从脚本节点连接成可执行流程。打开后进入全屏画布。</p>
          </div>
          <button
            type="button"
            className="task-create"
            onClick={() => {
              const created = blankFlow(nextFlowId())
              store(created)
            }}
          >
            <IconPlus />
            创建流程
          </button>
        </header>
        <div className="flow-list">
          {flows.map((flow) => (
            <button key={flow.id} type="button" className="flow-card" onClick={() => setEditing(flow)}>
              <strong>{flow.name}</strong>
              <span>{flow.description || '从左侧拖入脚本节点，连接各节点形成流程。'}</span>
              <em>
                {flow.nodes.length} 个节点
                <i className={flow.status === 'paused' ? 'task-badge paused' : 'task-badge active'}>{STATUS_TEXT[flow.status]}</i>
              </em>
            </button>
          ))}
        </div>
      </div>
    </div>
  )
}
