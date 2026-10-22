import { DEMO_NOW } from '../data.ts'

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

export const DEMO_PROJECT_TIME = formatProjectTime(DEMO_NOW)

export const SEED_PROJECTS: ProjectItem[] = [
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
