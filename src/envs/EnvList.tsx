import { Alert, Checkbox, Dropdown, Form, Input, Menu, Modal, Select } from '@arco-design/web-react'
import {
  IconCheck,
  IconCheckCircle,
  IconCode,
  IconCodeSandbox,
  IconDelete,
  IconDesktop,
  IconEdit,
  IconMore,
  IconPlus,
  IconRefresh,
  IconSettings,
} from '@arco-design/web-react/icon'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { NODE } from '../data.ts'

type EnvStatus = 'active' | 'paused'

type PyEnv = {
  id: string
  name: string
  createdAt: string
  status: EnvStatus
  python: string
  node: string
  deps: string[]
  tasks: number
  collaborators: string[]
}

type EnvDraft = {
  name: string
  python: string
  node: string
  deps: string
  members: string[]
}

type Mirror = {
  id: string
  name: string
  url: string
  desc: string
  isDefault: boolean
}

const PYTHONS = ['3.9.21', '3.11.9', '3.12.7', '3.10.16']
const USERS = [
  { id: 'admin', label: 'admin (Administrator)' },
  { id: 'demo', label: 'demo (Demo User)' },
]

const SEED_ENVS: PyEnv[] = [
  {
    id: 'scrapy',
    name: 'scrapy_env',
    createdAt: 'Oct 22, 2026',
    status: 'active',
    python: '3.12.10',
    node: '本地',
    deps: ['scrapy'],
    tasks: 2,
    collaborators: ['admin'],
  },
  {
    id: 'requests',
    name: 'requests_env',
    createdAt: 'Apr 9, 2026',
    status: 'active',
    python: '3.9.21',
    node: '本地',
    deps: ['requests'],
    tasks: 5,
    collaborators: ['admin', 'demo'],
  },
]

const SEED_MIRRORS: Mirror[] = [
  { id: 'pypi', name: 'pypi', url: 'https://pypi.org/simple/', desc: '官方 PyPI 源 - 原始镜像，网络延迟可能较高', isDefault: false },
  { id: 'tsinghua', name: 'tsinghua', url: 'https://pypi.tuna.tsinghua.edu.cn/simple/', desc: '清华大学镜像源 - 更新及时，速度较快', isDefault: false },
  { id: 'aliyun', name: 'aliyun', url: 'https://mirrors.aliyun.com/pypi/simple/', desc: '阿里云镜像源 - 资源丰富，下载速度较快', isDefault: true },
  { id: 'ustc', name: 'ustc', url: 'https://pypi.mirrors.ustc.edu.cn/simple/', desc: '中国科学技术大学 - 更新速度快，适合对版本要求严格', isDefault: false },
  { id: 'huawei', name: 'huawei', url: 'https://repo.huaweicloud.com/repository/pypi/simple/', desc: '华为云镜像源 - 稳定镜像，适用多种网络环境', isDefault: false },
  { id: 'tencent', name: 'tencent', url: 'https://mirrors.cloud.tencent.com/pypi/simple/', desc: '腾讯云镜像源 - 提供全面的包资源，方便下载', isDefault: false },
]

const EMPTY_DRAFT: EnvDraft = {
  name: '',
  python: '3.9.21',
  node: NODE.name,
  deps: '',
  members: [],
}

const MONTHS = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

function formatCreated(date: Date): string {
  return `${MONTHS[date.getMonth()]} ${date.getDate()}, ${date.getFullYear()}`
}

let envSeq = 1
let mirrorSeq = 1

