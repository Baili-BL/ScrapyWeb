import { Alert, Button, Form, Input, Modal, Select, Switch, Table, Tag } from '@arco-design/web-react'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import { useEffect, useState } from 'react'
import type { AuthUser, UserRole } from '../api.ts'
import { adminCreateUser, adminDeleteUser, adminUpdateUser, fetchMe, fetchUsers, importUsers, ROLE_LABEL } from '../api.ts'

const ROLE_OPTIONS: Array<{ value: UserRole; label: string }> = [
  { value: 'admin', label: '管理员' },
  { value: 'operator', label: '操作员' },
  { value: 'readonly', label: '只读' },
]

const ROLE_COLOR: Record<UserRole, string> = { admin: 'purple', operator: 'green', readonly: 'gray' }

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

function parseImportText(text: string): Array<{ username: string; password: string; displayName?: string; role?: UserRole }> {
  const rows: Array<{ username: string; password: string; displayName?: string; role?: UserRole }> = []
  try {
    const parsed = JSON.parse(text)
    if (Array.isArray(parsed)) {
      for (const item of parsed) {
        if (item && typeof item === 'object' && item.username && item.password) {
          rows.push({
            username: String(item.username).trim(),
            password: String(item.password),
            displayName: item.displayName ? String(item.displayName).trim() : undefined,
            role: item.role,
          })
        }
      }
      return rows
    }
  } catch {
    // 不是 JSON，按 CSV 解析
  }
  const lines = text
    .split(/\r?\n/)
    .map((line) => line.trim())
    .filter(Boolean)
  const startIndex = lines[0]?.toLowerCase().startsWith('username') ? 1 : 0
  for (let index = startIndex; index < lines.length; index += 1) {
    const cols = lines[index].split(',').map((col) => col.trim())
    if (!cols[0] || !cols[1]) continue
    const role = ['admin', 'operator', 'readonly'].includes(cols[3]) ? (cols[3] as UserRole) : 'readonly'
    rows.push({ username: cols[0], password: cols[1], displayName: cols[2] || undefined, role })
  }
  return rows
}

