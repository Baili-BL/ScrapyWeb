export type TaskStatus = 'active' | 'paused'

export type SpiderTask = {
  id: string
  /** 关联的爬虫名（eastmoney_stock / fcfco_reports），演示任务可能为空。 */
  spider: string
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
  project: 'eastmoney_stock',
  env: 'scrapy_env',
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
export function nextRunFromCron(cron: string, from = new Date()): string | null {
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
