/** 演示数据锚定在 2026-10-22 09:27，与监控页截图一致。 */
export const DEMO_NOW = new Date(2026, 9, 22, 9, 27, 0)

export const PROJECTS = [
  { name: 'requests_project', tasks: 5 },
  { name: '编排流程代码样例', tasks: 0 },
]

export const ENVS = [{ name: 'requests_env', tasks: 5 }]

export const TASK_STATUS = { running: 4, paused: 1 }

export const KPI = {
  tasks: TASK_STATUS.running + TASK_STATUS.paused,
  projects: PROJECTS.length,
  active: TASK_STATUS.running,
  envs: ENVS.length,
}

export const NODE = {
  name: '本地节点',
  role: '主控节点',
  host: '127.0.0.1:6800',
  os: 'Windows',
  arch: 'x64',
  python: '3.11.9',
  cores: 2,
  frequency: '2500 MHz',
  uptime: '6 天 14 小时',
  heartbeat: '10/22, 09:27 AM',
  memTotalGb: 1.87,
}

export const DISK_MOUNTS = [
  '/usr/sbin/docker-init',
  '/logs',
  '/static',
  '/app/data',
  '/etc/resolv.conf',
  '/etc/hostname',
  '/etc/hosts',
] as const

export const DISK = {
  readIoGb: 47.89,
  writeIoGb: 54.97,
  readIops: 3790141,
  writeIops: 3429095,
  device: '/dev/vda3',
  fs: 'ext4',
  percent: 43.26,
  usedGb: 16.88,
  totalGb: 39.02,
  mounts: DISK_MOUNTS,
}

const WEEKDAYS = ['周日', '周一', '周二', '周三', '周四', '周五', '周六']
const MONTHS = ['一月', '二月', '三月', '四月', '五月', '六月', '七月', '八月', '九月', '十月', '十一月', '十二月']
const PEAK_HOURS = new Set([0, 14, 20])

const FIXED_DURATION: Record<string, number> = {
  '9-0': 0.494,
  '8-0': 0.46,
  '7-0': 0.788,
  '6-0': 0.396,
}

export type Execution = {
  id: string
  name: string
  time: string
  status: 'success' | 'pending'
  duration: string
  hour: number
  sort: number
}

export type LiveMetrics = {
  cpuAvg: number
  cpuPeak: number
  load1: number
  cores: number[]
  memUsedPercent: number
  memAvailableMb: number
  memCacheMb: number
  memUsedGb: number
  swapPercent: number
}

export type DensityPoint = {
  label: string
  value: number
  hour: number
  count: number
}

export function isSameDay(a: Date, b: Date): boolean {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate()
}

export function isFutureDay(date: Date): boolean {
  const day = new Date(date.getFullYear(), date.getMonth(), date.getDate()).getTime()
  const today = new Date(DEMO_NOW.getFullYear(), DEMO_NOW.getMonth(), DEMO_NOW.getDate()).getTime()
  return day > today
}

export function formatStamp(date: Date): string {
  const month = date.getMonth() + 1
  const day = date.getDate()
  const rawHour = date.getHours()
  const ampm = rawHour >= 12 ? 'PM' : 'AM'
  const hour12 = rawHour % 12 === 0 ? 12 : rawHour % 12
  const hh = String(hour12).padStart(2, '0')
  const mm = String(date.getMinutes()).padStart(2, '0')
  return `${month}/${day}, ${hh}:${mm} ${ampm}`
}

