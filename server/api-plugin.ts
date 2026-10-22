/* eslint-disable no-console */
/**
 * ScrapyWeb 后端 API：以 Vite 中间件插件的形式挂载 /api/*。
 * 真实逻辑：读取爬虫产出、真实运行 scrapy、真实系统指标、任务持久化。
 */
import { spawn } from 'node:child_process'
import crypto from 'node:crypto'
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import fsp from 'node:fs/promises'
import os from 'node:os'
import path from 'node:path'
import { execFile } from 'node:child_process'
import { promisify } from 'node:util'
import { fileURLToPath } from 'node:url'
import type { Plugin } from 'vite'

const execFileAsync = promisify(execFile)

const HERE = path.dirname(fileURLToPath(import.meta.url))
const ROOT = path.resolve(HERE, '..')
const CRAWLERS = path.join(ROOT, 'crawlers')
const DATA = path.join(ROOT, 'data')
const SCRAPY = path.join(ROOT, '.venv', 'Scripts', 'scrapy.exe')
const TASKS_FILE = path.join(DATA, 'tasks.json')
const RUNS_FILE = path.join(DATA, 'runs.json')
const BOTS_FILE = path.join(DATA, 'bots.json')
const USERS_FILE = path.join(DATA, 'users.json')
const AUTH_SECRET_FILE = path.join(DATA, '.auth-secret')

type BotType = 'wecom' | 'feishu'

type BotRecord = {
  id: string
  type: BotType
  name: string
  webhookUrl: string
  enabled: boolean
  /** 仅推送失败告警；关闭则成功/失败都推送。 */
  onlyFailed: boolean
  createdAt: string
}

const BOT_URL_PATTERNS: Record<BotType, RegExp> = {
  wecom: /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=/,
  feishu: /^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\//,
}

type SpiderMeta = {
  name: string
  project: string
  title: string
  description: string
  env: string
  command: string
  outputs: string[]
  cron: string
  tags: string[]
}

const SPIDERS: SpiderMeta[] = [
  {
    name: 'eastmoney_stock',
    project: 'eastmoney_stock',
    title: '东方财富股票行情',
    description: '抓取东方财富股票行情（默认贵州茅台 600519）：实时快照 + 最近 120 个交易日日线',
    env: 'scrapy_env',
    command: 'scrapy crawl eastmoney_stock -O ../data/eastmoney_600519_kline.json -O ../data/eastmoney_600519_kline.csv',
    outputs: ['eastmoney_600519_kline.json', 'eastmoney_600519_kline.csv', 'eastmoney_600519_snapshot.json'],
    cron: '0 17 * * 1-5',
    tags: ['scrapy', '行情'],
  },
  {
    name: 'fcfco_reports',
    project: 'fcfco_reports',
    title: '一创研究报告',
    description: '抓取第一创业期货官网（fcfco.cn）「一创研究」研究报告：标题/日期/详情链接/微信文章外链',
    env: 'scrapy_env',
    command: 'scrapy crawl fcfco_reports -O ../data/fcfco_reports.json',
    outputs: ['fcfco_reports.json'],
    cron: '0 8 * * *',
    tags: ['scrapy', '研报'],
  },
]

