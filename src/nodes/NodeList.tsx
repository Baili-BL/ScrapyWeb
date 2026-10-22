import { Form, Input, Modal, Select } from '@arco-design/web-react'
import {
  IconCheckCircle,
  IconClockCircle,
  IconDelete,
  IconExclamationCircle,
  IconMindMapping,
  IconPlus,
  IconSearch,
  IconSettings,
  IconThunderbolt,
} from '@arco-design/web-react/icon'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'

type NodeStatus = 'connected' | 'connecting' | 'disconnected' | 'error'

type WorkerNode = {
  id: string
  name: string
  host: string
  os: string
  status: NodeStatus
}

type NodeDraft = {
  name: string
  host: string
  os: string
  status: NodeStatus
}

const STATUS_LABEL: Record<NodeStatus, string> = {
  connected: '已连接',
  connecting: '连接中',
  disconnected: '已断开',
  error: '错误',
}

const EMPTY_DRAFT: NodeDraft = {
  name: '',
  host: '',
  os: 'Linux',
  status: 'connected',
}

const CHECK_DEFAULT = { interval: '30', timeout: '10', retries: '3' }

let nodeSeq = 1

export function NodeList({ onNotify }: { onNotify: (text: string) => void }) {
  const [nodes, setNodes] = useState<WorkerNode[]>([])
  const [keyword, setKeyword] = useState('')
  const [status, setStatus] = useState<NodeStatus | ''>('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [draft, setDraft] = useState<NodeDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [checkOpen, setCheckOpen] = useState(false)
  const [check, setCheck] = useState(CHECK_DEFAULT)
  const [checkDraft, setCheckDraft] = useState(CHECK_DEFAULT)
  const [pendingDelete, setPendingDelete] = useState<WorkerNode | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const counts = useMemo(
    () => ({
      total: nodes.length,
      connected: nodes.filter((item) => item.status === 'connected').length,
      connecting: nodes.filter((item) => item.status === 'connecting').length,
      disconnected: nodes.filter((item) => item.status === 'disconnected').length,
      error: nodes.filter((item) => item.status === 'error').length,
    }),
    [nodes],
  )

  const visible = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    return nodes.filter((item) => {
      if (text && !`${item.name} ${item.host} ${item.os}`.toLowerCase().includes(text)) return false
      if (status && item.status !== status) return false
      return true
    })
  }, [keyword, nodes, status])

  const openCreate = () => {
    setDraft(EMPTY_DRAFT)
    setFormError('')
    setEditorOpen(true)
  }

  const commit = () => {
    const name = draft.name.trim()
    const host = draft.host.trim()
    if (!name) {
      setFormError('请填写节点名称')
      return
    }
    if (!host) {
      setFormError('请填写节点地址')
      return
    }
    if (nodes.some((item) => item.name === name)) {
      setFormError('已有同名节点')
      return
    }
    nodeSeq += 1
    setNodes((list) => [{ id: `node-${nodeSeq}`, name, host, os: draft.os, status: draft.status }, ...list])
    onNotify(`已添加 ${name}`)
    setEditorOpen(false)
  }

  const filteredEmpty = nodes.length > 0 && visible.length === 0

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>分布式节点</h1>
            <p>管理分布式工作节点并监控其状态。</p>
          </div>
          <div className="task-head-actions">
            <button
              type="button"
              className="env-ghost"
              onClick={() => {
                setCheckDraft(check)
                setCheckOpen(true)
              }}
            >
              <IconSettings />
              调度检查管理
            </button>
            <button type="button" className="task-create" onClick={openCreate}>
              <IconPlus />
              添加节点
            </button>
          </div>
        </header>

        <div className="node-stats">
          <Stat label="总节点数" value={counts.total} icon={<IconMindMapping />} tone="total" />
          <Stat label="已连接" value={counts.connected} icon={<IconCheckCircle />} tone="connected" />
          <Stat label="连接中" value={counts.connecting} icon={<IconClockCircle />} tone="connecting" />
          <Stat label="已断开" value={counts.disconnected} icon={<IconThunderbolt />} tone="disconnected" />
          <Stat label="错误" value={counts.error} icon={<IconExclamationCircle />} tone="error" />
        </div>

        <div className="node-toolbar">
          <Input
            className="node-search"
            allowClear
            prefix={<IconSearch />}
            placeholder="搜索节点..."
            value={keyword}
            onChange={setKeyword}
          />
          <Select
            className="node-status"
            value={status || 'all'}
            options={[
              { value: 'all', label: '所有状态' },
              { value: 'connected', label: '已连接' },
              { value: 'connecting', label: '连接中' },
              { value: 'disconnected', label: '已断开' },
              { value: 'error', label: '错误' },
            ]}
            onChange={(value) => setStatus(value === 'all' ? '' : (value as NodeStatus))}
          />
        </div>

        {visible.length === 0 ? (
          <div className="node-empty">
            <span className="env-empty-icon">
              <IconMindMapping />
            </span>
            <strong>未找到节点</strong>
            <p>{filteredEmpty ? '换个筛选条件试试' : '通过添加新的工作节点开始。'}</p>
            {filteredEmpty ? null : (
              <button type="button" className="task-create" onClick={openCreate}>
                <IconPlus />
                添加节点
              </button>
            )}
          </div>
        ) : (
          <div className="env-table-wrap">
            <table className="env-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>地址</th>
                  <th>系统</th>
                  <th>状态</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {visible.map((node) => (
                  <tr key={node.id}>
                    <td>
                      <strong>{node.name}</strong>
                    </td>
                    <td>{node.host}</td>
                    <td>{node.os}</td>
                    <td>
                      <span className={`node-pill ${node.status}`}>{STATUS_LABEL[node.status]}</span>
                    </td>
                    <td>
                      <button
                        type="button"
                        className="task-icon-btn"
                        aria-label={`删除 ${node.name}`}
                        onClick={() => {
                          setDeleteName(node.name)
                          setPendingDelete(node)
                        }}
                      >
                        <IconDelete />
                      </button>
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
        style={{ width: 520 }}
        title={
          <div className="dialog-title">
            <strong>添加节点</strong>
            <p>登记一个新的分布式工作节点。</p>
          </div>
        }
        visible={editorOpen}
        okText="添加节点"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setEditorOpen(false)}
        onOk={commit}
      >
        <Form layout="vertical">
          <Form.Item label="节点名称" required>
            <Input value={draft.name} placeholder="工作节点" onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          </Form.Item>
          <Form.Item label="地址" required extra="主机和端口，例如 127.0.0.1:6800">
            <Input value={draft.host} placeholder="127.0.0.1:6800" onChange={(value) => setDraft((current) => ({ ...current, host: value }))} />
          </Form.Item>
          <div className="form-split">
            <Form.Item label="系统">
              <Select
                value={draft.os}
                options={['Linux', 'Windows', 'macOS']}
                onChange={(value) => setDraft((current) => ({ ...current, os: String(value) }))}
              />
            </Form.Item>
            <Form.Item label="状态">
              <Select
                value={draft.status}
                options={[
                  { value: 'connected', label: '已连接' },
                  { value: 'connecting', label: '连接中' },
                  { value: 'disconnected', label: '已断开' },
                  { value: 'error', label: '错误' },
                ]}
                onChange={(value) => setDraft((current) => ({ ...current, status: value as NodeStatus }))}
              />
            </Form.Item>
          </div>
          {formError ? <p className="task-form-error">{formError}</p> : null}
        </Form>
      </Modal>

      <Modal
        title="调度检查管理"
        visible={checkOpen}
        okText="保存"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setCheckOpen(false)}
        onOk={() => {
          const interval = Number(checkDraft.interval)
          const timeout = Number(checkDraft.timeout)
          const retries = Number(checkDraft.retries)
          if (!Number.isInteger(interval) || interval < 5 || !Number.isInteger(timeout) || timeout < 1 || !Number.isInteger(retries) || retries < 1) {
            onNotify('请填写有效的检查间隔、超时和失败次数')
            return
          }
          setCheck(checkDraft)
          onNotify(`已保存调度检查，每 ${interval} 秒检查一次`)
          setCheckOpen(false)
        }}
      >
        <Form layout="vertical">
          <Form.Item label="检查间隔（秒）" extra="调度器按这个间隔探测工作节点。">
            <Input value={checkDraft.interval} onChange={(value) => setCheckDraft((current) => ({ ...current, interval: value }))} />
          </Form.Item>
          <Form.Item label="超时（秒）">
            <Input value={checkDraft.timeout} onChange={(value) => setCheckDraft((current) => ({ ...current, timeout: value }))} />
          </Form.Item>
          <Form.Item label="连续失败次数" extra={`当前为每 ${check.interval} 秒检查一次。`}>
            <Input value={checkDraft.retries} onChange={(value) => setCheckDraft((current) => ({ ...current, retries: value }))} />
          </Form.Item>
        </Form>
      </Modal>

      <Modal
        title="删除节点"
        visible={pendingDelete !== null}
        okText="删除"
        cancelText="取消"
        unmountOnExit
        okButtonProps={{ status: 'danger' }}
        onCancel={() => setPendingDelete(null)}
        onOk={() => {
          if (!pendingDelete) return
          setNodes((list) => list.filter((item) => item.id !== pendingDelete.id))
          onNotify(`已删除 ${deleteName}`)
          setPendingDelete(null)
        }}
      >
        <p>确定删除 {deleteName}？此操作只影响当前演示列表。</p>
      </Modal>
    </div>
  )
}

function Stat({ label, value, icon, tone }: { label: string; value: number; icon: ReactNode; tone: string }) {
  return (
    <article className={`node-stat ${tone}`}>
      <div>
        <span>{label}</span>
        <strong>{value}</strong>
      </div>
      <i>{icon}</i>
    </article>
  )
}
