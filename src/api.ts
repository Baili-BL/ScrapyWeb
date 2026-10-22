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

/* ------------------------- 认证与用户 ------------------------- */

export type UserRole = 'admin' | 'operator' | 'readonly'

export type AuthUser = {
  id: string
  username: string
  displayName: string
  role: UserRole
  status: 'active' | 'disabled'
  createdAt: string
  lastLoginAt: string | null
}

export type LoginResult = { token: string; user: AuthUser }

export const ROLE_LABEL: Record<UserRole, string> = {
  admin: '管理员',
  operator: '操作员',
  readonly: '只读',
}

export function login(username: string, password: string): Promise<LoginResult> {
  return request<LoginResult>('/api/auth/login', { method: 'POST', body: JSON.stringify({ username, password }) })
}

export function register(payload: { username: string; password: string; displayName: string }): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/register', { method: 'POST', body: JSON.stringify(payload) })
}

export function fetchMe(): Promise<AuthUser> {
  return request<AuthUser>('/api/auth/me')
}

export function fetchUsers(): Promise<AuthUser[]> {
  return request<AuthUser[]>('/api/users')
}

export function adminCreateUser(payload: {
  username: string
  password: string
  displayName: string
  role: UserRole
}): Promise<AuthUser> {
  return request<AuthUser>('/api/users', { method: 'POST', body: JSON.stringify(payload) })
}

export function importUsers(
  rows: Array<{ username: string; password: string; displayName?: string; role?: UserRole }>,
): Promise<{ created: number; skipped: Array<{ username: string; reason: string }> }> {
  return request<{ created: number; skipped: Array<{ username: string; reason: string }> }>('/api/users/import', {
    method: 'POST',
    body: JSON.stringify({ rows }),
  })
}

export function adminUpdateUser(
  id: string,
  patch: { displayName?: string; role?: UserRole; status?: 'active' | 'disabled'; password?: string },
): Promise<AuthUser> {
  return request<AuthUser>(`/api/users/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export function adminDeleteUser(id: string): Promise<AuthUser> {
  return request<AuthUser>(`/api/users/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

/* ------------------------- AI 配置与对话 ------------------------- */

export type AiProvider = 'deepseek' | 'openai' | 'moonshot' | 'qwen' | 'custom'

export type AiConfigView = {
  provider: AiProvider
  providerLabel: string
  baseUrl: string
  model: string
  temperature: number
  enabled: boolean
  hasKey: boolean
  apiKeyMasked: string
  updatedAt: string
}

export type AiSavePayload = {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey?: string
  temperature?: number
  enabled?: boolean
}

export type AiCallResult = { ok: boolean; reply: string; latencyMs: number; message: string }

export type AiChatMessage = { role: 'user' | 'assistant' | 'system'; content: string }

export const AI_PROVIDER_PRESETS: Record<AiProvider, { label: string; baseUrl: string; models: string[] }> = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  moonshot: { label: 'Moonshot AI（Kimi）', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-k2-0711-preview'] },
  qwen: { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  custom: { label: '自定义（OpenAI 兼容）', baseUrl: '', models: [] },
}

export function fetchAiConfig(): Promise<AiConfigView> {
  return request<AiConfigView>('/api/ai/config')
}

export function saveAiConfig(payload: AiSavePayload): Promise<AiConfigView> {
  return request<AiConfigView>('/api/ai/config', { method: 'PUT', body: JSON.stringify(payload) })
}

export function testAi(): Promise<AiCallResult> {
  return request<AiCallResult>('/api/ai/test', { method: 'POST' })
}

export function chatAi(messages: AiChatMessage[]): Promise<{ reply: string; latencyMs: number }> {
  return request<{ reply: string; latencyMs: number }>('/api/ai/chat', { method: 'POST', body: JSON.stringify({ messages }) })
}

/* ------------------------- 分布式节点 ------------------------- */

export type LocalNodeInfo = {
  id: string
  name: string
  role: string
  host: string
  status: 'online'
  os: string
  arch: string
  cpuModel: string
  cores: number
  totalMemGb: number
  python: string
  scrapy: string
  uptimeSec: number
  heartbeat: string
  runningSpiders: string[]
  metrics: Metrics
}

export type RemoteNodeItem = {
  id: string
  name: string
  host: string
  description: string
  addedAt: string
  lastProbeAt: string | null
  lastStatus: 'unknown' | 'connected' | 'disconnected'
}

export type NodesPayload = {
  local: LocalNodeInfo
  remote: RemoteNodeItem[]
  generatedAt: string
}

export type RemoteNodeDraft = { name: string; host: string; description: string }

export function fetchNodes(): Promise<NodesPayload> {
  return request<NodesPayload>('/api/nodes')
}

export function createRemoteNode(payload: RemoteNodeDraft): Promise<RemoteNodeItem> {
  return request<RemoteNodeItem>('/api/nodes', { method: 'POST', body: JSON.stringify(payload) })
}

export function updateRemoteNode(id: string, patch: Partial<RemoteNodeDraft>): Promise<RemoteNodeItem> {
  return request<RemoteNodeItem>(`/api/nodes/${encodeURIComponent(id)}`, { method: 'PUT', body: JSON.stringify(patch) })
}

export function deleteRemoteNode(id: string): Promise<RemoteNodeItem> {
  return request<RemoteNodeItem>(`/api/nodes/${encodeURIComponent(id)}`, { method: 'DELETE' })
}

export function probeRemoteNode(id: string): Promise<{ status: RemoteNodeItem['lastStatus']; lastProbeAt: string }> {
  return request<{ status: RemoteNodeItem['lastStatus']; lastProbeAt: string }>(`/api/nodes/${encodeURIComponent(id)}/probe`, {
    method: 'POST',
  })
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

const TOKEN_KEY = 'scrapyweb-auth-token'

export function getAuthToken(): string {
  return localStorage.getItem(TOKEN_KEY) ?? ''
}

export function clearAuthToken(): void {
  localStorage.removeItem(TOKEN_KEY)
}

async function request<T>(url: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken()
  const response = await fetch(url, {
    ...init,
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
  })
  const text = await response.text()
  let payload: unknown = null
  try {
    payload = text ? JSON.parse(text) : null
  } catch {
    payload = null
  }
  if (!response.ok) {
    // 非 认证接口 遇到 401：本地凭证失效，回到登录页
    if (response.status === 401 && !url.startsWith('/api/auth/')) {
      clearAuthToken()
      if (typeof window !== 'undefined') window.location.reload()
    }
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
