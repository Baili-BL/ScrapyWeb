/* eslint-disable no-console */
/**
 * ScrapyWeb 后端 API：以 Vite 中间件插件的形式挂载 /api/*。
 * 真实逻辑：读取爬虫产出、真实运行 scrapy、真实系统指标、任务持久化。
 */
import { spawn } from 'node:child_process'
import { existsSync, mkdirSync, readFileSync } from 'node:fs'
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
  fsp.writeFile(file, JSON.stringify(value, null, 2), 'utf-8').catch((error) => {
    console.error('[api] write failed:', file, error)
  })
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
