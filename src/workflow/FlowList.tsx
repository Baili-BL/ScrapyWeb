import { IconDelete, IconPlayArrow, IconPlus } from '@arco-design/web-react/icon'
import { useEffect, useState } from 'react'
import type { FlowItem, FlowRunRecord } from '../api.ts'
import { createFlow, deleteFlow, fetchFlowRuns, fetchFlows, pollFlowRun, runFlow as apiRunFlow, updateFlow } from '../api.ts'
import { FlowEditor } from './FlowEditor.tsx'
import { blankFlow, orderedScriptNodes } from './model.ts'

const STATUS_TEXT = {
  draft: '草稿',
  paused: '已暂停',
  saved: '已保存',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function FlowList({ onNotify }: { onNotify: (text: string) => void }) {
  const [flows, setFlows] = useState<FlowItem[] | null>(null)
  const [editing, setEditing] = useState<FlowItem | null>(null)
  const [runningIds, setRunningIds] = useState<string[]>([])
  const [lastRuns, setLastRuns] = useState<Record<string, FlowRunRecord>>({})

  const loadFlows = async () => {
    try {
      const [list, runs] = await Promise.all([fetchFlows(), fetchFlowRuns(undefined, 100)])
      setFlows(list)
      const map: Record<string, FlowRunRecord> = {}
      for (const run of runs) {
        if (!map[run.flowId]) map[run.flowId] = run
      }
      setLastRuns(map)
    } catch (error) {
      onNotify(`加载流程失败：${(error as Error).message}`)
    }
  }

  useEffect(() => {
    void loadFlows()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const createBlankFlow = async () => {
    try {
      const blank = blankFlow(`flow-${Date.now()}`)
      const created = await createFlow({ name: blank.name, description: blank.description, nodes: blank.nodes, edges: blank.edges })
      setFlows((list) => [created, ...(list ?? [])])
      setEditing(created)
      onNotify('已创建流程，开始编排')
    } catch (error) {
      onNotify(`创建流程失败：${(error as Error).message}`)
    }
  }

  const triggerRun = async (flow: FlowItem) => {
    if (runningIds.includes(flow.id)) return
    setRunningIds((list) => [...list, flow.id])
    onNotify(`流程 ${flow.name} 开始运行（按连线顺序真实执行爬虫）…`)
    try {
      const started = await apiRunFlow(flow.id)
      const run = started.status === 'running' ? await pollFlowRun(started.id) : started
      onNotify(
        run.status === 'success'
          ? `流程 ${flow.name} 运行成功：${run.steps.map((step) => `${step.title} ${step.items ?? '—'}条`).join('，')}`
          : `流程 ${flow.name} 运行失败：${run.steps.find((step) => step.status === 'failed')?.message ?? '未知原因'}`,
      )
      await loadFlows()
    } catch (error) {
      onNotify(`流程运行失败：${(error as Error).message}`)
    } finally {
      setRunningIds((list) => list.filter((id) => id !== flow.id))
    }
  }

  const removeFlow = async (flow: FlowItem) => {
    try {
      await deleteFlow(flow.id)
      onNotify(`已删除 ${flow.name}`)
      await loadFlows()
    } catch (error) {
      onNotify(`删除失败：${(error as Error).message}`)
    }
  }

  if (editing) {
    return (
      <FlowEditor
        key={editing.id}
        flow={editing}
        onNotify={onNotify}
        onBack={async (next) => {
          try {
            const saved = await updateFlowRemote(next)
            setFlows((list) => (list ?? []).map((item) => (item.id === saved.id ? saved : item)))
            setEditing(null)
            onNotify(`已保存并返回列表：${saved.name}`)
          } catch (error) {
            onNotify(`保存失败：${(error as Error).message}`)
            setEditing(null)
          }
        }}
        onSave={async (next) => {
          const saved = await updateFlowRemote(next)
          setFlows((list) => (list ?? []).map((item) => (item.id === saved.id ? saved : item)))
          setEditing(saved)
          onNotify(`已保存 ${saved.name} 到服务器`)
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
            <p>把真实爬虫按顺序连成流程，运行时后端依次执行并记录每一步结果。</p>
          </div>
          <button type="button" className="task-create" onClick={() => void createBlankFlow()}>
            <IconPlus />
            创建流程
          </button>
        </header>
        <div className="flow-list">
          {(flows ?? []).map((flow) => {
            const steps = orderedScriptNodes(flow).map((node) => node.project || node.title)
            const lastRun = lastRuns[flow.id]
            const isRunning = runningIds.includes(flow.id) || lastRun?.status === 'running'
            return (
              <div key={flow.id} className="flow-card" role="button" tabIndex={0} onClick={() => setEditing(flow)}>
                <strong>{flow.name}</strong>
                <span>{flow.description || '把脚本节点连接成流程，运行时按顺序真实执行。'}</span>
                <span className="flow-steps">执行顺序：{steps.length ? steps.join(' → ') : '（尚无脚本节点）'}</span>
                <span className="flow-lastrun">
                  最近运行：{lastRun ? `${fmtTime(lastRun.finishedAt ?? lastRun.startedAt)} · ${lastRun.status === 'success' ? '成功' : '失败'} · ${lastRun.durationSec ?? '—'}s` : '从未运行'}
                </span>
                <em>
                  {flow.nodes.length} 个节点
                  <i className={isRunning ? 'task-badge running' : flow.status === 'paused' ? 'task-badge paused' : 'task-badge active'}>
                    {isRunning ? '运行中' : STATUS_TEXT[flow.status]}
                  </i>
                </em>
                <div className="flow-card-actions" onClick={(event) => event.stopPropagation()}>
                  <button
                    type="button"
                    className="task-run"
                    disabled={isRunning}
                    onClick={() => void triggerRun(flow)}
                  >
                    <IconPlayArrow />
                    {isRunning ? '运行中…' : '运行'}
                  </button>
                  <button type="button" className="task-icon-btn" aria-label={`编辑 ${flow.name}`} onClick={() => setEditing(flow)}>
                    编辑
                  </button>
                  <button
                    type="button"
                    className="task-icon-btn"
                    aria-label={`删除 ${flow.name}`}
                    onClick={() => void removeFlow(flow)}
                  >
                    <IconDelete />
                  </button>
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}

async function updateFlowRemote(next: FlowItem): Promise<FlowItem> {
  return updateFlow(next.id, {
    name: next.name,
    description: next.description,
    status: next.status,
    nodes: next.nodes,
    edges: next.edges,
  })
}