export function formatMonthTitle(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getFullYear()}`
}

export function formatDayTitle(date: Date): string {
  return `${date.getFullYear()}年${date.getMonth() + 1}月${date.getDate()}日 ${WEEKDAYS[date.getDay()]}`
}

export function countAt(date: Date, hour: number): number {
  let count = PEAK_HOURS.has(hour) ? 2 : 1
  if (date.getFullYear() === 2026 && date.getMonth() === 9 && date.getDate() === 16 && hour === 12) {
    count += 1
  }
  return count
}

export function monthCells(year: number, month: number): { date: Date; inMonth: boolean }[] {
  const firstWeekday = new Date(year, month, 1).getDay()
  const daysInMonth = new Date(year, month + 1, 0).getDate()
  const cells: { date: Date; inMonth: boolean }[] = []

  for (let index = 0; index < firstWeekday; index += 1) {
    cells.push({
      date: new Date(year, month, index - firstWeekday + 1),
      inMonth: false,
    })
  }
  for (let day = 1; day <= daysInMonth; day += 1) {
    cells.push({ date: new Date(year, month, day), inMonth: true })
  }
  let extra = 1
  while (cells.length % 7 !== 0) {
    cells.push({ date: new Date(year, month + 1, extra), inMonth: false })
    extra += 1
  }
  return cells
}

export const WEEK_LABELS = WEEKDAYS

function runStatus(date: Date, hour: number): 'success' | 'pending' {
  if (isFutureDay(date)) return 'pending'
  if (isSameDay(date, DEMO_NOW) && hour > DEMO_NOW.getHours()) return 'pending'
  return 'success'
}

function durationAt(date: Date, hour: number, index: number): number {
  if (isSameDay(date, DEMO_NOW)) {
    const fixed = FIXED_DURATION[`${hour}-${index}`]
    if (fixed !== undefined) return fixed
  }
  const seed = date.getFullYear() * 10000 + (date.getMonth() + 1) * 100 + date.getDate()
  const noise = Math.abs(Math.sin(seed * 0.17 + hour * 1.7 + index * 3.1))
  return Math.round((0.35 + noise * 0.48) * 1000) / 1000
}

export function executionsFor(date: Date): Execution[] {
  const rows: Execution[] = []
  for (let hour = 0; hour < 24; hour += 1) {
    const count = countAt(date, hour)
    const status = runStatus(date, hour)
    for (let index = 0; index < count; index += 1) {
      const minute = index === 0 ? 0 : 30
      const when = new Date(date.getFullYear(), date.getMonth(), date.getDate(), hour, minute, 0)
      rows.push({
        id: `${when.getTime()}-${index}`,
        name: 'hourly_test1_runner',
        time: formatStamp(when),
        status,
        duration: status === 'success' ? `${durationAt(date, hour, index).toFixed(3)}s` : '—',
        hour,
        sort: when.getTime(),
      })
    }
  }
  return rows
}

export function splitExecutions(date: Date): { done: Execution[]; pending: Execution[] } {
  const rows = executionsFor(date)
  return {
    done: rows.filter((item) => item.status === 'success').sort((a, b) => b.sort - a.sort),
    pending: rows.filter((item) => item.status === 'pending').sort((a, b) => a.sort - b.sort),
  }
}

export function recentExecutions(): Execution[] {
  return splitExecutions(DEMO_NOW).done.slice(0, 4)
}

export function daySummary(date: Date): { planned: number; done: number; pending: number } {
  const parts = splitExecutions(date)
  return {
    planned: parts.done.length + parts.pending.length,
    done: parts.done.length,
    pending: parts.pending.length,
  }
}

export function completedCount(date: Date): number | null {
  if (isFutureDay(date)) return null
  return splitExecutions(date).done.length
}

export function planSummary(date: Date): { total: number; peakHour: number; peakCount: number; average: number } {
  let total = 0
  let peakHour = 0
  let peakCount = 0
  for (let hour = 0; hour < 24; hour += 1) {
    const count = countAt(date, hour)
    total += count
    if (count > peakCount) {
      peakCount = count
      peakHour = hour
    }
  }
  return { total, peakHour, peakCount, average: total / 24 }
}

export function formatAverage(value: number): string {
  return (Math.round(value * 10) / 10).toFixed(1)
}

export function formatShare(part: number, total: number): string {
  if (!total) return '0%'
  return `${((part / total) * 100).toFixed(1)}%`
}

export function averageDuration(items: Execution[]): string {
  const nums = items.map((item) => Number.parseFloat(item.duration)).filter((value) => !Number.isNaN(value))
  if (!nums.length) return '—'
  const avg = nums.reduce((sum, value) => sum + value, 0) / nums.length
  return `${avg.toFixed(3)}s`
}

export function successRate(items: Execution[]): string {
  if (!items.length) return '—'
  const ok = items.filter((item) => item.status === 'success').length
  return `${Math.round((ok / items.length) * 100)}%`
}

export function densitySeries(): DensityPoint[] {
  const sigma = 0.62
  const points: DensityPoint[] = []
  for (let step = 0; step <= 23 * 4; step += 1) {
    const hourFloat = step / 4
    const hour = Math.min(23, Math.floor(hourFloat + 1e-9))
    let extra = 0
    for (const center of [0, 14, 20]) {
      const distance = hourFloat - center
      extra = Math.max(extra, Math.exp(-(distance * distance) / (2 * sigma * sigma)))
    }
    const onTick = step % 4 === 0
    points.push({
      label: onTick ? `${hour}:00` : '',
      value: Number((1 + extra).toFixed(3)),
      hour,
      count: countAt(DEMO_NOW, hour),
    })
  }
  return points
}

function clamp(value: number, min: number, max: number): number {
  return Math.min(max, Math.max(min, value))
}

export function metricsAt(tick: number): LiveMetrics {
  if (tick <= 0) {
    return {
      cpuAvg: 1.6,
      cpuPeak: 3.2,
      load1: 0.01,
      cores: [0, 3],
      memUsedPercent: 78,
      memAvailableMb: 419.64,
      memCacheMb: 396.66,
      memUsedGb: 1.46,
      swapPercent: 0,
    }
  }

  const wave = Math.sin(tick * 1.3) * 0.4
  const memUsedPercent = clamp(Math.round((78 + wave * 2) * 10) / 10, 70, 88)
  const memUsedGb = Math.round(((NODE.memTotalGb * memUsedPercent) / 100) * 100) / 100
  const memAvailableMb = Math.round((NODE.memTotalGb * 1024 - memUsedGb * 1024) * 100) / 100

  return {
    cpuAvg: clamp(Math.round((1.6 + wave) * 10) / 10, 0.4, 8),
    cpuPeak: clamp(Math.round((3.2 + Math.abs(wave)) * 10) / 10, 1, 12),
    load1: clamp(Math.round((0.01 + Math.abs(wave) / 8) * 100) / 100, 0.01, 0.4),
    cores: [clamp(Math.round(Math.max(0, wave) * 4), 0, 20), clamp(3 + Math.round(wave), 0, 20)],
    memUsedPercent,
    memAvailableMb,
    memCacheMb: 396.66,
    memUsedGb,
    swapPercent: 0,
  }
}