export function UserAdmin({ onNotify }: { onNotify: (text: string) => void }) {
  const [users, setUsers] = useState<AuthUser[]>([])
  const [me, setMe] = useState<AuthUser | null>(null)
  const [loading, setLoading] = useState(true)
  const [forbidden, setForbidden] = useState('')
  const [error, setError] = useState('')

  const [createOpen, setCreateOpen] = useState(false)
  const [importOpen, setImportOpen] = useState(false)
  const [importText, setImportText] = useState('')
  const [importFileName, setImportFileName] = useState('')
  const [importResult, setImportResult] = useState<{ created: number; skipped: Array<{ username: string; reason: string }> } | null>(null)
  const [createDraft, setCreateDraft] = useState({ username: '', password: '', displayName: '', role: 'readonly' as UserRole })
  const [formError, setFormError] = useState('')
  const [resetTarget, setResetTarget] = useState<AuthUser | null>(null)
  const [resetPassword, setResetPassword] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<AuthUser | null>(null)

  const loadUsers = async () => {
    try {
      const [list, current] = await Promise.all([fetchUsers(), fetchMe().catch(() => null)])
      setUsers(list)
      if (current) setMe(current)
    } catch (err) {
      const message = (err as Error).message
      if (message.includes('仅管理员')) setForbidden(message)
      else setError(message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadUsers()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commitCreate = async () => {
    const username = createDraft.username.trim()
    if (!/^[a-zA-Z0-9_]{3,32}$/.test(username)) {
      setFormError('用户名需 3-32 位，仅限字母/数字/下划线')
      return
    }
    if (createDraft.password.length < 6) {
      setFormError('密码至少 6 位')
      return
    }
    try {
      await adminCreateUser({
        username,
        password: createDraft.password,
        displayName: createDraft.displayName.trim() || username,
        role: createDraft.role,
      })
      onNotify(`已录入用户 ${username}`)
      setCreateOpen(false)
      setCreateDraft({ username: '', password: '', displayName: '', role: 'readonly' })
      setFormError('')
      await loadUsers()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const commitImport = async () => {
    const rows = parseImportText(importText)
    if (!rows.length) {
      setFormError('没有解析到可导入的行（CSV 需含 username,password 两列）')
      return
    }
    try {
      const result = await importUsers(rows)
      setImportResult(result)
      onNotify(`导入完成：新增 ${result.created} 个用户，跳过 ${result.skipped.length} 行`)
      await loadUsers()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const onImportFile = (file: File) => {
    setImportFileName(file.name)
    setImportResult(null)
    setFormError('')
    const reader = new FileReader()
    reader.onload = () => setImportText(String(reader.result ?? ''))
    reader.readAsText(file, 'utf-8')
  }

  const downloadTemplate = () => {
    const csv = 'username,password,displayName,role\nzhangsan,zs123456,张三,operator\nlisi,ls123456,李四,readonly'
    const blob = new Blob([`\uFEFF${csv}`], { type: 'text/csv;charset=utf-8' })
    const link = document.createElement('a')
    link.href = URL.createObjectURL(blob)
    link.download = 'users-template.csv'
    link.click()
    URL.revokeObjectURL(link.href)
  }

  const commitResetPassword = async () => {
    if (!resetTarget) return
    if (resetPassword.length < 6) {
      setFormError('密码至少 6 位')
      return
    }
    try {
      await adminUpdateUser(resetTarget.id, { password: resetPassword })
      onNotify(`已重置 ${resetTarget.username} 的密码`)
      setResetTarget(null)
      setResetPassword('')
      setFormError('')
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const toggleStatus = async (user: AuthUser, enabled: boolean) => {
    try {
      await adminUpdateUser(user.id, { status: enabled ? 'active' : 'disabled' })
      onNotify(`已${enabled ? '启用' : '停用'} ${user.username}`)
      await loadUsers()
    } catch (err) {
      onNotify(`操作失败：${(err as Error).message}`)
      await loadUsers()
    }
  }

  const changeRole = async (user: AuthUser, role: UserRole) => {
    try {
      await adminUpdateUser(user.id, { role })
      onNotify(`已将 ${user.username} 的角色改为 ${ROLE_LABEL[role]}`)
      await loadUsers()
    } catch (err) {
      onNotify(`操作失败：${(err as Error).message}`)
      await loadUsers()
    }
  }

  const removeUser = async (user: AuthUser) => {
    try {
      await adminDeleteUser(user.id)
      onNotify(`已删除 ${user.username}`)
      await loadUsers()
    } catch (err) {
      onNotify(`删除失败：${(err as Error).message}`)
    }
  }

  const columns: ColumnProps<AuthUser>[] = [
    { title: '用户名', dataIndex: 'username', width: 140 },
    { title: '昵称', dataIndex: 'displayName', width: 130 },
    {
      title: '角色',
      dataIndex: 'role',
      width: 150,
      render: (value: UserRole, record) =>
        me?.id === record.id ? (
          <Tag color={ROLE_COLOR[value]}>{ROLE_LABEL[value]}</Tag>
        ) : (
          <Select size="mini" value={value} options={ROLE_OPTIONS} style={{ width: 110 }} onChange={(role) => void changeRole(record, role as UserRole)} />
        ),
    },
    {
      title: '状态',
      dataIndex: 'status',
      width: 90,
      render: (value: AuthUser['status'], record) => (
        <Switch
          size="small"
          checked={value === 'active'}
          disabled={me?.id === record.id}
          onChange={(checked) => void toggleStatus(record, checked)}
        />
      ),
    },
    {
      title: '创建时间',
      dataIndex: 'createdAt',
      width: 160,
      render: (value: string) => fmtTime(value),
    },
    {
      title: '最后登录',
      dataIndex: 'lastLoginAt',
      width: 160,
      render: (value: string | null) => fmtTime(value),
    },
    {
      title: '操作',
      width: 190,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="mini" disabled={me?.id === record.id} onClick={() => { setResetTarget(record); setResetPassword(''); setFormError('') }}>
            重置密码
          </Button>
          <Button size="mini" status="danger" disabled={me?.id === record.id} onClick={() => setDeleteTarget(record)}>
            删除
          </Button>
        </div>
      ),
    },
  ]

  if (forbidden) {
    return (
      <div className="page">
        <div className="page-inner">
          <header className="page-header">
            <div className="brand-text">
              <h1>用户管理</h1>
              <p>账号与访问权限</p>
            </div>
          </header>
          <section className="panel">
            <Alert type="warning" content={forbidden} />
          </section>
        </div>
      </div>
    )
  }

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="brand-text">
            <h1>用户管理</h1>
            <p>账号录入、批量导入与角色权限（角色：管理员 / 操作员 / 只读）</p>
          </div>
          <div style={{ display: 'flex', gap: 8 }}>
            <Button onClick={downloadTemplate}>下载导入模板</Button>
            <Button onClick={() => { setImportOpen(true); setImportText(''); setImportFileName(''); setImportResult(null); setFormError('') }}>导入用户</Button>
            <Button type="primary" onClick={() => { setCreateDraft({ username: '', password: '', displayName: '', role: 'readonly' }); setFormError(''); setCreateOpen(true) }}>
              录入用户
            </Button>
          </div>
        </header>

        {error ? (
          <section className="panel">
            <Alert type="error" content={error} />
          </section>
        ) : null}

        <section className="panel">
          <Table rowKey="id" columns={columns} data={users} loading={loading} pagination={false} border={false} />
        </section>
      </div>

      <Modal
        title="录入用户"
        visible={createOpen}
        okText="创建"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setCreateOpen(false)}
        onOk={() => void commitCreate()}
      >
        <Form layout="vertical">
          <Form.Item label="用户名" required>
            <Input value={createDraft.username} placeholder="3-32 位字母/数字/下划线" onChange={(value) => setCreateDraft((current) => ({ ...current, username: value }))} />
          </Form.Item>
          <Form.Item label="昵称">
            <Input value={createDraft.displayName} placeholder="显示名称（可选）" onChange={(value) => setCreateDraft((current) => ({ ...current, displayName: value }))} />
          </Form.Item>
          <Form.Item label="初始密码" required>
            <Input.Password value={createDraft.password} placeholder="至少 6 位" onChange={(value) => setCreateDraft((current) => ({ ...current, password: value }))} />
          </Form.Item>
          <Form.Item label="角色" required>
            <Select value={createDraft.role} options={ROLE_OPTIONS} onChange={(value) => setCreateDraft((current) => ({ ...current, role: value as UserRole }))} />
          </Form.Item>
          {formError ? <Alert type="error" content={formError} /> : null}
        </Form>
      </Modal>

      <Modal
        title="导入用户"
        visible={importOpen}
        okText="执行导入"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setImportOpen(false)}
        onOk={() => void commitImport()}
      >
        <Alert
          style={{ marginBottom: 12 }}
          type="info"
          content="支持 CSV 或 JSON。CSV 每行：用户名,密码,昵称,角色（角色可省略，默认 readonly；可重复的行将自动跳过）。"
        />
        <input
          type="file"
          accept=".csv,.json,.txt"
          style={{ marginBottom: 12 }}
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onImportFile(file)
          }}
        />
        {importFileName ? <p className="auth-hint">已选择：{importFileName}（可在下方编辑后再导入）</p> : null}
        <Input.TextArea
          value={importText}
          placeholder={'username,password,displayName,role\nzhangsan,zs123456,张三,operator'}
          autoSize={{ minRows: 5, maxRows: 10 }}
          onChange={setImportText}
        />
        {importResult ? (
          <Alert
            style={{ marginTop: 12 }}
            type="success"
            content={`导入完成：新增 ${importResult.created} 个${importResult.skipped.length ? `，跳过 ${importResult.skipped.length} 行（${importResult.skipped.map((item) => `${item.username}:${item.reason}`).join('；')}）` : ''}`}
          />
        ) : null}
        {formError ? <Alert style={{ marginTop: 12 }} type="error" content={formError} /> : null}
      </Modal>

      <Modal
        title={resetTarget ? `重置 ${resetTarget.username} 的密码` : '重置密码'}
        visible={resetTarget !== null}
        okText="重置"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setResetTarget(null)}
        onOk={() => void commitResetPassword()}
      >
        <Form layout="vertical">
          <Form.Item label="新密码" required>
            <Input.Password value={resetPassword} placeholder="至少 6 位" onChange={setResetPassword} />
          </Form.Item>
          {formError ? <Alert type="error" content={formError} /> : null}
        </Form>
      </Modal>

      <Modal
        title="删除用户"
        visible={deleteTarget !== null}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        onCancel={() => setDeleteTarget(null)}
        onOk={() => {
          if (deleteTarget) void removeUser(deleteTarget)
          setDeleteTarget(null)
        }}
      >
        <p>确定删除用户 {deleteTarget?.username}？该账号将无法登录。</p>
      </Modal>
    </div>
  )
}
