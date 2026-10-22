export type ProjectStatus = 'active' | 'paused'

export type ProjectItem = {
  id: string
  name: string
  description: string
  path: string
  archive: string
  tasks: number
  collaborators: string
  node: string
  createdAt: string
  updatedAt: string
  status: ProjectStatus
  tags: string[]
}

export type ProjectDraft = {
  name: string
  description: string
  path: string
  archive: string
  collaborators: string
  node: string
  tags: string
  source: 'zip' | 'git'
  gitUrl: string
  members: string[]
}

export const EMPTY_PROJECT: ProjectDraft = {
  name: '',
  description: '',
  path: '/',
  archive: '',
  collaborators: '',
  node: '',
  tags: '',
  source: 'zip',
  gitUrl: '',
  members: [],
}

export function formatProjectTime(date: Date): string {
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}/${pad(date.getMonth() + 1)}/${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

export const DEMO_PROJECT_TIME = formatProjectTime(new Date())

export const SEED_PROJECTS: ProjectItem[] = [
  {
    id: 'eastmoney',
    name: 'eastmoney_stock',
    description: '东方财富公开行情接口抓取：实时快照 + 最近 120 个交易日日线（默认贵州茅台 600519）',
    path: '/crawlers/scrapytask_demo',
    archive: '—',
    tasks: 1,
    collaborators: 'admin',
    node: '本地节点',
    createdAt: '2026/10/22 13:45:10',
    updatedAt: '2026/10/22 14:17:07',
    status: 'active',
    tags: ['scrapy', '行情'],
  },
  {
    id: 'fcfco',
    name: 'fcfco_reports',
    description: '第一创业期货官网（fcfco.cn）「一创研究」栏目抓取：报告标题/日期/详情链接/微信文章外链',
    path: '/crawlers/scrapytask_demo',
    archive: '—',
    tasks: 1,
    collaborators: 'admin',
    node: '本地节点',
    createdAt: '2026/10/22 13:48:02',
    updatedAt: '2026/10/22 14:07:46',
    status: 'active',
    tags: ['scrapy', '研报'],
  },
  {
    id: 'requests',
    name: 'requests_project',
    description: '项目用于运行1.py文件，每天执行一次',
    path: '/src1',
    archive: 'test.zip',
    tasks: 5,
    collaborators: 'admin, demo',
    node: '无',
    createdAt: '2026/04/09 17:32:36',
    updatedAt: '2026/05/31 15:39:30',
    status: 'active',
    tags: [],
  },
  {
    id: 'workflow-sample',
    name: '编排流程代码样例',
    description: '编排流程代码样例，一些代码参考，编排流程的代码要以函数式作为命名的',
    path: '/test',
    archive: 'test.zip',
    tasks: 0,
    collaborators: 'admin, demo',
    node: '无',
    createdAt: '2026/05/31 15:39:20',
    updatedAt: '2026/05/31 15:39:20',
    status: 'active',
    tags: [],
  },
]
