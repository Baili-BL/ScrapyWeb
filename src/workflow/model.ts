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
      {
        id: `${id}-script-1`,
        type: 'script',
        title: '东方财富行情',
        x: 390,
        y: 168,
        project: 'eastmoney_stock',
        env: 'scrapy_env',
        command: SPIDER_META.eastmoney_stock.command,
      },
      { id: `${id}-end`, type: 'end', title: '结束', x: 700, y: 196, project: '', env: '', command: '' },
    ],
    edges: [
      { id: `${id}-e1`, from: `${id}-start`, to: `${id}-script-1` },
      { id: `${id}-e2`, from: `${id}-script-1`, to: `${id}-end` },
    ],
  }
}

/** 从开始节点沿连线深度优先，得到脚本节点（爬虫）执行顺序。 */
export function orderedScriptNodes(flow: FlowRecord): FlowNode[] {
  const start = flow.nodes.find((node) => node.type === 'start')
  if (!start) return flow.nodes.filter((node) => node.type === 'script')
  const visited = new Set<string>()
  const order: FlowNode[] = []
  const walk = (id: string) => {
    if (visited.has(id)) return
    visited.add(id)
    const node = flow.nodes.find((item) => item.id === id)
    if (!node) return
    if (node.type === 'script') order.push(node)
    for (const edge of flow.edges.filter((item) => item.from === id)) walk(edge.to)
  }
  walk(start.id)
  return order
}

/** 可真实运行的爬虫（与后端注册表一致）。 */
export const SPIDER_OPTIONS = [
  { value: 'eastmoney_stock', label: 'eastmoney_stock（东方财富行情）' },
  { value: 'fcfco_reports', label: 'fcfco_reports（一创研报）' },
]

/** 爬虫元数据：选择后自动生成标题/环境/命令，用户无需手输。 */
export const SPIDER_META: Record<string, { title: string; env: string; command: string }> = {
  eastmoney_stock: {
    title: '东方财富行情',
    env: 'scrapy_env',
    command: 'scrapy crawl eastmoney_stock -O ../data/eastmoney_600519_kline.json -O ../data/eastmoney_600519_kline.csv',
  },
  fcfco_reports: {
    title: '一创研报',
    env: 'scrapy_env',
    command: 'scrapy crawl fcfco_reports -O ../data/fcfco_reports.json',
  },
}
