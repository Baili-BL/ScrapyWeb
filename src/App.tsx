import { Button, ConfigProvider, Message, Tabs } from '@arco-design/web-react'
import { IconRefresh } from '@arco-design/web-react/icon'
import zhCN from '@arco-design/web-react/es/locale/zh-CN'
import { useState } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { clearAuthToken, setAuthToken } from './api.ts'
import { AuthPage } from './auth/AuthPage.tsx'
import type { AuthState } from './auth/AuthPage.tsx'
import { IconApps } from './icons.tsx'
import { ModulePage } from './layout/ModulePage.tsx'
import { SideMenu } from './layout/SideMenu.tsx'
import { MENU_PATHS } from './layout/menu.ts'
import type { MenuKey } from './layout/menu.ts'
import { ChartPanel } from './panels/ChartPanel.tsx'
import { PerformancePanel } from './panels/PerformancePanel.tsx'
import { SystemOverview } from './panels/SystemOverview.tsx'
import { TaskMonitor } from './panels/TaskMonitor.tsx'
import { WorkerNodes } from './panels/WorkerNodes.tsx'

const AUTH_KEY = 'scrapyweb-auth'

function loadAuth(): AuthState | null {
  try {
    const raw = localStorage.getItem(AUTH_KEY)
    if (!raw) return null
    const parsed = JSON.parse(raw) as AuthState
    // 兼容修复：把 token 同步给 API 客户端使用的键
    if (parsed?.token) setAuthToken(parsed.token)
    return parsed
  } catch {
    return null
  }
}

export default function App() {
  const [auth, setAuth] = useState<AuthState | null>(() => loadAuth())
  const [tab, setTab] = useState('overview')
  const [tick, setTick] = useState(0)
  const [loading, setLoading] = useState(false)
  const [message, messageHolder] = Message.useMessage()

  const handleAuth = (next: AuthState) => {
    localStorage.setItem(AUTH_KEY, JSON.stringify(next))
    setAuthToken(next.token)
    setAuth(next)
    message.success?.(`欢迎，${next.user.displayName}`)
  }

  const handleLogout = () => {
    clearAuthToken()
    localStorage.removeItem(AUTH_KEY)
    setAuth(null)
    message.info?.('已退出登录')
  }

  const refresh = () => {
    if (loading) return
    setLoading(true)
    window.setTimeout(() => {
      setTick((value) => value + 1)
      setLoading(false)
      message.success?.('节点性能已刷新')
    }, 600)
  }

  if (!auth) {
    return (
      <ConfigProvider locale={zhCN}>
        {messageHolder}
        <AuthPage onAuth={handleAuth} />
      </ConfigProvider>
    )
  }

  return (
    <ConfigProvider locale={zhCN}>
      {messageHolder}
      <div className="app-shell">
        <SideMenu user={auth.user} onLogout={handleLogout} />
        <div className="workspace">
          <Routes>
            {(Object.entries(MENU_PATHS) as [MenuKey, string][]).map(([key, path]) => (
              <Route
                key={key}
                path={path}
                element={
                  key === 'dashboard' ? (
                    <Dashboard tick={tick} loading={loading} onRefresh={refresh} tab={tab} onTab={setTab} />
                  ) : (
                    <ModulePage menuKey={key} onSaved={(text) => message.success?.(text)} />
                  )
                }
              />
            ))}
            <Route path="*" element={<Navigate to="/" replace />} />
          </Routes>
        </div>
      </div>
    </ConfigProvider>
  )
}

function Dashboard({
  tick,
  loading,
  onRefresh,
  tab,
  onTab,
}: {
  tick: number
  loading: boolean
  onRefresh: () => void
  tab: string
  onTab: (key: string) => void
}) {
  return (
    <div className="page">
      <div className="page-inner">
          <header className="page-header">
            <div className="brand">
              <span className="brand-mark">
                <IconApps />
              </span>
              <div className="brand-text">
                <h1>监控仪表盘</h1>
                <p>实时监控系统状态、任务执行与节点性能</p>
              </div>
            </div>
            <Button className="refresh-btn" icon={<IconRefresh />} loading={loading} onClick={onRefresh}>
              刷新数据
            </Button>
          </header>

          <Tabs
            className="monitor-tabs capsule-left"
            type="capsule"
            lazyload
            animation={false}
            activeTab={tab}
            onChange={onTab}
          >
            <Tabs.TabPane key="overview" title="系统概览">
              <SystemOverview tick={tick} />
            </Tabs.TabPane>
            <Tabs.TabPane key="tasks" title="任务监控">
              <TaskMonitor tick={tick} />
            </Tabs.TabPane>
            <Tabs.TabPane key="nodes" title="工作节点">
              <WorkerNodes tick={tick} />
            </Tabs.TabPane>
            <Tabs.TabPane key="performance" title="性能">
              <PerformancePanel tick={tick} />
            </Tabs.TabPane>
            <Tabs.TabPane key="charts" title="详细图表">
              <ChartPanel tick={tick} />
            </Tabs.TabPane>
          </Tabs>
      </div>
    </div>
  )
}
