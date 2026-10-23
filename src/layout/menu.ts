export type MenuKey =
  | 'dashboard'
  | 'tasks'
  | 'workflow'
  | 'projects'
  | 'envs'
  | 'python'
  | 'nodes'
  | 'users'
  | 'docs'
  | 'logs'
  | 'ai-assistant'
  | 'ai-config'
  | 'ai-bot'
  | 'settings-basic'
  | 'settings-alert'

export type MenuEntry = {
  key: MenuKey | 'settings'
  label: string
  children?: { key: MenuKey; label: string }[]
}

export type MenuGroup = {
  title: string
  items: MenuEntry[]
}

export const MENU_GROUPS: MenuGroup[] = [
  {
    title: '总览',
    items: [{ key: 'dashboard', label: '仪表盘' }],
  },
  {
    title: '任务调度',
    items: [
      { key: 'tasks', label: '任务管理' },
      { key: 'workflow', label: '流程编排' },
      { key: 'projects', label: '项目管理' },
    ],
  },
  {
    title: '资源与环境',
    items: [
      { key: 'envs', label: '环境管理' },
      { key: 'python', label: 'Python版本' },
      { key: 'nodes', label: '分布式节点' },
    ],
  },
  {
    title: 'AI助手',
    items: [
      { key: 'ai-assistant', label: 'AI助手' },
      { key: 'ai-config', label: 'AI配置' },
      { key: 'ai-bot', label: '机器人配置' },
    ],
  },
  {
    title: '系统',
    items: [
      { key: 'users', label: '用户管理' },
      { key: 'logs', label: '系统日志' },
      { key: 'docs', label: '技术文档' },
      {
        key: 'settings',
        label: '系统设置',
        children: [
          { key: 'settings-basic', label: '基础设置' },
          { key: 'settings-alert', label: '通知告警' },
        ],
      },
    ],
  },
]

export const MENU_PATHS: Record<MenuKey, string> = {
  dashboard: '/',
  tasks: '/tasks',
  workflow: '/workflow',
  projects: '/projects',
  envs: '/envs',
  python: '/python',
  nodes: '/nodes',
  users: '/users',
  docs: '/docs',
  logs: '/logs',
  'ai-assistant': '/ai/assistant',
  'ai-config': '/ai/config',
  'ai-bot': '/ai/bot',
  'settings-basic': '/settings/basic',
  'settings-alert': '/settings/alert',
}

export function menuPath(key: MenuKey): string {
  return MENU_PATHS[key]
}

export function menuKeyFromPath(pathname: string): MenuKey | null {
  const found = (Object.entries(MENU_PATHS) as [MenuKey, string][]).find(([, path]) => path === pathname)
  return found?.[0] ?? null
}

export function menuLabel(key: string): string {
  for (const group of MENU_GROUPS) {
    for (const item of group.items) {
      if (item.key === key) return item.label
      const child = item.children?.find((entry) => entry.key === key)
      if (child) return child.label
    }
  }
  return '页面'
}
