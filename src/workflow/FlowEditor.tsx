import { Input } from '@arco-design/web-react'
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
import { useEffect, useMemo, useRef, useState } from 'react'
import type { PointerEvent as ReactPointerEvent } from 'react'
import { runFlow, pollFlowRun } from '../api.ts'
import { nodeSize, orderedScriptNodes, SPIDER_META, SPIDER_OPTIONS } from './model.ts'
import type { FlowEdge, FlowNode, FlowNodeType, FlowRecord } from './model.ts'

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
  onBack: (flow: FlowRecord) => Promise<void> | void
  onSave: (flow: FlowRecord) => Promise<void> | void
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
  const [linkPoint, setLinkPoint] = useState<{ x: number; y: number } | null>(null)
  const [selectedEdgeId, setSelectedEdgeId] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [runBusy, setRunBusy] = useState(false)
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
    setLinkPoint(null)
    setSelectedEdgeId('')
  }

  const updateNode = (id: string, patch: Partial<FlowNode>) => {
    setNodes((list) => list.map((node) => (node.id === id ? { ...node, ...patch } : node)))
  }

  const addScript = (spiderName: string) => {
    const count = nodes.filter((node) => node.type === 'script').length + 1
    const meta = SPIDER_META[spiderName]
    const id = `${flow.id}-script-${Date.now()}`
    const node: FlowNode = {
      id,
      type: 'script',
      title: meta ? meta.title : `脚本节点 ${count}`,
      x: 360,
      y: 40 + count * 36,
      project: spiderName,
      env: meta?.env ?? '',
      command: meta?.command ?? '',
    }
    setNodes((list) => [...list, node])
    setSelectedId(id)
    setPaletteOpen(false)
    onNotify(meta ? `已添加「${meta.title}」节点，连接到流程即可` : '已添加脚本节点')
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
    setSelectedEdgeId('')
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
    setSelectedEdgeId('')
    setLinkFrom(null)
    setLinkPoint(null)
    if (locked) return
    panRef.current = { x: pan.x, y: pan.y, px: event.clientX, py: event.clientY }
    event.currentTarget.setPointerCapture(event.pointerId)
  }

  const onCanvasPointerMove = (event: ReactPointerEvent<HTMLDivElement>) => {
    const panDrag = panRef.current
    if (!panDrag) return
    setPan({ x: panDrag.x + event.clientX - panDrag.px, y: panDrag.y + event.clientY - panDrag.py })
  }

  const stageCoords = (clientX: number, clientY: number) => {
    const rect = stageRef.current?.getBoundingClientRect()
    if (!rect) return { x: 0, y: 0 }
    return { x: (clientX - rect.left) / zoom, y: (clientY - rect.top) / zoom }
  }

  const addEdge = (from: string, to: string) => {
    if (from === to) return
    setEdges((list) => {
      if (list.some((edge) => edge.from === from && edge.to === to)) return list
      return [...list, { id: `${flow.id}-e-${Date.now()}`, from, to }]
    })
  }

  const removeEdge = (edgeId: string) => {
    setEdges((list) => list.filter((edge) => edge.id !== edgeId))
    if (selectedEdgeId === edgeId) setSelectedEdgeId('')
    onNotify('已删除连线')
  }

  /** 输出端口按下：进入连线模式。支持两种方式——按住拖到目标节点，或点输出圆点后再点目标节点。 */
  const onPortPointerDown = (event: ReactPointerEvent<HTMLButtonElement>, node: FlowNode, side: 'in' | 'out') => {
    event.stopPropagation()
    setSelectedId(node.id)
    setSelectedEdgeId('')
    if (side === 'out') {
      setLinkFrom(node.id)
      setLinkPoint(stageCoords(event.clientX, event.clientY))
      return
    }
    if (linkFrom && linkFrom !== node.id) {
      addEdge(linkFrom, node.id)
      onNotify('已连线')
    }
    setLinkFrom(null)
    setLinkPoint(null)
  }

  /* 连线进行中：在 window 上监听移动/松开（不用指针捕获，
     否则目标节点的输入圆点收不到事件，点选与拖拽都会失灵） */
  useEffect(() => {
    if (!linkFrom) return
    const onMove = (event: PointerEvent) => {
      setLinkPoint(stageCoords(event.clientX, event.clientY))
    }
    const onUp = (event: PointerEvent) => {
      const target = document.elementFromPoint(event.clientX, event.clientY)
      const portEl = target?.closest('[data-port-in]')
      const nodeEl = target?.closest('[data-node-id]')
      const targetId = portEl?.getAttribute('data-port-in') ?? nodeEl?.getAttribute('data-node-id')
      if (targetId && targetId !== linkFrom) {
        addEdge(linkFrom, targetId)
        onNotify('已连线')
        setLinkFrom(null)
        setLinkPoint(null)
        return
      }
      if (targetId === linkFrom) {
        // 松手在源端口上：点选连线模式的第一步，保持连线状态等待点击目标
        setLinkPoint(stageCoords(event.clientX, event.clientY))
        return
      }
      // 拖到空白处松手 → 取消
      setLinkFrom(null)
      setLinkPoint(null)
    }
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLinkFrom(null)
        setLinkPoint(null)
      }
    }
    window.addEventListener('pointermove', onMove)
    window.addEventListener('pointerup', onUp)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('pointermove', onMove)
      window.removeEventListener('pointerup', onUp)
      window.removeEventListener('keydown', onKey)
    }
  })

  const handleSave = async () => {
    setSaveBusy(true)
    try {
      const savedFlow = { ...current(), status: 'saved' as const }
      await onSave(savedFlow)
      origin.current = cloneFlow(savedFlow)
    } finally {
      setSaveBusy(false)
    }
  }

  const handleRun = async () => {
    const scripts = orderedScriptNodes(current())
    if (!scripts.length) {
      onNotify('流程中没有脚本节点：请添加脚本节点并从「开始」连出')
      return
    }
    const unknown = scripts.find((node) => !SPIDER_OPTIONS.some((option) => option.value === node.project))
    if (unknown) {
      onNotify(`节点「${unknown.title}」的项目需选择真实爬虫（eastmoney_stock 或 fcfco_reports）才能运行`)
      return
    }
    setRunBusy(true)
    try {
      await onSave(current())
      const started = await runFlow(flow.id)
      const run = started.status === 'running' ? await pollFlowRun(started.id) : started
      onNotify(
        run.status === 'success'
          ? `流程运行成功：${run.steps.map((step) => `${step.title} ${step.items ?? '—'}条`).join('，')}`
          : `流程运行失败：${run.steps.find((step) => step.status === 'failed')?.message ?? '未知原因'}`,
      )
    } catch (error) {
      onNotify(`流程运行失败：${(error as Error).message}`)
    } finally {
      setRunBusy(false)
    }
  }

  useEffect(() => {
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setLinkFrom(null)
        setLinkPoint(null)
        setSelectedEdgeId('')
        return
      }
      if (event.key !== 'Delete' && event.key !== 'Backspace') return
      const target = event.target as HTMLElement | null
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA')) return
      if (selectedEdgeId) {
        event.preventDefault()
        removeEdge(selectedEdgeId)
        return
      }
      if (selected?.type === 'script') {
        event.preventDefault()
        removeSelected()
      }
    }
    window.addEventListener('keydown', onKeyDown)
    return () => window.removeEventListener('keydown', onKeyDown)
  })

  const autoLayout = () => {
    const scripts = orderedScriptNodes(current())
    const next = nodes.map((node) => ({ ...node }))
    const startY = 180
    const startNode = next.find((node) => node.type === 'start')
    if (startNode) {
      startNode.x = 120
      startNode.y = startY
    }
    scripts.forEach((script, index) => {
      const target = next.find((node) => node.id === script.id)
      if (target) {
        target.x = 380 + index * 280
        target.y = startY - 24
      }
    })
    const endNode = next.find((node) => node.type === 'end')
    if (endNode) {
      endNode.x = 380 + scripts.length * 280 + 40
      endNode.y = startY
    }
    setNodes(next)
    onNotify('已按执行顺序自动排布，保存后生效')
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
          return {
            id: edge.id,
            from: from.title,
            to: to.title,
            d: `M ${start.x} ${start.y} C ${mid} ${start.y}, ${mid} ${end.y}, ${end.x} ${end.y}`,
          }
        })
        .filter((item): item is { id: string; from: string; to: string; d: string } => item !== null),
    [edges, nodes],
  )

  const linkSource = linkFrom ? nodes.find((node) => node.id === linkFrom) ?? null : null
  const linkSourcePoint = linkSource ? portPoint(linkSource, 'out') : null

  return (
    <div className="flow-screen">
      <header className="flow-top">
        <div>
          <h1>{name.trim() || '未命名流程'}</h1>
          <p>选择爬虫节点并连线成流程：从输出圆点拖到目标节点即可连线。</p>
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
          <button type="button" className="flow-ghost" onClick={autoLayout}>
            自动排布
          </button>
          <button
            type="button"
            className="flow-ghost"
            disabled={saveBusy}
            onClick={() => void handleSave()}
          >
            <IconSave />
            {saveBusy ? '保存中…' : '保存'}
          </button>
          <button type="button" className="task-create" disabled={runBusy} onClick={() => void handleRun()}>
            <IconPlayArrow />
            {runBusy ? '运行中…' : '运行'}
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
                  <path
                    key={path.id}
                    d={path.d}
                    className={path.id === selectedEdgeId ? 'selected' : ''}
                    onClick={(event) => {
                      event.stopPropagation()
                      setSelectedEdgeId(path.id)
                      setSelectedId('')
                    }}
                    onDoubleClick={(event) => {
                      event.stopPropagation()
                      removeEdge(path.id)
                    }}
                  />
                ))}
                {linkSourcePoint && linkPoint ? (
                  <line
                    className="flow-rubber"
                    x1={linkSourcePoint.x}
                    y1={linkSourcePoint.y}
                    x2={linkPoint.x}
                    y2={linkPoint.y}
                  />
                ) : null}
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
                  onPortDown={onPortPointerDown}
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
                  {SPIDER_OPTIONS.map((option) => (
                    <button key={option.value} type="button" onClick={() => addScript(option.value)}>
                      <IconCode />
                      {option.label}
                    </button>
                  ))}
                </div>
              ) : null}
              <button type="button" className={paletteOpen ? 'on' : ''} onClick={() => setPaletteOpen((value) => !value)}>
                节点面板
              </button>
              <button
                type="button"
                aria-label="编排说明"
                onClick={() => onNotify('从节点面板选择爬虫节点，再点右侧圆点接到下一个节点')}
              >
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
            {linkFrom ? <p className="flow-link-hint">按住拖到目标节点的输入圆点松手，或点击目标节点的输入圆点完成连线（Esc 取消）</p> : null}
          </div>
        </section>

        <aside className="flow-props">
          <h2>{selectedEdgeId ? '连线属性' : '节点属性'}</h2>
          {selectedEdgeId ? (
            (() => {
              const edge = edges.find((item) => item.id === selectedEdgeId)
              const from = nodes.find((node) => node.id === edge?.from)
              const to = nodes.find((node) => node.id === edge?.to)
              return (
                <>
                  <p>
                    已选连线：{from?.title ?? '?'} → {to?.title ?? '?'}
                  </p>
                  <p className="flow-run-hint">按 Delete 键或双击连线也可以删除。</p>
                  <button type="button" className="flow-delete" onClick={() => removeEdge(selectedEdgeId)}>
                    删除连线
                  </button>
                </>
              )
            })()
          ) : selected ? (
            <>
              <p>当前节点：{selected.title}</p>
              {selected.type === 'script' ? (
                <>
                  <label>
                    <span>项目（爬虫）</span>
                    <div className="spider-choice">
                      {SPIDER_OPTIONS.map((option) => {
                        const meta = SPIDER_META[option.value]
                        const active = selected.project === option.value
                        return (
                          <button
                            key={option.value}
                            type="button"
                            className={active ? 'spider-choice-btn on' : 'spider-choice-btn'}
                            onClick={() => {
                              updateNode(selected.id, {
                                project: option.value,
                                env: meta?.env ?? '',
                                command: meta?.command ?? '',
                                title: meta ? meta.title : selected.title,
                              })
                            }}
                          >
                            <strong>{meta?.title ?? option.value}</strong>
                            <em>{option.value}</em>
                          </button>
                        )
                      })}
                    </div>
                  </label>
                  <label>
                    <span>节点标题（随爬虫自动生成）</span>
                    <Input value={selected.title} readOnly />
                  </label>
                  <label>
                    <span>环境（自动）</span>
                    <Input value={selected.env || '—'} readOnly />
                  </label>
                  <label>
                    <span>实际执行命令（自动）</span>
                    <code className="flow-cmd-code">{selected.command || '请先选择爬虫'}</code>
                  </label>
                </>
              ) : (
                <label>
                  <span>节点类型</span>
                  <Input value={typeName(selected.type)} readOnly />
                </label>
              )}
              {selected.type === 'script' ? (
                <button type="button" className="flow-delete" onClick={removeSelected}>
                  删除当前节点
                </button>
              ) : null}
            </>
          ) : (
            <p>在画布上选择一个节点或连线进行配置。</p>
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
  onPortDown,
}: {
  node: FlowNode
  selected: boolean
  linking: boolean
  onPointerDown: (event: ReactPointerEvent<HTMLDivElement>, node: FlowNode) => void
  onPointerMove: (event: ReactPointerEvent<HTMLDivElement>) => void
  onPointerUp: () => void
  onPortDown: (event: ReactPointerEvent<HTMLButtonElement>, node: FlowNode, side: 'in' | 'out') => void
}) {
  const size = nodeSize(node.type)
  return (
    <div
      className={`flow-node ${node.type}${selected ? ' selected' : ''}${linking ? ' linking' : ''}`}
      style={{ left: node.x, top: node.y, width: size.w, height: size.h }}
      data-node-id={node.id}
      onPointerDown={(event) => {
        event.stopPropagation()
        onPointerDown(event, node)
      }}
      onPointerMove={onPointerMove}
      onPointerUp={onPointerUp}
    >
      {node.type !== 'start' ? (
        <button
          type="button"
          className="flow-port in"
          aria-label={`${node.title} 输入`}
          data-port-in={node.id}
          onPointerDown={(event) => onPortDown(event, node, 'in')}
        />
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
        <button
          type="button"
          className="flow-port out"
          aria-label={`${node.title} 输出`}
          onPointerDown={(event) => onPortDown(event, node, 'out')}
        />
      ) : null}
    </div>
  )
}

function typeName(type: FlowNodeType) {
  if (type === 'start') return '开始'
  if (type === 'end') return '结束'
  return '脚本节点'
}
