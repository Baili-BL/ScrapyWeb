import { Button, Form, Input, Tabs } from '@arco-design/web-react'
import { useState } from 'react'
import type { AuthSession } from '../api.ts'
import { login, register } from '../api.ts'
import { SpiderIcon } from '../icons.tsx'

/** 未登录时的全屏页面：登录 / 注册。 */
export function AuthPage({ onAuth }: { onAuth: (auth: AuthSession) => void }) {
  const [mode, setMode] = useState<'login' | 'register'>('login')
  const [form, setForm] = useState({ username: '', password: '', displayName: '', confirm: '' })
  const [error, setError] = useState('')
  const [busy, setBusy] = useState(false)

  const submitLogin = async () => {
    if (!form.username.trim() || !form.password) {
      setError('请输入用户名和密码')
      return
    }
    setBusy(true)
    setError('')
    try {
      const result = await login(form.username.trim(), form.password)
      onAuth(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  const submitRegister = async () => {
    const username = form.username.trim()
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      setError('用户名需 3-32 位，仅限字母/数字/下划线')
      return
    }
    if (form.password.length < 6) {
      setError('密码至少 6 位')
      return
    }
    if (form.password !== form.confirm) {
      setError('两次输入的密码不一致')
      return
    }
    setBusy(true)
    setError('')
    try {
      await register({ username, password: form.password, displayName: form.displayName.trim() })
      const result = await login(username, form.password)
      onAuth(result)
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setBusy(false)
    }
  }

  return (
    <div className="auth-page">
      <div className="auth-card">
        <div className="auth-brand">
          <span className="auth-logo">
            <SpiderIcon size={26} />
          </span>
          <div>
            <h1>ScrapyWeb</h1>
            <p>爬虫任务监控与编排平台</p>
          </div>
        </div>

        <Tabs
          type="rounded"
          activeTab={mode}
          onChange={(key) => {
            setMode(key as 'login' | 'register')
            setError('')
          }}
        >
          <Tabs.TabPane key="login" title="登录">
            <Form layout="vertical" onSubmit={() => void submitLogin()}>
              <Form.Item label="用户名" required>
                <Input value={form.username} placeholder="用户名" onChange={(value) => setForm((current) => ({ ...current, username: value }))} />
              </Form.Item>
              <Form.Item label="密码" required>
                <Input.Password
                  value={form.password}
                  placeholder="密码"
                  onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                />
              </Form.Item>
              {error ? <p className="auth-error">{error}</p> : null}
              <Button type="primary" long disabled={busy} loading={busy} onClick={() => void submitLogin()}>
                登录
              </Button>
              <p className="auth-hint">内置管理员：admin / admin123（登录后请在「用户管理」修改密码）</p>
            </Form>
          </Tabs.TabPane>

          <Tabs.TabPane key="register" title="注册">
            <Form layout="vertical">
              <Form.Item label="用户名" required>
                <Input
                  value={form.username}
                  placeholder="3-32 位字母/数字/下划线"
                  onChange={(value) => setForm((current) => ({ ...current, username: value }))}
                />
              </Form.Item>
              <Form.Item label="昵称">
                <Input value={form.displayName} placeholder="显示名称（可选）" onChange={(value) => setForm((current) => ({ ...current, displayName: value }))} />
              </Form.Item>
              <Form.Item label="密码" required>
                <Input.Password
                  value={form.password}
                  placeholder="至少 6 位"
                  onChange={(value) => setForm((current) => ({ ...current, password: value }))}
                />
              </Form.Item>
              <Form.Item label="确认密码" required>
                <Input.Password
                  value={form.confirm}
                  placeholder="再次输入密码"
                  onChange={(value) => setForm((current) => ({ ...current, confirm: value }))}
                />
              </Form.Item>
              {error ? <p className="auth-error">{error}</p> : null}
              <Button type="primary" long disabled={busy} loading={busy} onClick={() => void submitRegister()}>
                注册并登录
              </Button>
              <p className="auth-hint">自助注册的账号默认为「只读」角色，可由管理员在用户管理中调整。</p>
            </Form>
          </Tabs.TabPane>
        </Tabs>
      </div>
    </div>
  )
}