type TaskRecord = {
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

type RunRecord = {
  id: string
  spider: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'failed'
  durationSec: number | null
  items: number | null
  message: string | null
}

function ensureDataDir(): void {
  if (!existsSync(DATA)) mkdirSync(DATA, { recursive: true })
}

function loadJson<T>(file: string, fallback: T): T {
  try {
    return JSON.parse(readFileSync(file, 'utf-8')) as T
  } catch {
    return fallback
  }
}

function saveJson(file: string, value: unknown): void {
  ensureDataDir()
  // 必须同步写：后续紧跟的读-改-写（如运行状态推进）依赖文件已落盘，
  // 异步写会与下一次读产生竞态导致更新丢失。
  writeFileSync(file, JSON.stringify(value, null, 2), 'utf-8')
}

function seedTasks(): TaskRecord[] {
  return SPIDERS.map((spider, index) => ({
    id: `task-${spider.name}`,
    spider: spider.name,
    name: spider.name,
    description: spider.description,
    project: spider.project,
    env: spider.env,
    node: '本地节点',
    command: spider.command,
    cron: spider.cron,
    concurrent: index === 0,
    status: 'active' as const,
    tags: spider.tags,
    lastRun: lastRunFromRuns(spider.name),
  }))
}

function loadTasks(): TaskRecord[] {
  ensureDataDir()
  if (!existsSync(TASKS_FILE)) {
    const seeded = seedTasks()
    saveJson(TASKS_FILE, seeded)
    return seeded
  }
  return loadJson<TaskRecord[]>(TASKS_FILE, [])
}

function saveTasks(tasks: TaskRecord[]): void {
  saveJson(TASKS_FILE, tasks)
}

function loadRuns(): RunRecord[] {
  return loadJson<RunRecord[]>(RUNS_FILE, [])
}

function saveRuns(runs: RunRecord[]): void {
  saveJson(RUNS_FILE, runs.slice(0, 100))
}

function lastRunFromRuns(spider: string): string | null {
  const found = loadRuns().find((run) => run.spider === spider && run.finishedAt)
  return found?.finishedAt ?? null
}

/* ------------------------- 机器人推送（企业微信 / 飞书） ------------------------- */

function loadBots(): BotRecord[] {
  ensureDataDir()
  return loadJson<BotRecord[]>(BOTS_FILE, [])
}

function saveBots(bots: BotRecord[]): void {
  saveJson(BOTS_FILE, bots)
}

function formatStampLocal(date = new Date()): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

/** 向单个机器人发送 text 消息，返回是否成功与网关回执。 */
async function sendToBot(bot: BotRecord, text: string): Promise<{ ok: boolean; message: string }> {
  try {
    const response = await fetch(bot.webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(
        bot.type === 'wecom'
          ? { msgtype: 'text', text: { content: text } }
          : { msg_type: 'text', content: { text } },
      ),
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) {
      return { ok: false, message: `HTTP ${response.status}` }
    }
    if (bot.type === 'wecom') {
      const errcode = Number(payload?.errcode ?? -1)
      const errmsg = String(payload?.errmsg ?? '未知')
      return errcode === 0 ? { ok: true, message: errmsg } : { ok: false, message: `errcode=${errcode} ${errmsg}` }
    }
    const code = Number(payload?.code ?? -1)
    const msg = String(payload?.msg ?? '未知')
    return code === 0 ? { ok: true, message: msg } : { ok: false, message: `code=${code} ${msg}` }
  } catch (error) {
    return { ok: false, message: String(error) }
  }
}

/** 爬虫运行结束后向启用的机器人推送通知（异步，不阻塞请求）。 */
function notifyBotsOfRun(status: RunRecord['status'], spider: string, items: number | null, durationSec: number | null, message: string | null): void {
  if (status === 'running') return
  const bots = loadBots().filter((bot) => bot.enabled && (!bot.onlyFailed || status === 'failed'))
  if (!bots.length) return
  const statusLabel = status === 'success' ? '✅ 成功' : '❌ 失败'
  const text = [
    '【ScrapyWeb】爬虫运行通知',
    `任务：${spider}`,
    `状态：${statusLabel}`,
    `抓取：${items ?? '—'} 条`,
    `耗时：${durationSec ?? '—'}s`,
    message ? `错误：${message}` : null,
    `时间：${formatStampLocal()}`,
  ]
    .filter(Boolean)
    .join('\n')
  for (const bot of bots) {
    void sendToBot(bot, text).then((result) => {
      if (!result.ok) console.warn(`[api] bot ${bot.name}(${bot.type}) 推送失败: ${result.message}`)
    })
  }
}

/* ------------------------- 版本探测（缓存） ------------------------- */

let versions: { python: string; scrapy: string } | null = null

async function detectVersions(): Promise<{ python: string; scrapy: string }> {
  if (versions) return versions
  try {
    const { stdout } = await execFileAsync(SCRAPY, ['version'], { cwd: CRAWLERS, timeout: 15000 })
    const scrapy = stdout.trim().replace(/^Scrapy\s+/i, '') || '未知'
    let python = '未知'
    try {
      const py = await execFileAsync(path.join(ROOT, '.venv', 'Scripts', 'python.exe'), ['--version'], { timeout: 15000 })
      python = py.stdout.trim().replace('Python ', '')
    } catch {
      python = '未知'
    }
    versions = { python, scrapy }
  } catch {
    versions = { python: '未知', scrapy: '未知' }
  }
  return versions
}

/* ------------------------- 系统指标 ------------------------- */

async function sampleCpu(): Promise<{ cores: number[]; avg: number }> {
  const before = os.cpus()
  await new Promise((resolve) => setTimeout(resolve, 250))
  const after = os.cpus()
  const cores = after.map((core, index) => {
    const keys = ['user', 'nice', 'sys', 'idle', 'irq'] as const
    let total = 0
    let idle = 0
    for (const key of keys) {
      const delta = core.times[key] - before[index].times[key]
      total += delta
      if (key === 'idle') idle = delta
    }
    return total > 0 ? Math.round(((total - idle) / total) * 100) : 0
  })
  const avg = cores.length ? Math.round(cores.reduce((sum, value) => sum + value, 0) / cores.length) : 0
  return { cores, avg }
}

async function buildMetrics() {
  const cpu = await sampleCpu()
  const totalMem = os.totalmem()
  const freeMem = os.freemem()
  const usedMem = totalMem - freeMem
  let disk = { totalGb: 0, usedGb: 0, freeGb: 0, percent: 0 }
  try {
    const stat = await fsp.statfs(ROOT)
    const total = stat.blocks * stat.bsize
    const free = stat.bavail * stat.bsize
    const used = total - free
    disk = {
      totalGb: Number((total / 1024 ** 3).toFixed(2)),
      usedGb: Number((used / 1024 ** 3).toFixed(2)),
      freeGb: Number((free / 1024 ** 3).toFixed(2)),
      percent: total > 0 ? Number(((used / total) * 100).toFixed(1)) : 0,
    }
  } catch {
    // statfs 不可用时保持 0
  }
  return {
    ts: new Date().toISOString(),
    uptimeSec: Math.round(os.uptime()),
    cpu,
    memory: {
      totalGb: Number((totalMem / 1024 ** 3).toFixed(2)),
      usedGb: Number((usedMem / 1024 ** 3).toFixed(2)),
      availableMb: Number((freeMem / 1024 ** 2).toFixed(2)),
      percent: Number(((usedMem / totalMem) * 100).toFixed(1)),
    },
    disk,
  }
}

/* ------------------------- 爬虫运行 ------------------------- */

const running = new Map<string, number>()

function countItems(outputFile: string): number | null {
  try {
    const parsed = JSON.parse(readFileSync(path.join(DATA, outputFile), 'utf-8'))
    return Array.isArray(parsed) ? parsed.length : null
  } catch {
    return null
  }
}

function startCrawl(spider: SpiderMeta): RunRecord | { error: string } {
  if (running.has(spider.name)) {
    return { error: `爬虫 ${spider.name} 正在运行中` }
  }
  ensureDataDir()
  const run: RunRecord = {
    id: `run-${Date.now()}`,
    spider: spider.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    durationSec: null,
    items: null,
    message: null,
  }
  const runs = loadRuns()
  runs.unshift(run)
  saveRuns(runs)

  const args = ['crawl', spider.name]
  for (const output of spider.outputs) args.push('-O', `../data/${output}`)
  const child = spawn(SCRAPY, args, { cwd: CRAWLERS, windowsHide: true })
  running.set(spider.name, child.pid ?? 0)

  const startedAtMs = Date.now()
  let stderrTail = ''
  child.stderr?.on('data', (chunk: Buffer) => {
    stderrTail = (stderrTail + chunk.toString()).slice(-2000)
  })
  child.on('error', (error) => {
    running.delete(spider.name)
    finishRun(run.id, 'failed', Date.now() - startedAtMs, null, String(error))
  })
  child.on('close', (code) => {
    running.delete(spider.name)
    const primary = spider.outputs.find((file) => file.endsWith('.json'))
    const items = primary ? countItems(primary) : null
    const status = code === 0 ? 'success' : 'failed'
    const message = code === 0 ? null : (stderrTail.split('\n').filter(Boolean).pop() ?? `exit code ${code}`)
    finishRun(run.id, status, Date.now() - startedAtMs, items, message)
  })
  return run
}

function finishRun(runId: string, status: RunRecord['status'], durationMs: number, items: number | null, message: string | null): void {
  const runs = loadRuns()
  const run = runs.find((item) => item.id === runId)
  if (run) {
    run.status = status
    run.finishedAt = new Date().toISOString()
    run.durationSec = Number((durationMs / 1000).toFixed(1))
    run.items = items
    run.message = message
    saveRuns(runs)
  }
  const tasks = loadTasks()
  const task = tasks.find((item) => item.spider === run?.spider)
  if (task && status !== 'running') {
    task.lastRun = new Date().toISOString()
    saveTasks(tasks)
  }
  notifyBotsOfRun(status, run?.spider ?? 'unknown', items, Number((durationMs / 1000).toFixed(1)), message)
}

/* ------------------------- 流程编排 ------------------------- */

const FLOWS_FILE = path.join(DATA, 'flows.json')
const FLOW_RUNS_FILE = path.join(DATA, 'flow-runs.json')

type FlowNodeRecord = {
  id: string
  type: 'start' | 'script' | 'end'
  title: string
  x: number
  y: number
  project: string
  env: string
  command: string
}

type FlowEdgeRecord = { id: string; from: string; to: string }

type FlowFlowRecord = {
  id: string
  name: string
  description: string
  status: 'draft' | 'paused' | 'saved'
  nodes: FlowNodeRecord[]
  edges: FlowEdgeRecord[]
}

type FlowStepRecord = {
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

type FlowRunRecord = {
  id: string
  flowId: string
  flowName: string
  startedAt: string
  finishedAt: string | null
  status: 'running' | 'success' | 'failed'
  durationSec: number | null
  steps: FlowStepRecord[]
}

const FLOW_STEP_LABEL: Record<FlowStepRecord['status'], string> = {
  pending: '待执行',
  running: '运行中',
  success: '成功',
  failed: '失败',
  skipped: '已跳过',
}

function loadFlows(): FlowFlowRecord[] {
  ensureDataDir()
  if (!existsSync(FLOWS_FILE)) {
    const seeded: FlowFlowRecord[] = [
      {
        id: 'flow-daily-pipeline',
        name: '每日数据采集流水线',
        description: '先抓取东方财富行情，再抓取一创研报（真实顺序执行）',
        status: 'saved',
        nodes: [
          { id: 'flow-daily-pipeline-start', type: 'start', title: '开始', x: 120, y: 190, project: '', env: '', command: '' },
          {
            id: 'flow-daily-pipeline-script-1',
            type: 'script',
            title: '东方财富行情',
            x: 380,
            y: 160,
            project: 'eastmoney_stock',
            env: 'scrapy_env',
            command: 'scrapy crawl eastmoney_stock -O ../data/eastmoney_600519_kline.json -O ../data/eastmoney_600519_kline.csv',
          },
          {
            id: 'flow-daily-pipeline-script-2',
            type: 'script',
            title: '一创研报',
            x: 660,
            y: 160,
            project: 'fcfco_reports',
            env: 'scrapy_env',
            command: 'scrapy crawl fcfco_reports -O ../data/fcfco_reports.json',
          },
          { id: 'flow-daily-pipeline-end', type: 'end', title: '结束', x: 940, y: 190, project: '', env: '', command: '' },
        ],
        edges: [
          { id: 'flow-daily-pipeline-e1', from: 'flow-daily-pipeline-start', to: 'flow-daily-pipeline-script-1' },
          { id: 'flow-daily-pipeline-e2', from: 'flow-daily-pipeline-script-1', to: 'flow-daily-pipeline-script-2' },
          { id: 'flow-daily-pipeline-e3', from: 'flow-daily-pipeline-script-2', to: 'flow-daily-pipeline-end' },
        ],
      },
    ]
    saveJson(FLOWS_FILE, seeded)
    return seeded
  }
  return loadJson<FlowFlowRecord[]>(FLOWS_FILE, [])
}

function saveFlows(flows: FlowFlowRecord[]): void {
  saveJson(FLOWS_FILE, flows)
}

function loadFlowRuns(): FlowRunRecord[] {
  return loadJson<FlowRunRecord[]>(FLOW_RUNS_FILE, [])
}

function saveFlowRuns(runs: FlowRunRecord[]): void {
  saveJson(FLOW_RUNS_FILE, runs.slice(0, 100))
}

function updateFlowRun(runId: string, mutate: (run: FlowRunRecord) => void): void {
  const runs = loadFlowRuns()
  const run = runs.find((item) => item.id === runId)
  if (!run) return
  mutate(run)
  saveFlowRuns(runs)
}

/** 从开始节点沿连线深度优先，得到脚本节点执行顺序。 */
function orderedScriptNodes(flow: FlowFlowRecord): FlowNodeRecord[] {
  const start = flow.nodes.find((node) => node.type === 'start')
  if (!start) return flow.nodes.filter((node) => node.type === 'script')
  const visited = new Set<string>()
  const order: FlowNodeRecord[] = []
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

const runningFlows = new Set<string>()

/** 单次真实运行一个爬虫（供流程步骤使用），等待进程退出并统计产出。 */
function runSpiderOnce(meta: SpiderMeta): Promise<{ ok: boolean; items: number | null; durationSec: number; message: string | null }> {
  return new Promise((resolve) => {
    const started = Date.now()
    const args = ['crawl', meta.name]
    for (const output of meta.outputs) args.push('-O', `../data/${output}`)
    const child = spawn(SCRAPY, args, { cwd: CRAWLERS, windowsHide: true })
    let stderrTail = ''
    child.stderr?.on('data', (chunk: Buffer) => {
      stderrTail = (stderrTail + chunk.toString()).slice(-2000)
    })
    child.on('error', (error) => {
      resolve({ ok: false, items: null, durationSec: 0, message: String(error) })
    })
    child.on('close', (code) => {
      const primary = meta.outputs.find((file) => file.endsWith('.json'))
      const items = primary ? countItems(primary) : null
      const ok = code === 0
      resolve({
        ok,
        items,
        durationSec: Number(((Date.now() - started) / 1000).toFixed(1)),
        message: ok ? null : (stderrTail.split('\n').filter(Boolean).pop() ?? `exit code ${code}`),
      })
    })
  })
}

function startFlowRun(flow: FlowFlowRecord): FlowRunRecord | { error: string } {
  if (runningFlows.has(flow.id)) {
    return { error: '该流程正在运行中' }
  }
  const scriptNodes = orderedScriptNodes(flow)
  if (!scriptNodes.length) {
    return { error: '流程中没有脚本节点（或开始节点未连到任何脚本）' }
  }
  const run: FlowRunRecord = {
    id: `frun-${Date.now()}`,
    flowId: flow.id,
    flowName: flow.name,
    startedAt: new Date().toISOString(),
    finishedAt: null,
    status: 'running',
    durationSec: null,
    steps: scriptNodes.map((node) => ({
      nodeId: node.id,
      title: node.title,
      spider: node.project,
      status: 'pending',
      startedAt: null,
      finishedAt: null,
      items: null,
      durationSec: null,
      message: null,
    })),
  }
  const runs = loadFlowRuns()
  runs.unshift(run)
  saveFlowRuns(runs)
  runningFlows.add(flow.id)
  void runFlowSteps(run.id, flow.id)
  return run
}

async function runFlowSteps(runId: string, flowId: string): Promise<void> {
  let ok = true
  const persisted = loadFlowRuns().find((item) => item.id === runId)
  const total = persisted?.steps.length ?? 0
  for (let index = 0; index < total; index += 1) {
    let meta: SpiderMeta | undefined
    updateFlowRun(runId, (run) => {
      meta = SPIDERS.find((item) => item.name === run.steps[index].spider)
      run.steps[index].status = 'running'
      run.steps[index].startedAt = new Date().toISOString()
    })
    if (!meta) {
      updateFlowRun(runId, (run) => {
        run.steps[index].status = 'failed'
        run.steps[index].message = '节点未关联真实爬虫（项目需选择 eastmoney_stock 或 fcfco_reports）'
      })
      ok = false
      break
    }
    if (running.has(meta.name)) {
      updateFlowRun(runId, (run) => {
        run.steps[index].status = 'failed'
        run.steps[index].message = '该爬虫正在其他任务中运行'
      })
      ok = false
      break
    }
    const result = await runSpiderOnce(meta)
    updateFlowRun(runId, (run) => {
      const step = run.steps[index]
      step.status = result.ok ? 'success' : 'failed'
      step.finishedAt = new Date().toISOString()
      step.durationSec = result.durationSec
      step.items = result.items
      step.message = result.message
    })
    if (!result.ok) {
      ok = false
      break
    }
  }
  updateFlowRun(runId, (run) => {
    for (const step of run.steps) {
      if (step.status === 'pending') step.status = 'skipped'
    }
    run.status = ok ? 'success' : 'failed'
    run.finishedAt = new Date().toISOString()
    run.durationSec = Number(((new Date(run.finishedAt).getTime() - new Date(run.startedAt).getTime()) / 1000).toFixed(1))
  })
  runningFlows.delete(flowId)
  const runs = loadFlowRuns()
  const finished = runs.find((item) => item.id === runId)
  if (finished) notifyBotsOfFlowRun(finished)
}

function notifyBotsOfFlowRun(run: FlowRunRecord): void {
  const bots = loadBots().filter((bot) => bot.enabled && (!bot.onlyFailed || run.status === 'failed'))
  if (!bots.length) return
  const stepLines = run.steps
    .map((step) => `  · ${step.title}：${FLOW_STEP_LABEL[step.status]}（${step.items ?? '—'} 条，${step.durationSec ?? '—'}s）`)
    .join('\n')
  const text = [
    '【ScrapyWeb】流程运行通知',
    `流程：${run.flowName}`,
    `状态：${run.status === 'success' ? '✅ 成功' : '❌ 失败'}`,
    stepLines,
    `时间：${formatStampLocal()}`,
  ].join('\n')
  for (const bot of bots) {
    void sendToBot(bot, text).then((result) => {
      if (!result.ok) console.warn(`[api] bot ${bot.name}(${bot.type}) 流程通知失败: ${result.message}`)
    })
  }
}

/* ------------------------- 产出文件 ------------------------- */

async function buildOutputs() {
  ensureDataDir()
  const files = await fsp.readdir(DATA)
  const outputs: Array<{ file: string; sizeKb: number; mtime: string; items: number | null }> = []
  for (const file of files) {
    if (!file.endsWith('.json')) continue
    const full = path.join(DATA, file)
    const stat = await fsp.stat(full)
    let items: number | null = null
    try {
      const parsed = JSON.parse(await fsp.readFile(full, 'utf-8'))
      if (Array.isArray(parsed)) items = parsed.length
    } catch {
      items = null
    }
    outputs.push({
      file,
      sizeKb: Number((stat.size / 1024).toFixed(1)),
      mtime: stat.mtime.toISOString(),
      items,
    })
  }
  return outputs.sort((a, b) => b.mtime.localeCompare(a.mtime))
}

/* ------------------------- 认证与用户管理 ------------------------- */

type UserRole = 'admin' | 'operator' | 'readonly'

type UserRecord = {
  id: string
  username: string
  displayName: string
  role: UserRole
  status: 'active' | 'disabled'
  salt: string
  passwordHash: string
  createdAt: string
  lastLoginAt: string | null
}

const USERNAME_RE = /^[a-zA-Z0-9_]{3,32}$/

function hashPassword(password: string, salt: string): string {
  return crypto.scryptSync(password, salt, 32).toString('hex')
}

function publicUser(user: UserRecord) {
  const { salt, passwordHash, ...rest } = user
  return rest
}

function loadUsers(): UserRecord[] {
  ensureDataDir()
  if (!existsSync(USERS_FILE)) {
    const salt = crypto.randomBytes(8).toString('hex')
    const seeded: UserRecord[] = [
      {
        id: 'user-admin',
        username: 'admin',
        displayName: '管理员',
        role: 'admin',
        status: 'active',
        salt,
        passwordHash: hashPassword('admin123', salt),
        createdAt: new Date().toISOString(),
        lastLoginAt: null,
      },
    ]
    saveJson(USERS_FILE, seeded)
    return seeded
  }
  return loadJson<UserRecord[]>(USERS_FILE, [])
}

function saveUsers(users: UserRecord[]): void {
  saveJson(USERS_FILE, users)
}

function authSecret(): string {
  ensureDataDir()
  if (!existsSync(AUTH_SECRET_FILE)) {
    const secret = crypto.randomBytes(32).toString('hex')
    writeFileSync(AUTH_SECRET_FILE, secret, 'utf-8')
    return secret
  }
  return readFileSync(AUTH_SECRET_FILE, 'utf-8').trim()
}

function signToken(userId: string): string {
  const exp = Date.now() + 7 * 24 * 3600 * 1000
  const payload = `${userId}.${exp}`
  const signature = crypto.createHmac('sha256', authSecret()).update(payload).digest('hex')
  return `${payload}.${signature}`
}

function verifyToken(token: string): string | null {
  const parts = token.split('.')
  if (parts.length !== 3) return null
  const [userId, exp, signature] = parts
  if (!userId || !exp || !signature) return null
  if (Number(exp) < Date.now()) return null
  const expected = crypto.createHmac('sha256', authSecret()).update(`${userId}.${exp}`).digest('hex')
  const a = Buffer.from(signature)
  const b = Buffer.from(expected)
  return a.length === b.length && crypto.timingSafeEqual(a, b) ? userId : null
}

function activeAdminCount(users: UserRecord[]): number {
  return users.filter((user) => user.role === 'admin' && user.status === 'active').length
}

function createUserRecord(username: string, password: string, displayName: string, role: UserRole): UserRecord {
  const salt = crypto.randomBytes(8).toString('hex')
  return {
    id: `user-${crypto.randomBytes(6).toString('hex')}`,
    username,
    displayName: displayName || username,
    role,
    status: 'active',
    salt,
    passwordHash: hashPassword(password, salt),
    createdAt: new Date().toISOString(),
    lastLoginAt: null,
  }
}

function validateNewUser(username: string, password: string): string | null {
  if (!USERNAME_RE.test(username)) return '用户名需 3-32 位，仅限字母/数字/下划线'
  if (password.length < 6) return '密码至少 6 位'
  return null
}

/* ------------------------- AI 配置与调用 ------------------------- */

const AI_CONFIG_FILE = path.join(DATA, 'ai-config.json')

type AiProvider = 'deepseek' | 'openai' | 'moonshot' | 'qwen' | 'custom'

type AiConfigRecord = {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string
  temperature: number
  enabled: boolean
  updatedAt: string
}

const AI_PROVIDERS: Record<AiProvider, { label: string; baseUrl: string; models: string[] }> = {
  deepseek: { label: 'DeepSeek', baseUrl: 'https://api.deepseek.com/v1', models: ['deepseek-chat', 'deepseek-reasoner'] },
  openai: { label: 'OpenAI', baseUrl: 'https://api.openai.com/v1', models: ['gpt-4o-mini', 'gpt-4o', 'gpt-4.1-mini'] },
  moonshot: { label: 'Moonshot AI（Kimi）', baseUrl: 'https://api.moonshot.cn/v1', models: ['moonshot-v1-8k', 'moonshot-v1-32k', 'kimi-k2-0711-preview'] },
  qwen: { label: '通义千问', baseUrl: 'https://dashscope.aliyuncs.com/compatible-mode/v1', models: ['qwen-plus', 'qwen-turbo', 'qwen-max'] },
  custom: { label: '自定义（OpenAI 兼容）', baseUrl: '', models: [] },
}

function loadAiConfig(): AiConfigRecord {
  const saved = loadJson<Partial<AiConfigRecord>>(AI_CONFIG_FILE, {})
  return {
    provider: saved.provider ?? 'deepseek',
    baseUrl: saved.baseUrl ?? AI_PROVIDERS[saved.provider ?? 'deepseek']?.baseUrl ?? AI_PROVIDERS.deepseek.baseUrl,
    model: saved.model ?? 'deepseek-chat',
    apiKey: saved.apiKey ?? '',
    temperature: typeof saved.temperature === 'number' ? saved.temperature : 0.3,
    enabled: saved.enabled ?? false,
    updatedAt: saved.updatedAt ?? '',
  }
}

function maskApiKey(key: string): string {
  if (!key) return ''
  return key.length <= 8 ? '****' : `${key.slice(0, 4)}****${key.slice(-4)}`
}

function aiConfigView(config: AiConfigRecord) {
  return {
    provider: config.provider,
    providerLabel: AI_PROVIDERS[config.provider]?.label ?? config.provider,
    baseUrl: config.baseUrl,
    model: config.model,
    temperature: config.temperature,
    enabled: config.enabled,
    hasKey: Boolean(config.apiKey),
    apiKeyMasked: maskApiKey(config.apiKey),
    updatedAt: config.updatedAt,
  }
}

async function callAiChat(
  config: AiConfigRecord,
  messages: Array<{ role: string; content: string }>,
  maxTokens: number,
): Promise<{ ok: boolean; reply: string; latencyMs: number; message: string }> {
  if (!config.apiKey) return { ok: false, reply: '', latencyMs: 0, message: '未配置 API Key' }
  if (!config.baseUrl || !config.model) return { ok: false, reply: '', latencyMs: 0, message: '接口地址或模型未配置' }
  const started = Date.now()
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), 45000)
  try {
    const response = await fetch(`${config.baseUrl.replace(/\/+$/, '')}/chat/completions`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${config.apiKey}` },
      body: JSON.stringify({ model: config.model, messages, temperature: config.temperature, max_tokens: maxTokens }),
      signal: controller.signal,
    })
    const payload = (await response.json().catch(() => null)) as Record<string, unknown> | null
    if (!response.ok) {
      const detail =
        (payload?.error as { message?: string } | undefined)?.message ?? `HTTP ${response.status}`
      return { ok: false, reply: '', latencyMs: Date.now() - started, message: detail }
    }
    const choices = payload?.choices as Array<{ message?: { content?: string } }> | undefined
    const reply = choices?.[0]?.message?.content ?? ''
    return { ok: true, reply, latencyMs: Date.now() - started, message: '' }
  } catch (error) {
    const aborted = error instanceof Error && error.name === 'AbortError'
    return { ok: false, reply: '', latencyMs: Date.now() - started, message: aborted ? '请求超时（45s）' : String(error) }
  } finally {
    clearTimeout(timer)
  }
}

/* ------------------------- HTTP 工具 ------------------------- */

function sendJson(res: import('node:http').ServerResponse, status: number, payload: unknown): void {
  const body = JSON.stringify(payload)
  res.statusCode = status
  res.setHeader('Content-Type', 'application/json; charset=utf-8')
  res.end(body)
}

function readBody(req: import('node:http').IncomingMessage): Promise<Record<string, unknown>> {
  return new Promise((resolve) => {
    const chunks: Buffer[] = []
    req.on('data', (chunk: Buffer) => chunks.push(chunk))
    req.on('end', () => {
      try {
        resolve(chunks.length ? (JSON.parse(Buffer.concat(chunks).toString('utf-8')) as Record<string, unknown>) : {})
      } catch {
        resolve({})
      }
    })
    req.on('error', () => resolve({}))
  })
}

async function dataFileResponse(res: import('node:http').ServerResponse, file: string): Promise<void> {
  const full = path.join(DATA, file)
  if (!existsSync(full)) {
    sendJson(res, 404, { error: `暂无数据：${file}，请先运行对应爬虫` })
    return
  }
  const raw = readFileSync(full, 'utf-8')
  let parsed: unknown
  try {
    parsed = JSON.parse(raw)
  } catch {
    sendJson(res, 500, { error: `${file} 内容不是合法 JSON` })
    return
  }
  sendJson(res, 200, parsed)
}

/* ------------------------- Overview ------------------------- */

async function buildOverview() {
  const tasks = loadTasks()
  const runs = loadRuns()
  const outputs = await buildOutputs()
  const versions = await detectVersions()
  const active = tasks.filter((task) => task.status === 'active').length

  const projects = SPIDERS.map((spider) => {
    const spiderTasks = tasks.filter((task) => task.spider === spider.name)
    const lastRun = runs.find((run) => run.spider === spider.name && run.finishedAt)
    const output = outputs.find((item) => spider.outputs.includes(item.file) && item.items !== null)
    return {
      name: spider.name,
      title: spider.title,
      description: spider.description,
      tasks: spiderTasks.length,
      lastRun: lastRun?.finishedAt ?? null,
      lastItems: output?.items ?? null,
      tags: spider.tags,
    }
  })

  const envNames = [...new Set(tasks.map((task) => task.env))]
  const envs = envNames.map((name) => ({
    name,
    python: name === 'scrapy_env' ? versions.python : '—',
    deps: name === 'scrapy_env' ? ['scrapy'] : [],
    tasks: tasks.filter((task) => task.env === name).length,
  }))

  const today = new Date().toISOString().slice(0, 10)
  const todayRuns = runs.filter((run) => run.startedAt.startsWith(today))
  const successRuns = todayRuns.filter((run) => run.status === 'success')
  const durations = successRuns.map((run) => run.durationSec ?? 0).filter((value) => value > 0)

  return {
    generatedAt: new Date().toISOString(),
    node: {
      hostname: os.hostname(),
      platform: `${os.type()} ${os.arch()}`,
      python: versions.python,
      scrapy: versions.scrapy,
      cpus: os.cpus().length,
      uptimeSec: Math.round(os.uptime()),
    },
    kpi: {
      projects: projects.length,
      tasks: tasks.length,
      active,
      paused: tasks.length - active,
      envs: envs.length,
      outputs: outputs.length,
    },
    projects,
    envs,
    outputs,
    stats: {
      runsToday: todayRuns.length,
      successToday: successRuns.length,
      successRate: todayRuns.length ? Math.round((successRuns.length / todayRuns.length) * 100) : null,
      avgDuration: durations.length
        ? Number((durations.reduce((sum, value) => sum + value, 0) / durations.length).toFixed(1))
        : null,
    },
    recentRuns: runs.slice(0, 6),
  }
}

/* ------------------------- 路由分发 ------------------------- */

async function handleApi(req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, pathname: string): Promise<boolean> {
  const method = (req.method ?? 'GET').toUpperCase()

  /* ------------------------- 认证（公开路由） ------------------------- */

  if (pathname === '/api/auth/register' && method === 'POST') {
    const body = await readBody(req)
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')
    const displayName = String(body.displayName ?? '').trim()
    const invalid = validateNewUser(username, password)
    if (invalid) {
      sendJson(res, 400, { error: invalid })
      return true
    }
    const users = loadUsers()
    if (users.some((user) => user.username === username)) {
      sendJson(res, 400, { error: '用户名已存在' })
      return true
    }
    const user = createUserRecord(username, password, displayName, 'readonly')
    users.push(user)
    saveUsers(users)
    sendJson(res, 200, publicUser(user))
    return true
  }

  if (pathname === '/api/auth/login' && method === 'POST') {
    const body = await readBody(req)
    const username = String(body.username ?? '').trim()
    const password = String(body.password ?? '')
    const user = loadUsers().find((item) => item.username === username)
    if (!user || user.passwordHash !== hashPassword(password, user.salt)) {
      sendJson(res, 401, { error: '用户名或密码错误' })
      return true
    }
    if (user.status !== 'active') {
      sendJson(res, 403, { error: '该账号已被停用，请联系管理员' })
      return true
    }
    user.lastLoginAt = new Date().toISOString()
    saveUsers(loadUsers().map((item) => (item.id === user.id ? user : item)))
    sendJson(res, 200, { token: signToken(user.id), user: publicUser(user) })
    return true
  }

  if (pathname === '/api/auth/me' && method === 'GET') {
    const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '')
    const userId = verifyToken(token)
    const user = userId ? loadUsers().find((item) => item.id === userId) : undefined
    if (!user || user.status !== 'active') {
      sendJson(res, 401, { error: '未登录或登录已过期' })
      return true
    }
    sendJson(res, 200, publicUser(user))
    return true
  }

  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, 200, { ok: true, ts: new Date().toISOString() })
    return true
  }

  /* ------------------------- 登录守卫 ------------------------- */

  const authUserId = verifyToken((req.headers.authorization ?? '').replace(/^Bearer\s+/i, ''))
  if (!authUserId) {
    sendJson(res, 401, { error: '未登录或登录已过期' })
    return true
  }
  const authUser = loadUsers().find((item) => item.id === authUserId)
  if (!authUser || authUser.status !== 'active') {
    sendJson(res, 401, { error: '账号不存在或已停用' })
    return true
  }
  if (method !== 'GET' && authUser.role === 'readonly') {
    sendJson(res, 403, { error: '只读账号无权执行写操作' })
    return true
  }

  /* ------------------------- 用户管理（仅管理员） ------------------------- */

  if (pathname === '/api/users' || pathname.startsWith('/api/users/')) {
    if (authUser.role !== 'admin') {
      sendJson(res, 403, { error: '仅管理员可管理用户' })
      return true
    }
    if (pathname === '/api/users' && method === 'GET') {
      sendJson(res, 200, loadUsers().map(publicUser))
      return true
    }
    if (pathname === '/api/users' && method === 'POST') {
      const body = await readBody(req)
      const username = String(body.username ?? '').trim()
      const password = String(body.password ?? '')
      const displayName = String(body.displayName ?? '').trim()
      const role = String(body.role ?? 'readonly') as UserRole
      const invalid = validateNewUser(username, password)
      if (invalid) {
        sendJson(res, 400, { error: invalid })
        return true
      }
      if (!['admin', 'operator', 'readonly'].includes(role)) {
        sendJson(res, 400, { error: '角色仅支持 admin / operator / readonly' })
        return true
      }
      const users = loadUsers()
      if (users.some((item) => item.username === username)) {
        sendJson(res, 400, { error: '用户名已存在' })
        return true
      }
      const user = createUserRecord(username, password, displayName, role)
      users.push(user)
      saveUsers(users)
      sendJson(res, 200, publicUser(user))
      return true
    }
    if (pathname === '/api/users/import' && method === 'POST') {
      const body = await readBody(req)
      const rows = Array.isArray(body.rows) ? (body.rows as Array<Record<string, unknown>>) : []
      if (!rows.length) {
        sendJson(res, 400, { error: '导入内容为空' })
        return true
      }
      if (rows.length > 500) {
        sendJson(res, 400, { error: '单次最多导入 500 行' })
        return true
      }
      const users = loadUsers()
      const skipped: Array<{ username: string; reason: string }> = []
      let created = 0
      for (const row of rows) {
        const username = String(row.username ?? '').trim()
        const password = String(row.password ?? '')
        const displayName = String(row.displayName ?? '').trim()
        const roleRaw = String(row.role ?? 'readonly') as UserRole
        const role = ['admin', 'operator', 'readonly'].includes(roleRaw) ? roleRaw : 'readonly'
        const invalid = validateNewUser(username, password)
        if (invalid) {
          skipped.push({ username: username || '(空)', reason: invalid })
          continue
        }
        if (users.some((item) => item.username === username)) {
          skipped.push({ username, reason: '用户名已存在' })
          continue
        }
        users.push(createUserRecord(username, password, displayName, role))
        created += 1
      }
      saveUsers(users)
      sendJson(res, 200, { created, skipped })
      return true
    }
    const userMatch = /^\/api\/users\/([^/]+)$/.exec(pathname)
    if (userMatch) {
      const id = decodeURIComponent(userMatch[1])
      const users = loadUsers()
      const index = users.findIndex((item) => item.id === id)
      if (index === -1) {
        sendJson(res, 404, { error: '用户不存在' })
        return true
      }
      const target = users[index]
      if (method === 'PUT') {
        const body = await readBody(req)
        if (typeof body.password === 'string' && body.password) {
          if (body.password.length < 6) {
            sendJson(res, 400, { error: '密码至少 6 位' })
            return true
          }
          target.salt = crypto.randomBytes(8).toString('hex')
          target.passwordHash = hashPassword(body.password, target.salt)
        }
        if (typeof body.displayName === 'string' && body.displayName.trim()) target.displayName = body.displayName.trim()
        if (body.role === 'admin' || body.role === 'operator' || body.role === 'readonly') target.role = body.role
        if (body.status === 'active' || body.status === 'disabled') target.status = body.status
        if (authUser.id === target.id && (target.status !== 'active' || target.role !== 'admin')) {
          sendJson(res, 400, { error: '不能停用或降级当前登录的管理员自己' })
          return true
        }
        if ((target.role !== 'admin' || target.status !== 'active') && activeAdminCount(users) === 0) {
          sendJson(res, 400, { error: '系统至少需要保留一个启用的管理员' })
          return true
        }
        saveUsers(users)
        sendJson(res, 200, publicUser(target))
        return true
      }
      if (method === 'DELETE') {
        if (target.id === authUser.id) {
          sendJson(res, 400, { error: '不能删除当前登录的账号' })
          return true
        }
        if (target.role === 'admin' && target.status === 'active' && activeAdminCount(users) === 1) {
          sendJson(res, 400, { error: '系统至少需要保留一个启用的管理员' })
          return true
        }
        users.splice(index, 1)
        saveUsers(users)
        sendJson(res, 200, publicUser(target))
        return true
      }
    }
    return true
  }

  /* ------------------------- AI 配置与对话 ------------------------- */

  if (pathname === '/api/ai/config' && method === 'GET') {
    sendJson(res, 200, aiConfigView(loadAiConfig()))
    return true
  }

  if (pathname === '/api/ai/config' && method === 'PUT') {
    const body = await readBody(req)
    const current = loadAiConfig()
    const provider = String(body.provider ?? current.provider) as AiProvider
    if (!AI_PROVIDERS[provider]) {
      sendJson(res, 400, { error: '不支持的模型供应商' })
      return true
    }
    const baseUrl = String(body.baseUrl ?? '').trim() || AI_PROVIDERS[provider].baseUrl
    const model = String(body.model ?? '').trim()
    if (!model) {
      sendJson(res, 400, { error: '请选择或填写模型' })
      return true
    }
    const apiKey = typeof body.apiKey === 'string' && body.apiKey.trim() ? body.apiKey.trim() : current.apiKey
    const enabled = typeof body.enabled === 'boolean' ? body.enabled : current.enabled
    const temperature = typeof body.temperature === 'number' ? Math.min(2, Math.max(0, body.temperature)) : current.temperature
    const next: AiConfigRecord = { provider, baseUrl, model, apiKey, temperature, enabled, updatedAt: new Date().toISOString() }
    saveJson(AI_CONFIG_FILE, next)
    sendJson(res, 200, aiConfigView(next))
    return true
  }

  if (pathname === '/api/ai/test' && method === 'POST') {
    const result = await callAiChat(loadAiConfig(), [{ role: 'user', content: '请只回复四个字：连接成功' }], 32)
    sendJson(res, 200, result)
    return true
  }

  if (pathname === '/api/ai/chat' && method === 'POST') {
    const config = loadAiConfig()
    if (!config.enabled || !config.apiKey) {
      sendJson(res, 400, { error: '请先在「AI 配置」中选择模型并填写 API Key，然后启用' })
      return true
    }
    const body = await readBody(req)
    const history = Array.isArray(body.messages) ? (body.messages as Array<{ role: string; content: string }>) : []
    if (!history.length) {
      sendJson(res, 400, { error: '消息为空' })
      return true
    }
    const withSystem = [
      { role: 'system', content: '你是 ScrapyWeb 爬虫监控平台的 AI 助手，帮助用户排查任务失败原因、解读运行数据。回答保持简洁、使用中文。' },
      ...history.slice(-20),
    ]
    const result = await callAiChat(config, withSystem, 1024)
    if (!result.ok) {
      sendJson(res, 502, { error: result.message })
      return true
    }
    sendJson(res, 200, { reply: result.reply, latencyMs: result.latencyMs })
    return true
  }

  if (pathname === '/api/overview' && method === 'GET') {
    sendJson(res, 200, await buildOverview())
    return true
  }

  if (pathname === '/api/metrics' && method === 'GET') {
    sendJson(res, 200, await buildMetrics())
    return true
  }

  if (pathname === '/api/tasks' && method === 'GET') {
    sendJson(res, 200, loadTasks())
    return true
  }

  if (pathname === '/api/tasks' && method === 'POST') {
    const body = await readBody(req)
    const name = String(body.name ?? '').trim()
    const spider = String(body.spider ?? body.project ?? '').trim()
    if (!name) {
      sendJson(res, 400, { error: '任务名称不能为空' })
      return true
    }
    const tasks = loadTasks()
    if (tasks.some((task) => task.name === name)) {
      sendJson(res, 400, { error: '已有同名任务' })
      return true
    }
    const meta = SPIDERS.find((item) => item.name === spider)
    const task: TaskRecord = {
      id: `task-${Date.now()}`,
      spider: meta?.name ?? '',
      name,
      description: String(body.description ?? ''),
      project: meta?.project ?? String(body.project ?? ''),
      env: String(body.env ?? 'scrapy_env'),
      node: String(body.node ?? '本地节点'),
      command: String(body.command ?? meta?.command ?? ''),
      cron: String(body.cron ?? '0 * * * *'),
      concurrent: Boolean(body.concurrent),
      status: 'active',
      tags: Array.isArray(body.tags) ? (body.tags as string[]) : [],
      lastRun: null,
    }
    tasks.unshift(task)
    saveTasks(tasks)
    sendJson(res, 200, task)
    return true
  }

  const taskMatch = /^\/api\/tasks\/([^/]+)$/.exec(pathname)
  if (taskMatch) {
    const id = decodeURIComponent(taskMatch[1])
    const tasks = loadTasks()
    const index = tasks.findIndex((task) => task.id === id)
    if (index === -1) {
      sendJson(res, 404, { error: '任务不存在' })
      return true
    }
    if (method === 'PUT') {
      const body = await readBody(req)
      const task = tasks[index]
      for (const key of ['name', 'description', 'project', 'env', 'node', 'command', 'cron'] as const) {
        if (typeof body[key] === 'string') task[key] = body[key] as string
      }
      if (typeof body.concurrent === 'boolean') task.concurrent = body.concurrent
      if (body.status === 'active' || body.status === 'paused') task.status = body.status
      if (Array.isArray(body.tags)) task.tags = body.tags as string[]
      saveTasks(tasks)
      sendJson(res, 200, task)
      return true
    }
    if (method === 'DELETE') {
      const [removed] = tasks.splice(index, 1)
      saveTasks(tasks)
      sendJson(res, 200, removed)
      return true
    }
  }

  const runMatch = /^\/api\/tasks\/([^/]+)\/run$/.exec(pathname)
  if (runMatch && method === 'POST') {
    const id = decodeURIComponent(runMatch[1])
    const task = loadTasks().find((item) => item.id === id)
    if (!task) {
      sendJson(res, 404, { error: '任务不存在' })
      return true
    }
    const meta = SPIDERS.find((item) => item.name === task.spider)
    if (!meta) {
      sendJson(res, 400, { error: '该任务没有关联可运行的爬虫' })
      return true
    }
    const result = startCrawl(meta)
    if ('error' in result) {
      sendJson(res, 409, result)
      return true
    }
    sendJson(res, 200, result)
    return true
  }

  if (pathname === '/api/runs' && method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const spider = url.searchParams.get('spider')
    const limit = Number(url.searchParams.get('limit') ?? 50)
    let runs = loadRuns()
    if (spider) runs = runs.filter((run) => run.spider === spider)
    sendJson(res, 200, runs.slice(0, Number.isFinite(limit) ? limit : 50))
    return true
  }

  /* ------------------------- 机器人配置 ------------------------- */

  if (pathname === '/api/bots' && method === 'GET') {
    sendJson(res, 200, loadBots())
    return true
  }

  if (pathname === '/api/bots' && method === 'POST') {
    const body = await readBody(req)
    const type = String(body.type ?? '') as BotType
    const name = String(body.name ?? '').trim()
    const webhookUrl = String(body.webhookUrl ?? '').trim()
    if (type !== 'wecom' && type !== 'feishu') {
      sendJson(res, 400, { error: '机器人类型仅支持 wecom（企业微信）/ feishu（飞书）' })
      return true
    }
    if (!name) {
      sendJson(res, 400, { error: '名称不能为空' })
      return true
    }
    if (!BOT_URL_PATTERNS[type].test(webhookUrl)) {
      sendJson(res, 400, {
        error:
          type === 'wecom'
            ? '企业微信 webhook 需形如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'
            : '飞书 webhook 需形如 https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
      })
      return true
    }
    const bots = loadBots()
    const bot: BotRecord = {
      id: `bot-${Date.now()}`,
      type,
      name,
      webhookUrl,
      enabled: true,
      onlyFailed: Boolean(body.onlyFailed),
      createdAt: new Date().toISOString(),
    }
    bots.push(bot)
    saveBots(bots)
    sendJson(res, 200, bot)
    return true
  }

  const botMatch = /^\/api\/bots\/([^/]+)$/.exec(pathname)
  if (botMatch) {
    const id = decodeURIComponent(botMatch[1])
    const bots = loadBots()
    const index = bots.findIndex((bot) => bot.id === id)
    if (index === -1) {
      sendJson(res, 404, { error: '机器人不存在' })
      return true
    }
    if (method === 'PUT') {
      const body = await readBody(req)
      const bot = bots[index]
      if (typeof body.name === 'string' && body.name.trim()) bot.name = body.name.trim()
      if (typeof body.webhookUrl === 'string' && body.webhookUrl.trim()) {
        const url = body.webhookUrl.trim()
        if (!BOT_URL_PATTERNS[bot.type].test(url)) {
          sendJson(res, 400, { error: 'webhook 地址格式不正确' })
          return true
        }
        bot.webhookUrl = url
      }
      if (typeof body.enabled === 'boolean') bot.enabled = body.enabled
      if (typeof body.onlyFailed === 'boolean') bot.onlyFailed = body.onlyFailed
      saveBots(bots)
      sendJson(res, 200, bot)
      return true
    }
    if (method === 'DELETE') {
      const [removed] = bots.splice(index, 1)
      saveBots(bots)
      sendJson(res, 200, removed)
      return true
    }
  }

  const botTestMatch = /^\/api\/bots\/([^/]+)\/test$/.exec(pathname)
  if (botTestMatch && method === 'POST') {
    const id = decodeURIComponent(botTestMatch[1])
    const bot = loadBots().find((item) => item.id === id)
    if (!bot) {
      sendJson(res, 404, { error: '机器人不存在' })
      return true
    }
    const text = `【ScrapyWeb】测试消息\n这是一条来自机器人配置页的测试推送。\n时间：${formatStampLocal()}`
    const result = await sendToBot(bot, text)
    sendJson(res, 200, result)
    return true
  }

  /* ------------------------- 流程编排 ------------------------- */

  if (pathname === '/api/flows' && method === 'GET') {
    sendJson(res, 200, loadFlows())
    return true
  }

  if (pathname === '/api/flows' && method === 'POST') {
    const body = await readBody(req)
    const name = String(body.name ?? '').trim() || '未命名流程'
    const flow: FlowFlowRecord = {
      id: `flow-${Date.now()}`,
      name,
      description: String(body.description ?? ''),
      status: 'draft',
      nodes: Array.isArray(body.nodes) ? (body.nodes as FlowFlowRecord['nodes']) : [],
      edges: Array.isArray(body.edges) ? (body.edges as FlowFlowRecord['edges']) : [],
    }
    const flows = loadFlows()
    flows.unshift(flow)
    saveFlows(flows)
    sendJson(res, 200, flow)
    return true
  }

  const flowMatch = /^\/api\/flows\/([^/]+)$/.exec(pathname)
  if (flowMatch) {
    const id = decodeURIComponent(flowMatch[1])
    const flows = loadFlows()
    const index = flows.findIndex((flow) => flow.id === id)
    if (index === -1) {
      sendJson(res, 404, { error: '流程不存在' })
      return true
    }
    if (method === 'PUT') {
      const body = await readBody(req)
      const flow = flows[index]
      if (typeof body.name === 'string' && body.name.trim()) flow.name = body.name.trim()
      if (typeof body.description === 'string') flow.description = body.description
      if (body.status === 'draft' || body.status === 'paused' || body.status === 'saved') flow.status = body.status
      if (Array.isArray(body.nodes)) flow.nodes = body.nodes as FlowFlowRecord['nodes']
      if (Array.isArray(body.edges)) flow.edges = body.edges as FlowFlowRecord['edges']
      saveFlows(flows)
      sendJson(res, 200, flow)
      return true
    }
    if (method === 'DELETE') {
      const [removed] = flows.splice(index, 1)
      saveFlows(flows)
      sendJson(res, 200, removed)
      return true
    }
  }

  const flowRunMatch = /^\/api\/flows\/([^/]+)\/run$/.exec(pathname)
  if (flowRunMatch && method === 'POST') {
    const id = decodeURIComponent(flowRunMatch[1])
    const flow = loadFlows().find((item) => item.id === id)
    if (!flow) {
      sendJson(res, 404, { error: '流程不存在' })
      return true
    }
    const result = startFlowRun(flow)
    if ('error' in result) {
      sendJson(res, 409, result)
      return true
    }
    sendJson(res, 200, result)
    return true
  }

  if (pathname === '/api/flow-runs' && method === 'GET') {
    const url = new URL(req.url ?? '/', 'http://localhost')
    const flowId = url.searchParams.get('flowId')
    const limit = Number(url.searchParams.get('limit') ?? 50)
    let runs = loadFlowRuns()
    if (flowId) runs = runs.filter((run) => run.flowId === flowId)
    sendJson(res, 200, runs.slice(0, Number.isFinite(limit) ? limit : 50))
    return true
  }

  if (pathname === '/api/eastmoney/snapshot' && method === 'GET') {
    await dataFileResponse(res, 'eastmoney_600519_snapshot.json')
    return true
  }

  if (pathname === '/api/eastmoney/kline' && method === 'GET') {
    await dataFileResponse(res, 'eastmoney_600519_kline.json')
    return true
  }

  if (pathname === '/api/fcfco/reports' && method === 'GET') {
    await dataFileResponse(res, 'fcfco_reports.json')
    return true
  }

  if (pathname === '/api/health' && method === 'GET') {
    sendJson(res, 200, { ok: true, ts: new Date().toISOString() })
    return true
  }

  return false
}

export function apiPlugin(): Plugin {
  const handler = async (req: import('node:http').IncomingMessage, res: import('node:http').ServerResponse, next: () => void) => {
    const url = new URL(req.url ?? '/', 'http://localhost')
    if (!url.pathname.startsWith('/api/')) {
      next()
      return
    }
    try {
      const handled = await handleApi(req, res, url.pathname)
      if (!handled) sendJson(res, 404, { error: `未知接口：${url.pathname}` })
    } catch (error) {
      sendJson(res, 500, { error: String(error) })
    }
  }

  return {
    name: 'scrapyweb-api',
    configureServer(server) {
      server.middlewares.use(handler)
    },
    configurePreviewServer(server) {
      server.middlewares.use(handler)
    },
  }
}
