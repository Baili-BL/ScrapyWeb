import { Dropdown, Menu, Tooltip } from '@arco-design/web-react'
import {
  IconBook,
  IconBranch,
  IconCode,
  IconCommon,
  IconFile,
  IconLink,
  IconList,
  IconMessage,
  IconMindMapping,
  IconRobot,
  IconSettings,
  IconRight,
  IconStorage,
  IconUp,
  IconUser,
} from '@arco-design/web-react/icon'
import type { ReactNode } from 'react'
import { useEffect, useState } from 'react'
import { NavLink, useLocation, useNavigate } from 'react-router-dom'
import { ROLE_LABEL } from '../api.ts'
import type { AuthUser } from '../api.ts'
import { SpiderIcon } from '../icons.tsx'
import { MENU_GROUPS, menuKeyFromPath, menuPath } from './menu.ts'
import type { MenuEntry, MenuKey } from './menu.ts'

const GROUP_SHORT: Record<string, string> = {
  总览: '总览',
  任务调度: '调度',
  资源与环境: '资源',
  AI助手: 'AI',
  系统: '系统',
}

function FoldIcon() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none" aria-hidden="true">
      <path
        d="M6 14V2M14.4 12V4c0-1.326-1.075-2.4-2.4-2.4H4C2.674 1.6 1.6 2.674 1.6 4v8c0 1.326 1.074 2.4 2.4 2.4H12c1.325 0 2.4-1.074 2.4-2.4Z"
        stroke="currentColor"
        strokeWidth="1.13"
      />
    </svg>
  )
}

const ICONS: Record<string, ReactNode> = {
  dashboard: <SpiderIcon size={16} />,
  tasks: <IconList />,
  workflow: <IconBranch />,
  projects: <IconCommon />,
  envs: <IconStorage />,
  python: <IconCode />,
  nodes: <IconMindMapping />,
  users: <IconUser />,
  docs: <IconBook />,
  logs: <IconFile />,
  'ai-assistant': <IconMessage />,
  'ai-config': <IconLink />,
  'ai-bot': <IconRobot />,
  settings: <IconSettings />,
}

export function SideMenu({ user, onLogout }: { user: AuthUser; onLogout: () => void }) {
  const navigate = useNavigate()
  const { pathname } = useLocation()
  const activeKey = menuKeyFromPath(pathname) ?? ''
  const [settingsOpen, setSettingsOpen] = useState(false)
  const [collapsed, setCollapsed] = useState(false)
  const settingsActive = activeKey === 'settings-basic' || activeKey === 'settings-alert'
  const initials = (user.displayName || user.username).slice(0, 2)

  useEffect(() => {
    if (settingsActive) setSettingsOpen(true)
  }, [settingsActive])

  const select = (key: MenuKey) => {
    void navigate(menuPath(key))
  }

  const renderItem = (item: MenuEntry) => {
    if (item.children) {
      const open = settingsOpen && !collapsed
      const parent = (
        <button
          type="button"
          className={open ? 'nav-item open' : settingsActive && collapsed ? 'nav-item active' : 'nav-item'}
          aria-expanded={open}
          aria-label={item.label}
          onClick={() => {
            if (!collapsed) setSettingsOpen((value) => !value)
          }}
        >
          <span className="nav-icon">{ICONS[item.key]}</span>
          <span className="nav-text">{item.label}</span>
          <IconRight className="nav-chevron" />
        </button>
      )
      return (
        <div key={item.key}>
          {collapsed ? (
            <Dropdown
              trigger="click"
              position="tr"
              droplist={
                <Menu onClickMenuItem={(key) => select(key as MenuKey)}>
                  {item.children.map((child) => (
                    <Menu.Item key={child.key}>{child.label}</Menu.Item>
                  ))}
                </Menu>
              }
            >
              {parent}
            </Dropdown>
          ) : (
            parent
          )}
          {open ? (
            <div className="nav-sub">
              {item.children.map((child) => (
                <NavLink
                  key={child.key}
                  to={menuPath(child.key)}
                  className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
                  aria-current={activeKey === child.key ? 'page' : undefined}
                >
                  <span className="nav-text">{child.label}</span>
                </NavLink>
              ))}
            </div>
          ) : null}
        </div>
      )
    }

    const key = item.key as MenuKey
    const button = (
      <NavLink
        to={menuPath(key)}
        end={key === 'dashboard'}
        className={({ isActive }) => (isActive ? 'nav-item active' : 'nav-item')}
        aria-current={activeKey === key ? 'page' : undefined}
        aria-label={item.label}
      >
        <span className="nav-icon">{ICONS[item.key]}</span>
        <span className="nav-text">{item.label}</span>
      </NavLink>
    )
    if (!collapsed) return <span className="nav-slot" key={item.key}>{button}</span>
    return (
      <Tooltip key={item.key} content={item.label} position="right">
        {button}
      </Tooltip>
    )
  }

  return (
    <aside className={collapsed ? 'sider collapsed' : 'sider'}>
      <nav className="sider-nav" aria-label="功能菜单">
        {MENU_GROUPS.map((group) => (
          <section key={group.title} className="nav-group">
            <div className="nav-label">{collapsed ? GROUP_SHORT[group.title] : group.title}</div>
            {group.items.map(renderItem)}
          </section>
        ))}
      </nav>

      <div className="sider-fold-bar">
        <button
          type="button"
          className="sider-fold"
          aria-label={collapsed ? '展开菜单' : '收起菜单'}
          onClick={() => setCollapsed((value) => !value)}
        >
          <FoldIcon />
          <span>收起</span>
        </button>
      </div>

      <Dropdown
        trigger="click"
        position={collapsed ? 'tr' : 'tl'}
        droplist={
          <Menu>
            <Menu.Item key="profile" onClick={() => select('users')}>
              个人资料
            </Menu.Item>
            <Menu.Item key="logout" onClick={onLogout}>
              退出登录
            </Menu.Item>
          </Menu>
        }
      >
        <button type="button" className="sider-user" aria-label={`${user.displayName} 账号菜单`}>
          <span className="avatar">{initials}</span>
          <span className="user-meta">
            <strong>{user.displayName}</strong>
            <span>{ROLE_LABEL[user.role]}</span>
          </span>
          <span className="user-side">
            <i className="status-dot" />
            <IconUp />
          </span>
        </button>
      </Dropdown>
    </aside>
  )
}
