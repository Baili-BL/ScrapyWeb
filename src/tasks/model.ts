import { DEMO_NOW } from '../data.ts'

export type TaskStatus = 'active' | 'paused'

export type SpiderTask = {
  id: string
  name: string
  description: string
  project: string
  env: string
  node: string
  command: string
  cron: string
  concurrent: boolean
  nextRun: string | null
  lastRun: string | null
  status: TaskStatus
  running: boolean
  tags: string[]
}

export type TaskDraft = {
  name: string
  description: string
  project: string
  env: string
  node: string
  command: string
  cron: string
  concurrent: boolean
}

export const EMPTY_DRAFT: TaskDraft = {
  name: '',
  description: '',
  project: 'requests_project',
  env: 'requests_env',
  node: '本地节点',
  command: '',
  cron: '0 * * * *',
  concurrent: false,
}

export function formatDateTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export function dayKey(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`
}

const WEEKDAYS = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT']

/** 分 时 日 月 周。日、月使用 *，周使用 * 或 MON–SUN，时可以用 *。 */
export function nextRunFromCron(cron: string, from = DEMO_NOW): string | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minuteText, hourText, day, month, weekText] = parts
  if (day !== '*' || month !== '*') return null
  const minute = Number(minuteText)
  if (!Number.isInteger(minute) || minute < 0 || minute > 59) return null
  const week = weekText.toUpperCase()
  const weekday = week === '*' ? null : WEEKDAYS.indexOf(week)
  if (week !== '*' && weekday === -1) return null
  const next = new Date(from.getTime())
  next.setSeconds(0, 0)
  if (hourText === '*') {
    if (weekday !== null) return null
    next.setMinutes(minute, 0, 0)
    if (next <= from) next.setHours(next.getHours() + 1)
    return formatDateTime(next)
  }
  const hour = Number(hourText)
  if (!Number.isInteger(hour) || hour < 0 || hour > 23) return null
  next.setHours(hour, minute, 0, 0)
  if (weekday === null) {
    if (next <= from) next.setDate(next.getDate() + 1)
    return formatDateTime(next)
  }
  for (let step = 0; step < 8 && (next <= from || next.getDay() !== weekday); step += 1) {
    next.setDate(next.getDate() + 1)
    next.setHours(hour, minute, 0, 0)
  }
  return next > from && next.getDay() === weekday ? formatDateTime(next) : null
}

export function describeCron(cron: string): string | null {
  const parts = cron.trim().split(/\s+/)
  if (parts.length !== 5) return null
  const [minuteText, hourText, day, month, weekText] = parts
  if (!/^\d+$/.test(minuteText) || day !== '*' || month !== '*') return null
  const week = weekText.toUpperCase()
  if (hourText === '*' && week === '*') return `At minute ${Number(minuteText)}`
  if (!/^\d+$/.test(hourText)) return null
  const clock = `At ${hourText.padStart(2, '0')}:${minuteText.padStart(2, '0')}`
  if (week === '*') return clock
  if (!WEEKDAYS.includes(week)) return null
  return `${clock}, only on ${week}`
}

export const SEED_TASKS: SpiderTask[] = [
  {
    id: 'hourly',
    name: 'hourly_test1_runner',
    description: '每小时运行一次test1.py',
    project: 'requests_project',
    env: 'requests_env',
    node: '本地节点',
    command: 'python src/test1.py',
    cron: '0 * * * *',
    concurrent: true,
    nextRun: '2026-10-22 10:00:00',
    lastRun: '2026-10-22 09:00:00',
    status: 'active',
    running: false,
    tags: [],
  },
  {
    id: 'daily',
    name: 'daily_1py_runner',
    description: '每天运行一次1.py',
    project: 'requests_project',
    env: 'requests_env',
    node: '本地节点',
    command: 'python 1.py',
    cron: '0 0 * * *',
    concurrent: false,
    nextRun: '2026-10-23 00:00:00',
    lastRun: '2026-10-22 00:00:00',
    status: 'active',
    running: false,
    tags: [],
  },
  {
    id: 'evening',
    name: 'evening_test1_runner',
    description: '每天 20:30 运行 test1.py',
    project: 'requests_project',
    env: 'requests_env',
    node: '本地节点',
    command: 'python src/test1.py',
    cron: '30 20 * * *',
    concurrent: false,
    nextRun: '2026-10-22 20:30:00',
    lastRun: '2026-10-21 20:30:00',
    status: 'active',
    running: false,
    tags: [],
  },
  {
    id: 'afternoon',
    name: 'afternoon_test7_runner',
    description: '每天下午运行 test7.py',
    project: 'requests_project',
    env: 'requests_env',
    node: '本地节点',
    command: 'python test7.py',
    cron: '0 14 * * *',
    concurrent: false,
    nextRun: '2026-10-22 14:00:00',
    lastRun: '2026-10-21 14:00:00',
    status: 'active',
    running: false,
    tags: [],
  },
  {
    id: 'morning',
    name: 'morning_test7_runner',
    description: '每天上午运行 test7.py',
    project: 'requests_project',
    env: 'requests_env',
    node: '本地节点',
    command: 'python test7.py',
    cron: '0 9 * * *',
    concurrent: false,
    nextRun: null,
    lastRun: '2026-04-09 20:41:46',
    status: 'paused',
    running: false,
    tags: [],
  },
]
