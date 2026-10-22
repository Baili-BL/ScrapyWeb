/** 后端 /api/* 的类型化客户端。 */

export type TaskItem = {
  id: string
  spider: string
  name: string
  description: string
  project: string
  env: string
  node: string
  command: string
  cron: string
  concurrent: boolean
  status: 'active' | 'paused'
  tags: string[]
  lastRun: string | null
}

export type RunRecord = {
  id: string
  spider: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'failed'
  durationSec: number | null
  items: number | null
  message: string | null
}

export type OverviewProject = {
  name: string
  title: string
  description: string
  tasks: number
  lastRun: string | null
  lastItems: number | null
  tags: string[]
}

export type OverviewEnv = {
  name: string
  python: string
  deps: string[]
  tasks: number
}

export type OutputFile = {
  file: string
  sizeKb: number
  mtime: string
  items: number | null
}

export type Overview = {
  generatedAt: string
  node: {
    hostname: string
    platform: string
    python: string
    scrapy: string
    cpus: number
    uptimeSec: number
  }
  kpi: {
    projects: number
    tasks: number
    active: number
    paused: number
    envs: number
    outputs: number
  }
  projects: OverviewProject[]
  envs: OverviewEnv[]
  outputs: OutputFile[]
  stats: {
    runsToday: number
    successToday: number
    successRate: number | null
    avgDuration: number | null
  }
  recentRuns: RunRecord[]
}

export type Metrics = {
  ts: string
  uptimeSec: number
  cpu: { cores: number[]; avg: number }
  memory: { totalGb: number; usedGb: number; availableMb: number; percent: number }
  disk: { totalGb: number; usedGb: number; freeGb: number; percent: number }
}

export type KlineItem = {
  type: string
  code: string
  name: string
  date: string
  open: number | null
  close: number | null
  high: number | null
  low: number | null
  volume: number | null
  amount: number | null
  amplitude: number | null
  pct_change: number | null
  change: number | null
  turnover: number | null
}

export type Snapshot = {
  saved_at: string
  snapshot: {
    code: string
    name: string
    price: number | null
    prev_close: number | null
    open: number | null
    high: number | null
    low: number | null
    volume: number | null
    amount: number | null
    pct_change: number | null
    amplitude: number | null
    turnover: number | null
    pe_ttm: number | null
    market_cap: number | null
    fetched_at: string
  }
}

export type ReportItem = {
  source: string
  category: string
  article_id: string
  title: string
  date: string | null
  detail_url: string
  outbound_url: string | null
  attachments: string[]
  body_text: string | null
  crawled_at: string
}

export type BotType = 'wecom' | 'feishu'

export type BotItem = {
  id: string
  type: BotType
  name: string
  webhookUrl: string
  enabled: boolean
  onlyFailed: boolean
  createdAt: string
}

export type BotTestResult = { ok: boolean; message: string }

export type BotDraftPayload = {
  type: BotType
  name: string
  webhookUrl: string
  onlyFailed: boolean
}

export function fetchBots(): Promise<BotItem[]> {
  return request<BotItem[]>('/api/bots')
}