export function EnvList({ onNotify }: { onNotify: (text: string) => void }) {
  const [envs, setEnvs] = useState<PyEnv[]>(SEED_ENVS)
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<EnvStatus | null>(null)
  const [node, setNode] = useState<string | null>(null)
  const [editor, setEditor] = useState<'create' | PyEnv | null>(null)
  const [draft, setDraft] = useState<EnvDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<PyEnv | null>(null)
  const [deleteName, setDeleteName] = useState('')
  const [mirrors, setMirrors] = useState<Mirror[]>(SEED_MIRRORS)
  const [mirrorOpen, setMirrorOpen] = useState(false)
  const [mirrorDraft, setMirrorDraft] = useState<Mirror[]>(SEED_MIRRORS)
  const [mirrorName, setMirrorName] = useState('')
  const [mirrorUrl, setMirrorUrl] = useState('')
  const [mirrorDesc, setMirrorDesc] = useState('')

  const visible = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    return envs.filter((item) => {
      if (text && !`${item.name} ${item.python} ${item.deps.join(' ')}`.toLowerCase().includes(text)) return false
      if (status && item.status !== status) return false
      if (node && item.node !== '本地' && item.node !== node) return false
      return true
    })
  }, [envs, keyword, node, status])

  const openCreate = () => {
    setDraft(EMPTY_DRAFT)
    setFormError('')
    setEditor('create')
  }

  const openEdit = (env: PyEnv) => {
    setDraft({
      name: env.name,
      python: env.python,
      node: env.node === '本地' ? NODE.name : env.node,
      deps: env.deps.join('\n'),
      members: [...env.collaborators],
    })
    setFormError('')
    setEditor(env)
  }

  const commit = () => {
    const name = draft.name.trim()
    const deps = draft.deps
      .split('\n')
      .map((item) => item.trim())
      .filter(Boolean)
    if (!name) {
      setFormError('请填写环境名称')
      return
    }
    if (deps.length === 0) {
      setFormError('请填写依赖包，每行一个')
      return
    }
    if (!editor) return
    const editingId = editor === 'create' ? null : editor.id
    if (envs.some((item) => item.name === name && item.id !== editingId)) {
      setFormError('已有同名环境')
      return
    }
    if (editor === 'create') {
      const created: PyEnv = {
        id: `env-${(envSeq += 1)}`,
        name,
        createdAt: formatCreated(new Date()),
        status: 'active',
        python: draft.python,
        node: draft.node === NODE.name ? '本地' : draft.node,
        deps,
        tasks: 0,
        collaborators: draft.members,
      }
      setEnvs((list) => [created, ...list])
      onNotify(`已创建 ${name}`)
    } else {
      setEnvs((list) =>
        list.map((item) =>
          item.id === editor.id
            ? {
                ...item,
                name,
                python: draft.python,
                node: draft.node === NODE.name ? '本地' : draft.node,
                deps,
                collaborators: draft.members,
              }
            : item,
        ),
      )
      onNotify(`已保存 ${name}`)
    }
    setEditor(null)
  }

  const openMirrors = () => {
    setMirrorDraft(mirrors.map((item) => ({ ...item })))
    setMirrorName('')
    setMirrorUrl('')
    setMirrorDesc('')
    setMirrorOpen(true)
  }

  const addMirror = () => {
    const name = mirrorName.trim()
    const url = mirrorUrl.trim()
    if (!name || !url) {
      onNotify('请填写源名称和源地址')
      return
    }
    mirrorSeq += 1
    setMirrorDraft((list) => [...list, { id: `mirror-${mirrorSeq}`, name, url, desc: mirrorDesc.trim() || '自定义镜像源', isDefault: false }])
    setMirrorName('')
    setMirrorUrl('')
    setMirrorDesc('')
  }

  const filteredEmpty = envs.length > 0 && visible.length === 0

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>Python 环境</h1>
            <p>在此管理您的 Python 环境和依赖。</p>
          </div>
          <div className="task-head-actions">
            <button type="button" className="task-icon-btn" aria-label="刷新环境" onClick={() => onNotify('环境列表已刷新')}>
              <IconRefresh />
            </button>
            <button type="button" className="env-ghost" onClick={openMirrors}>
              <IconSettings />
              镜像源
            </button>
            <button type="button" className="task-create" onClick={openCreate}>
              <IconPlus />
              创建环境
            </button>
          </div>
        </header>

        <Alert
          className="env-notice"
          type="info"
          showIcon
          title="注意"
          content="更新环境时，请确保与关联的最近一次计划任务有足够的时间间隔，以避免影响正在运行的任务和 Python 环境更新。"
        />

        <div className="task-filters">
          <Input className="task-search" allowClear placeholder="过滤环境..." value={keyword} onChange={setKeyword} />
          <FilterDrop
            label="状态"
            icon={<IconCheckCircle />}
            active={status !== null}
            options={[
              { key: '__all', label: '全部状态' },
              { key: 'active', label: '活跃' },
              { key: 'paused', label: '已暂停' },
            ]}
            onPick={(key) => setStatus(key === '__all' ? null : (key as EnvStatus))}
          />
          {status ? (
            <button type="button" className="filter-chip" onClick={() => setStatus(null)}>
              {status === 'active' ? '活跃' : '已暂停'}
            </button>
          ) : null}
          <FilterDrop
            label="节点"
            icon={<IconDesktop />}
            active={node !== null}
            options={[
              { key: '__all', label: '全部节点' },
              { key: NODE.name, label: NODE.name },
            ]}
            onPick={(key) => setNode(key === '__all' ? null : key)}
          />
          {node ? (
            <button type="button" className="filter-chip" onClick={() => setNode(null)}>
              {node}
            </button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <div className="env-empty">
            <span className="env-empty-icon">
              <IconCodeSandbox />
            </span>
            <strong>未找到环境</strong>
            <p>{filteredEmpty ? '换个筛选条件试试' : '创建您的第一个 Python 环境以开始使用'}</p>
          </div>
        ) : (
          <div className="env-table-wrap">
            <table className="env-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>状态</th>
                  <th>Python 版本</th>
                  <th>节点</th>
                  <th>依赖</th>
                  <th>任务</th>
                  <th>协作者</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((env) => (
                  <tr key={env.id}>
                    <td>
                      <strong>{env.name}</strong>
                      <div className="env-sub">创建于 {env.createdAt}</div>
                    </td>
                    <td>
                      <span className={env.status === 'active' ? 'task-badge active' : 'task-badge paused'}>
                        <i />
                        {env.status === 'active' ? '活跃' : '已暂停'}
                      </span>
                    </td>
                    <td>
                      <span className="py-ver">
                        <IconCode />
                        {env.python}
                      </span>
                    </td>
                    <td>{env.node}</td>
                    <td>
                      {env.deps.map((dep) => (
                        <button key={dep} type="button" className="dep-link" onClick={() => onNotify(`${env.name} 依赖 ${dep}`)}>
                          {dep.split(/[=<>]/)[0]}
                        </button>
                      ))}
                    </td>
                    <td>{env.tasks} 总计</td>
                    <td>
                      <span className="avatar-stack" title={env.collaborators.join(', ') || '无协作者'}>
                        {env.collaborators.slice(0, 3).map((name) => (
                          <i key={name}>{name.slice(0, 1).toUpperCase()}</i>
                        ))}
                        {env.collaborators.length > 3 ? <i>+{env.collaborators.length - 3}</i> : null}
                      </span>
                    </td>
                    <td>
                      <Dropdown
                        trigger="click"
                        position="br"
                        droplist={
                          <Menu>
                            <Menu.Item key="edit" onClick={() => openEdit(env)}>
                              <IconEdit /> 编辑
                            </Menu.Item>
                            <Menu.Item
                              key="delete"
                              onClick={() => {
                                setDeleteName(env.name)
                                setPendingDelete(env)
                              }}
                            >
                              <IconDelete /> 删除
                            </Menu.Item>
                          </Menu>
                        }
                      >
                        <button type="button" className="task-icon-btn" aria-label={`${env.name} 操作`}>
                          <IconMore />
                        </button>
                      </Dropdown>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Modal
        className="create-dialog"
        style={{ width: 640 }}
        title={
          <div className="dialog-title">
            <strong>{editor === 'create' ? '创建环境' : '编辑环境'}</strong>
            <p>为您的任务创建一个新的 Python 环境。</p>
          </div>
        }
        visible={editor !== null}
        okText={editor === 'create' ? '创建环境' : '保存'}
        cancelText="取消"
        unmountOnExit
        onCancel={() => setEditor(null)}
        onOk={commit}
      >
        <Form layout="vertical">
          <Form.Item label="环境名称" required>
            <Input value={draft.name} placeholder="my-env" onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          </Form.Item>
          <Form.Item label="依赖包" required extra="输入 Python 包依赖，每行一个。">
            <Input.TextArea
              value={draft.deps}
              placeholder={'numpy==1.21.0\npandas>=1.3.0'}
              autoSize={{ minRows: 4, maxRows: 8 }}
              onChange={(value) => setDraft((current) => ({ ...current, deps: value }))}
            />
          </Form.Item>
          <div className="form-split">
            <Form.Item label="Python 版本" extra="为此环境选择 Python 版本。">
              <Select
                value={draft.python}
                options={PYTHONS.map((item) => ({ value: item, label: item === '3.9.21' ? '3.9.21 (默认)' : item }))}
                onChange={(value) => setDraft((current) => ({ ...current, python: String(value) }))}
              />
            </Form.Item>
            <Form.Item label="工作节点" extra="将此环境分配给特定节点。">
              <Select
                value={draft.node}
                options={[NODE.name]}
                onChange={(value) => setDraft((current) => ({ ...current, node: String(value) }))}
              />
            </Form.Item>
          </div>
          <Form.Item label="协作者" extra="选择可以访问和管理此环境的用户。">
            <div className="member-box">
              {USERS.map((user) => (
                <Checkbox
                  key={user.id}
                  checked={draft.members.includes(user.id)}
                  onChange={(checked) =>
                    setDraft((current) => ({
                      ...current,
                      members: checked ? [...current.members, user.id] : current.members.filter((item) => item !== user.id),
                    }))
                  }
                >
                  {user.label}
                </Checkbox>
              ))}
            </div>
          </Form.Item>
          {formError ? <p className="task-form-error">{formError}</p> : null}
        </Form>
      </Modal>

      <Modal
        className="create-dialog"
        style={{ width: 640 }}
        title={
          <div className="dialog-title with-icon">
            <IconSettings />
            <div>
              <strong>镜像源管理</strong>
              <p>管理 Python 包镜像源。选择一个默认源用于包安装。</p>
            </div>
          </div>
        }
        visible={mirrorOpen}
        okText="保存"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setMirrorOpen(false)}
        onOk={() => {
          setMirrors(mirrorDraft)
          const current = mirrorDraft.find((item) => item.isDefault)
          onNotify(current ? `已保存镜像源，默认使用 ${current.name}` : '已保存镜像源')
          setMirrorOpen(false)
        }}
      >
        <div className="mirror-add">
          <Input value={mirrorName} placeholder="源名称" onChange={setMirrorName} />
          <Input value={mirrorUrl} placeholder="源地址" onChange={setMirrorUrl} />
          <Input value={mirrorDesc} placeholder="描述" onChange={setMirrorDesc} />
          <button type="button" className="task-create mirror-add-btn" aria-label="添加镜像源" onClick={addMirror}>
            <IconPlus />
          </button>
        </div>
        <ul className="mirror-list">
          {mirrorDraft.map((item) => (
            <li key={item.id}>
              <strong>{item.name}</strong>
              <span className="mirror-url">{item.url}</span>
              <span className="mirror-desc">{item.desc}</span>
              <button
                type="button"
                className={item.isDefault ? 'mirror-check on' : 'mirror-check'}
                aria-label={item.isDefault ? `${item.name} 当前默认` : `将 ${item.name} 设为默认`}
                onClick={() => setMirrorDraft((list) => list.map((entry) => ({ ...entry, isDefault: entry.id === item.id })))}
              >
                <IconCheck />
              </button>
              <button
                type="button"
                className="mirror-delete"
                aria-label={`删除 ${item.name}`}
                onClick={() => setMirrorDraft((list) => list.filter((entry) => entry.id !== item.id))}
              >
                <IconDelete />
              </button>
            </li>
          ))}
        </ul>
      </Modal>

      <Modal
        title="删除环境"
        visible={pendingDelete !== null}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        onCancel={() => setPendingDelete(null)}
        onOk={() => {
          if (!pendingDelete) return
          setEnvs((list) => list.filter((item) => item.id !== pendingDelete.id))
          onNotify(`已删除 ${deleteName}`)
          setPendingDelete(null)
        }}
      >
        <p>确定删除 {deleteName}？此操作只影响当前演示列表。</p>
      </Modal>
    </div>
  )
}

function FilterDrop({
  label,
  icon,
  active,
  options,
  onPick,
}: {
  label: string
  icon: ReactNode
  active: boolean
  options: { key: string; label: string }[]
  onPick: (key: string) => void
}) {
  return (
    <Dropdown
      trigger="click"
      position="bl"
      droplist={
        <Menu onClickMenuItem={(key) => onPick(key)}>
          {options.map((item) => (
            <Menu.Item key={item.key}>{item.label}</Menu.Item>
          ))}
        </Menu>
      }
    >
      <button type="button" className={active ? 'filter-btn on' : 'filter-btn'}>
        {icon}
        {label}
      </button>
    </Dropdown>
  )
}
