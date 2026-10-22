import { Input, Select } from '@arco-design/web-react'
import {
  IconCode,
  IconLeft,
  IconLock,
  IconMinus,
  IconPlayArrow,
  IconPlus,
  IconQuestionCircle,
  IconRefresh,
  IconSave,
  IconStop,
  IconUnlock,
} from '@arco-design/web-react/icon'
import { useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { nodeSize } from './model.ts'
import type { FlowEdge, FlowNode, FlowNodeType, FlowRecord } from './model.ts'

const PROJECTS = ['requests_project', '编排流程代码样例']
const ENVS = ['requests_env']

function cloneFlow(flow: FlowRecord): FlowRecord {
  return {
    ...flow,
    nodes: flow.nodes.map((node) => ({ ...node })),
    edges: flow.edges.map((edge) => ({ ...edge })),
  }
}

function portPoint(node: FlowNode, side: 'in' | 'out') {
  const size = nodeSize(node.type)
  return {
    x: side === 'out' ? node.x + size.w : node.x,
    y: node.y + size.h / 2,
  }
}

export function FlowEditor({
  flow,
  onBack,
  onSave,
  onNotify,
}: {
  flow: FlowRecord
  onBack: (flow: FlowRecord) => void
  onSave: (flow: FlowRecord) => void
  onNotify: (text: string) => void
}) {
  const origin = useRef(cloneFlow(flow))
  const [name, setName] = useState(flow.name)
  const [description, setDescription] = useState(flow.description)
  const [nodes, setNodes] = useState<FlowNode[]>(() => flow.nodes.map((node) => ({ ...node })))
  const [edges, setEdges] = useState<FlowEdge[]>(() => flow.edges.map((edge) => ({ ...edge })))
  const [selectedId, setSelectedId] = useState(flow.nodes.find((node) => node.type === 'start')?.id ?? flow.nodes[0]?.id ?? '')
  const [zoom, setZoom] = useState(1)
  const [pan, setPan] = useState({ x: 24, y: 24 })
  const [locked, setLocked] = useState(false)
  const [paletteOpen, setPaletteOpen] = useState(false)
  const [linkFrom, setLinkFrom] = useState<string | null>(null)
  const stageRef = useRef<HTMLDivElement>(null)
  const dragRef = useRef<{ id: string; dx: number; dy: number } | null>(null)
  const panRef = useRef<{ x: number; y: number; px: number; py: number } | null>(null)

  const selected = nodes.find((node) => node.id === selectedId) ?? null

  const current = (): FlowRecord => ({
    ...flow,
    name: name.trim() || '未命名流程',
    description,
    nodes,
    edges,
  })

  const apply = (next: FlowRecord) => {
    setName(next.name)
    setDescription(next.description)
    setNodes(next.nodes.map((node) => ({ ...node })))
    setEdges(next.edges.map((edge) => ({ ...edge })))
    setSelectedId(next.nodes[0]?.id ?? '')
    setLinkFrom(null)
  }

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    setNodes((list) => list.map((node) => (node.id === id ? { ...node, ...patch } : node)))
  }

  const addScript = () => {
    const count = nodes.filter((node) => node.type === 'script').length + 1
    const id = `${flow.id}-script-${Date.now()}`
    const node: FlowNode = {
      id,
      type: 'script',
      title: `脚本节点 ${count}`,
      x: 360,
      y: 40 + count * 36,
      project: '',
      env: '',
      command: '',
    }
    setNodes((list) => [...list, node])
    setSelectedId(id)
    setPaletteOpen(false)
  }

  const removeSelected = () => {
    if (!selected) return
    const id = selected.id
    setNodes((list) => list.filter((node) => node.id !== id))
    setEdges((list) => list.filter((edge) => edge.from !== id && edge.to !== id))
    setSelectedId('')
    onNotify(`已删除 ${selected.title}`)
  }

  const onNodePointerDown = (event: ReactPointerEvent<HTMLDivElement>, node: FlowNode) => {
    setSelectedId(node.id)
    if (locked) return
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return
    dragRef.current = {
      id: node.id,
      dx: (event.clientX - rect.left) / zoom - node.x,
      dy: (event.clientY - rect.top) / zoom - node.y,
    }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onNodePointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const drag = dragRef.current
    const rect = stageRef.current?.getBoundingClientRect()
    if (!drag || !rect) return
    const x = Math.max(8, (event.clientX - rect.left) / zoom - drag.dx)
    const y = Math.max(8, (event.clientY - rect.top) / zoom - drag.dy)
    updateNode(drag.id, { x, y })
  }

  const onCanvasPointerDown = (event: ReactPointerEvent<HTMLDivElement>) => {
    if (event.target !== event.currentTarget && !(event.target instanceof SVGElement)) return
    setSelectedId('')
    setLinkFrom(null)
    if (locked) return
    panRef.current = { x: pan.x, y: pan.y, px: event.clientX, py: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panDrag = panRef.current
    if (!panDrag) return
    setPan({ x: panDrag.x + event.clientX - panDrag.px, y: panDrag.y + event.clientY - panDrag.py })
  }

  const connectFrom = (event: ReactPointerEvent<HTMLButtonElement>, node: FlowNode, side: 'in' | 'out') => {
    event.stopPropagation()
    setSelectedId(node.id)
    if (side === 'out') {
      setLinkFrom(node.id)
      return
    }
    if (!linkFrom || linkFrom === node.id) return
    setEdges((list) => {
      if (list.some((edge) => edge.from === linkFrom && edge.to === node.id)) return list
      return [...list, { id: `${flow.id}-e-${Date.now()}`, from: linkFrom, to: node.id }]
    })
    setLinkFrom(null)
  }

  const paths = useMemo(
    () =>
      edges
        .map((edge) => {
          const from = nodes.find((node) => node.id === edge.from)
          const to = nodes.find((node) => node.id === edge.to)
          if (!from || !to) return null
          const start = portPoint(from, 'out')
          const end = portPoint(to, 'in')
          const mid = (start.x + end.x) / 2
          return { id: edge.id, d: `M ${start.x} ${start.y} C ${mid} ${start.y}, ${mid} ${end.y}, ${end.x} ${end.y}` }
        })
        .filter((item): item is { id: string; d: string } => item !== null),
    [edges, nodes],
  )

  return (
    <div className="flow-screen">
      <header className="flow-top">
        <div>
          <h1>{name.trim() || '未命名流程'}</h1>
          <p>从左侧拖入脚本节点，连接各节点形成流程。</p>
        </div>
        <div className="flow-actions">
          <button type="button" className="flow-back" onClick={() => onBack(current())}>
            <IconLeft />
            返回列表
          </button>
          <span className="flow-draft">{flow.status === 'paused' ? '已暂停' : flow.status === 'saved' ? '已保存' : '草稿'}</span>
          <button
            type="button"
            className="flow-ghost"
            onClick={() => {
              apply(origin.current)
              onNotify('流程已刷新')
            }}
          >
            <IconRefresh />
            刷新
          </button>
          <button
            type="button"
            className="flow-ghost"
            onClick={() => {
              const next = { ...current(), status: 'saved' as const }
              origin.current = cloneFlow(next)
              onSave(next)
            }}
          >
            <IconSave />
            保存
          </button>
          <button type="button" className="task-create" onClick={() => onNotify(`已运行 ${name.trim() || '未命名流程'}`)}>
            <IconPlayArrow />
            运行
          </button>
        </div>
      </header>

      <div className="flow-work">
        <section className="flow-board">
          <div className="flow-meta">
            <label>
              <span>名称</span>
              <Input value={name} onChange={setName} />
            </label>
            <label>
              <span>描述</span>
              <Input value={description} placeholder="请输入流程描述" onChange={setDescription} />
            </label>
          </div>
          <div className="flow-canvas">
            <div
              ref={stageRef}
              className="flow-stage"
              style={{ transform: `translate(${pan.x}px, ${pan.y}px) scale(${zoom})` }}
              onPointerDown={onCanvasPointerDown}
              onPointerMove={onCanvasPointerMove}
              onPointerUp={() => {
                panRef.current = null
              }}
            >
              <svg className="flow-edges" width="1600" height="900">
                {paths.map((path) => (
                  <path key={path.id} d={path.d} />
                ))}
              </svg>
              {nodes.map((node) => (
                <FlowCard
                  key={node.id}
                  node={node}
                  selected={node.id === selectedId}
                  linking={linkFrom === node.id}
                  onPointerDown={onNodePointerDown}
                  onPointerMove={onNodePointerMove}
                  onPointerUp={() => {
                    dragRef.current = null
                  }}
                  onPort={connectFrom}
                />
              ))}
            </div>

            <div className="flow-zoom">
              <button type="button" aria-label="放大" onClick={() => setZoom((value) => Math.min(1.6, Number((value + 0.1).toFixed(2))))}>
                <IconPlus />
              </button>
              <button type="button" aria-label="缩小" onClick={() => setZoom((value) => Math.max(0.6, Number((value - 0.1).toFixed(2))))}>
                <IconMinus />
              </button>
              <button type="button" aria-label={locked ? '解锁画布' : '锁定画布'} onClick={() => setLocked((value) => !value)}>
                {locked ? <IconLock /> : <IconUnlock />}
              </button>
            </div>

            <div className="flow-palette">
              {paletteOpen ? (
                <div className="flow-palette-pop">
                  <button type="button" onClick={addScript}>
                    <IconCode />
                    脚本节点
                  </button>
                </div>
              ) : null}
              <button type="button" className={paletteOpen ? 'on' : ''} onClick={() => setPaletteOpen((value) => !value)}>
                节点面板
              </button>
              <button type="button" aria-label="脚本节点" onClick={addScript}>
                <IconCode />
              </button>
              <button type="button" aria-label="添加脚本节点" onClick={addScript}>
                <IconPlus />
              </button>
              <button type="button" aria-label="编排说明" onClick={() => onNotify('先添加脚本节点，再点右侧圆点接到下一个节点')}>
                <IconQuestionCircle />
              </button>
            </div>

            <div className="flow-minimap" aria-hidden="true">
              {nodes.map((node) => (
                <i
                  key={node.id}
                  className={node.type}
                  style={{ left: node.x / 12, top: node.y / 12, width: nodeSize(node.type).w / 12, height: nodeSize(node.type).h / 12 }}
                />
              ))}
            </div>
            {linkFrom ? <p className="flow-link-hint">点击下一个节点左侧圆点完成连接</p> : null}
          </div>
        </section>

        <aside className="flow-props">
          <h2>节点属性</h2>
          {selected ? (
            <>
              <p>当前节点：{selected.title}</p>
              <label>
                <span>节点标题</span>
                <Input value={selected.title} onChange={(value) => updateNode(selected.id, { title: value })} />
              </label>
              <label>
                <span>节点类型</span>
                <Input value={selected.type} readOnly />
              </label>
              {selected.type === 'script' ? (
                <>
                  <label>
                    <span>项目</span>
                    <Select
                      placeholder="未配置"
                      allowClear
                      value={selected.project || undefined}
                      options={PROJECTS}
                      onChange={(value) => updateNode(selected.id, { project: value ? String(value) : '' })}
                    />
                  </label>
                  <label>
                    <span>环境</span>
                    <Select
                      placeholder="未配置"
                      allowClear
                      value={selected.env || undefined}
                      options={ENVS}
                      onChange={(value) => updateNode(selected.id, { env: value ? String(value) : '' })}
                    />
                  </label>
                  <label>
                    <span>命令</span>
                    <Input
                      value={selected.command}
                      placeholder="python src/test1.py"
                      onChange={(value) => updateNode(selected.id, { command: value })}
                    />
                  </label>
                </>
              ) : null}
              <button type="button" className="flow-delete" onClick={removeSelected}>
                删除当前节点
              </button>
            </>
          ) : (
            <p>在画布上选择一个节点。</p>
          )}
        </aside>
      </div>
    </div>
  )
}

function FlowCard({
  node,
  selected,
  linking,
  onPointerDown,
  onPointerMove,
  onPointerUp,
  onPort,
}: {
  node: FlowNode
  selected: boolean
  linking: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, node: FlowNode) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: () => void
  onPort: (event: ReactPointerEvent<HTMLButtonElement>, node: FlowNode, side: 'in' | 'out') => void
}) {
  const size = nodeSize(node.type)
  return (
    <div
      className={`flow-node ${node.type}${selected ? ' selected' : ''}${linking ? ' linking' : ''}`}
      style={{ left: node.x, top: node.y, width: size.w, height: size.h }}
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown(event, node)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {node.type !== 'start' ? (
        <button type="button" className="flow-port in" aria-label={`${node.title} 输入`} onPointerDown={(event) => onPort(event, node, 'in')} />
      ) : null}
      {node.type === 'script' ? (
        <>
          <strong>
            <IconCode />
            {node.title || '脚本节点'}
          </strong>
          <em>脚本节点</em>
          <span>项目：{node.project || '未配置'}</span>
          <span>环境：{node.env || '未配置'}</span>
          <span>命令：{node.command || '未配置'}</span>
        </>
      ) : (
        <div className="flow-node-main">
          <i>{node.type === 'start' ? <IconPlayArrow /> : <IconStop />}</i>
          <div>
            <strong>{node.title || typeName(node.type)}</strong>
            <em>{typeName(node.type)}</em>
          </div>
        </div>
      )}
      {node.type !== 'end' ? (
        <button type="button" className="flow-port out" aria-label={`${node.title} 输出`} onPointerDown={(event) => onPort(event, node, 'out')} />
      ) : null}
    </div>
  )
}

function typeName(type: FlowNodeType) {
  if (type === 'start') return '开始'
  if (type === 'end') return '结束'
  return '脚本节点'
}