export function createBot(payload: BotDraftPayload): Promise<BotItem> {
  return request<BotItem>('/api/bots', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateBot(id: string, patch: Partial<BotDraftPayload> & { enabled?: boolean }): Promise<BotItem> {
  return request<BotItem>(`/api/bots/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export function deleteBot(id: string): Promise<BotItem> {
  return request<BotItem>(`/api/bots/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function testBot(id: string): Promise<BotTestResult> {
  return request<BotTestResult>(`/api/bots/${encodeURIComponent(id)}/test`, { method: 'POST' })
}

/* ------------------------- 流程编排 ------------------------- */

import type { FlowRecord } from './workflow/model.ts'

export type FlowItem = FlowRecord

export type FlowStepRecord = {
  nodeId: string
  title: string
  spider: string
  status: 'pending' | 'running' | 'success' | 'failed' | 'skipped'
  startedAt: string | null
  finishedAt: string | null
  items: number | null
  durationSec: number | null
  message: string | null
}

export type FlowRunRecord = {
  id: string
  flowId: string
  flowName: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'failed'
  durationSec: number | null
  steps: FlowStepRecord[]
}

export function fetchFlows(): Promise<FlowItem[]> {
  return request<FlowItem[]>('/api/flows')
}

export function createFlow(payload: { name: string; description: string; nodes: FlowItem['nodes']; edges: FlowItem['edges'] }): Promise<FlowItem> {
  return request<FlowItem>('/api/flows', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateFlow(
  id: string,
  patch: Partial<Pick<FlowItem, 'name' | 'description' | 'nodes' | 'edges' | 'status'>>,
): Promise<FlowItem> {
  return request<FlowItem>(`/api/flows/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export function deleteFlow(id: string): Promise<FlowItem> {
  return request<FlowItem>(`/api/flows/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function runFlow(id: string): Promise<FlowRunRecord> {
  return request<FlowRunRecord>(`/api/flows/${encodeURIComponent(id)}/run`, { method: 'POST' })
}

export function fetchFlowRuns(flowId?: string, limit = 50): Promise<FlowRunRecord[]> {
  const query = new URLSearchParams()
  if (flowId) query.set('flowId', flowId)
  query.set('limit', String(limit))
  return request<FlowRunRecord[]>(`/api/flow-runs?${query.toString()}`)
}

/** 流程运行为后台异步执行，轮询直到该次运行结束。 */
export async function pollFlowRun(runId: string, timeoutMs = 900000, intervalMs = 2500): Promise<FlowRunRecord> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const runs = await fetchFlowRuns(undefined, 100)
    const found = runs.find((run) => run.id === runId)
    if (found && found.status !== 'running') return found
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error('等待流程运行结束超时')
}

export type TaskDraftPayload = {
  name: string
  description: string
  spider: string
  project: string
  env: string
  node: string
  command: string
  cron: string
  concurrent: boolean
  tags: string[]
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const response = await fetch(url, {
    headers: { 'Content-Type': 'application/json' },
    ...init,
  })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    const message = (payload as { error?: string } | null)?.error ?? `请求失败（${response.status}）`
    throw new Error(message)
  }
  return payload as T
}

export function fetchOverview(): Promise<Overview> {
  return request<Overview>('/api/overview')
}

export function fetchMetrics(): Promise<Metrics> {
  return request<Metrics>('/api/metrics')
}

export function fetchTasks(): Promise<TaskItem[]> {
  return request<TaskItem[]>('/api/tasks')
}

export function createTask(payload: TaskDraftPayload): Promise<TaskItem> {
  return request<TaskItem>('/api/tasks', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateTask(id: string, patch: Partial<TaskDraftPayload> & { status?: 'active' | 'paused' }): Promise<TaskItem> {
  return request<TaskItem>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export function deleteTask(id: string): Promise<TaskItem> {
  return request<TaskItem>(`/api/tasks/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function runTask(id: string): Promise<RunRecord> {
  return request<RunRecord>(`/api/tasks/${encodeURIComponent(id)}/run`, { method: 'POST' })
}

/** 运行是异步启动的（POST 立即返回 running），轮询直到该次运行结束。 */
export async function pollRun(runId: string, timeoutMs = 600000, intervalMs = 2000): Promise<RunRecord> {
  const deadline = Date.now() + timeoutMs
  while (Date.now() < deadline) {
    const runs = await fetchRuns(undefined, 100)
    const found = runs.find((run) => run.id === runId)
    if (found && found.status !== 'running') return found
    await new Promise((resolve) => setTimeout(resolve, intervalMs))
  }
  throw new Error('等待运行结束超时')
}

export function fetchRuns(spider?: string, limit = 50): Promise<RunRecord[]> {
  const query = new URLSearchParams()
  if (spider) query.set('spider', spider)
  if (limit) query.set('limit', String(limit))
  return request<RunRecord[]>(`/api/runs?${query.toString()}`)
}

export function fetchKline(): Promise<KlineItem[]> {
  return request<KlineItem[]>('/api/eastmoney/kline')
}

export function fetchSnapshot(): Promise<Snapshot> {
  return request<Snapshot>('/api/eastmoney/snapshot')
}

export function fetchReports(): Promise<ReportItem[]> {
  return request<ReportItem[]>('/api/fcfco/reports')
}
