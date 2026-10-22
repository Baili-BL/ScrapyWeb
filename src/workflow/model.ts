export type FlowNodeType = 'start' | 'script' | 'end'

export type FlowNode = {
  id: string
  type: FlowNodeType
  title: string
  x: number
  y: number
  project: string
  env: string
  command: string
}

export type FlowEdge = {
  id: string
  from: string
  to: string
}

export type FlowRecord = {
  id: string
  name: string
  description: string
  status: 'draft' | 'paused' | 'saved'
  nodes: FlowNode[]
  edges: FlowEdge[]
}

export function nodeSize(type: FlowNodeType) {
  if (type === 'script') return { w: 210, h: 126 }
  return { w: 148, h: 68 }
}

export function blankFlow(id: string, name = '未命名流程'): FlowRecord {
  return {
    id,
    name,
    description: '',
    status: 'draft',
    nodes: [
      { id: `${id}-start`, type: 'start', title: '开始', x: 150, y: 196, project: '', env: '', command: '' },
      { id: `${id}-script-1`, type: 'script', title: '脚本节点 1', x: 390, y: 168, project: '', env: '', command: '' },
      { id: `${id}-end`, type: 'end', title: '结束', x: 700, y: 196, project: '', env: '', command: '' },
    ],
    edges: [
      { id: `${id}-e1`, from: `${id}-start`, to: `${id}-script-1` },
      { id: `${id}-e2`, from: `${id}-script-1`, to: `${id}-end` },
    ],
  }
}

export const SEED_FLOWS: FlowRecord[] = [
  {
    ...blankFlow('sample', '编排流程代码样例'),
    description: '编排流程代码样例，一些代码参考',
    status: 'paused',
  },
]

let flowSeq = 1

export function nextFlowId() {
  flowSeq += 1
  return `flow-${flowSeq}`
}
