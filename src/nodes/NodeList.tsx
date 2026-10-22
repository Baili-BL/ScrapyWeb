import { Alert, Button, Drawer, Form, Input, Modal } from '@arco-design/web-react'
import { IconDelete, IconMindMapping, IconPlus, IconRefresh, IconSearch } from '@arco-design/web-react/icon'
import { useEffect, useMemo, useState } from 'react'
import type { LocalNodeInfo, NodesPayload, RemoteNodeDraft, RemoteNodeItem } from '../api.ts'
import { createRemoteNode, deleteRemoteNode, fetchNodes, probeRemoteNode, updateRemoteNode } from '../api.ts'
import { CoreGrid, DiskUsage, MemoryBar } from '../ui.tsx'

type NodeStatus = 'online' | 'connected' | 'disconnected' | 'unknown'

const STATUS_TEXT: Record<NodeStatus, string> = {
  online: '在线',
  connected: '已连接',
  disconnected: '已断开',
  unknown: '未探测',
}

function fmtTime(iso: string | null): string {
  if (!iso) return '—'
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`
}

function fmtUptime(seconds: number): string {
  const days = Math.floor(seconds / 86400)
  const hours = Math.floor((seconds % 86400) / 3600)
  const minutes = Math.floor((seconds % 3600) / 60)
  return days > 0 ? `${days} 天 ${hours} 小时` : `${hours} 小时 ${minutes} 分`
}

const EMPTY_REMOTE: RemoteNodeDraft & { id?: string } = { name: '', host: '', description: '' }

export function NodeList({ onNotify }: { onNotify: (text: string) => void }) {
  const [payload, setPayload] = useState<NodesPayload | null>(null)
  const [error, setError] = useState('')
  const [keyword, setKeyword] = useState('')
  const [probingId, setProbingId] = useState('')
  const [editorOpen, setEditorOpen] = useState(false)
  const [editorDraft, setEditorDraft] = useState<RemoteNodeDraft & { id?: string }>(EMPTY_REMOTE)
  const [formError, setFormError] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<RemoteNodeItem | null>(null)
  const [detailOpen, setDetailOpen] = useState(false)

  const loadNodes = async () => {
    try {
      setPayload(await fetchNodes())
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    void loadNodes()
    const timer = window.setInterval(() => void loadNodes(), 8000)
    return () => window.clearInterval(timer)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const remote = payload?.remote ?? []
  const filteredRemote = useMemo(() => {
    const text = keyword.trim().toLowerCase()
    if (!text) return remote
    return remote.filter((node) => `${node.name} ${node.host} ${node.description}`.toLowerCase().includes(text))
  }, [keyword, remote])

  const onlineCount = 1 + remote.filter((node) => node.lastStatus === 'connected').length
  const offlineCount = remote.filter((node) => node.lastStatus === 'disconnected').length
  const unknownCount = remote.filter((node) => node.lastStatus === 'unknown').length

  const openCreate = () => {
    setEditorDraft(EMPTY_REMOTE)
    setFormError('')
    setEditorOpen(true)
  }

  const openEdit = (node: RemoteNodeItem) => {
    setEditorDraft({ id: node.id, name: node.name, host: node.host, description: node.description })
    setFormError('')
    setEditorOpen(true)
  }

  const commitEditor = async () => {
    const name = editorDraft.name.trim()
    const host = editorDraft.host.trim()
    if (!name || !host) {
      setFormError('节点名称与地址不能为空')
      return
    }
    try {
      if (editorDraft.id) {
        await updateRemoteNode(editorDraft.id, { name, host, description: editorDraft.description.trim() })
        onNotify(`已更新节点 ${name}`)
      } else {
        await createRemoteNode({ name, host, description: editorDraft.description.trim() })
        onNotify(`已登记节点 ${name}，点击「探活」测试连通性`)
      }
      setEditorOpen(false)
      await loadNodes()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  const probe = async (node: RemoteNodeItem) => {
    setProbingId(node.id)
    try {
      const result = await probeRemoteNode(node.id)
      onNotify(`${node.name} 探活结果：${result.status === 'connected' ? '在线 ✓' : '不可达 ✗'}`)
      await loadNodes()
    } catch (err) {
      onNotify(`探活失败：${(err as Error).message}`)
    } finally {
      setProbingId('')
    }
  }

  const removeNode = async (node: RemoteNodeItem) => {
    try {
      await deleteRemoteNode(node.id)
      onNotify(`已移除 ${node.name}`)
      await loadNodes()
    } catch (err) {
      onNotify(`删除失败：${(err as Error).message}`)
    }
  }

  const local = payload?.local
  const detailNode: LocalNodeInfo | null = detailOpen && local ? local : null

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>分布式节点</h1>
            <p>本机即主控节点（实时上报）；可登记远程节点并通过 /api/health 真实探活。每 8 秒自动刷新。</p>
          </div>
          <div className="task-head-actions">
            <button type="button" className="env-ghost" onClick={() => void loadNodes()}>
              <IconRefresh />
              立即刷新
            </button>
            <button type="button" className="task-create" onClick={openCreate}>
              <IconPlus />
              登记远程节点
            </button>
          </div>
        </header>

        {error ? <Alert style={{ marginBottom: 14 }} type="error" content={error} /> : null}

        <div className="node-stats">
          <article className="node-stat total">
            <div>
              <span>总节点数</span>
              <strong>{1 + remote.length}</strong>
            </div>
            <i>
              <IconMindMapping />
            </i>
          </article>
          <article className="node-stat connected">
            <div>
              <span>在线</span>
              <strong>{onlineCount}</strong>
            </div>
            <i>
              <IconRefresh />
            </i>
          </article>
          <article className="node-stat disconnected">
            <div>
              <span>已断开</span>
              <strong>{offlineCount}</strong>
            </div>
            <i>
              <IconRefresh />
            </i>
          </article>
          <article className="node-stat connecting">
            <div>
              <span>未探测</span>
              <strong>{unknownCount}</strong>
            </div>
            <i>
              <IconSearch />
            </i>
          </article>
        </div>

        <div className="node-toolbar">
          <Input
            className="node-search"
            allowClear
            prefix={<IconSearch />}
            placeholder="搜索远程节点..."
            value={keyword}
            onChange={setKeyword}
          />
        </div>

        {/* 主控节点（真实本机） */}
        {local ? (
          <div className="flow-card local-node-card" role="button" tabIndex={0} onClick={() => setDetailOpen(true)}>
            <div className="local-node-head">
              <strong>{local.name}</strong>
              <i className="task-badge active">在线 · {local.role}</i>
            </div>
            <span className="flow-steps">
              {local.host} · {local.os} ({local.arch}) · {local.cores} 核 · {local.totalMemGb.toFixed(1)} GB 内存
            </span>
            <span className="flow-lastrun">
              CPU {local.metrics.cpu.avg}% · 内存 {local.metrics.memory.percent}% · 磁盘 {local.metrics.disk.percent}% · Python {local.python} · Scrapy {local.scrapy}
            </span>
            <em>
              心跳 {fmtTime(local.heartbeat)}
              {local.runningSpiders.length ? <i className="task-badge running">运行中：{local.runningSpiders.join('、')}</i> : null}
              <span className="flow-card-actions" style={{ marginTop: 0 }}>
                <button
                  type="button"
                  className="task-text-btn"
                  onClick={(event) => {
                    event.stopPropagation()
                    setDetailOpen(true)
                  }}
                >
                  查看实时指标
                </button>
              </span>
            </em>
          </div>
        ) : (
          <p className="node-empty">读取主控节点中…</p>
        )}

        {/* 远程节点 */}
        <h3 className="remote-title">远程节点（{filteredRemote.length}）</h3>
        {filteredRemote.length === 0 ? (
          <div className="node-empty">
            <span className="env-empty-icon">
              <IconMindMapping />
            </span>
            <strong>还没有登记远程节点</strong>
            <p>在另一台机器部署本平台后，用「机器IP:端口」登记到这里，即可真实探活监控。</p>
            <button type="button" className="task-create" onClick={openCreate}>
              <IconPlus />
              登记远程节点
            </button>
          </div>
        ) : (
          <div className="env-table-wrap">
            <table className="env-table">
              <thead>
                <tr>
                  <th>名称</th>
                  <th>地址</th>
                  <th>描述</th>
                  <th>状态</th>
                  <th>最近探活</th>
                  <th>操作</th>
                </tr>
              </thead>
              <tbody>
                {filteredRemote.map((node) => {
                  const isProbing = probingId === node.id
                  const status = node.lastStatus
                  return (
                    <tr key={node.id}>
                      <td>
                        <strong>{node.name}</strong>
                      </td>
                      <td>{node.host}</td>
                      <td>{node.description || '—'}</td>
                      <td>
                        <span className={`node-pill ${status === 'connected' ? 'connected' : status === 'disconnected' ? 'disconnected' : 'connecting'}`}>
                          {STATUS_TEXT[status]}
                        </span>
                      </td>
                      <td>{fmtTime(node.lastProbeAt)}</td>
                      <td>
                        <div style={{ display: 'flex', gap: 8 }}>
                          <Button size="mini" loading={isProbing} onClick={() => void probe(node)}>
                            探活
                          </Button>
                          <Button size="mini" onClick={() => openEdit(node)}>
                            编辑
                          </Button>
                          <Button size="mini" status="danger" icon={<IconDelete />} onClick={() => setDeleteTarget(node)} />
                        </div>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>

      <Drawer
        width={520}
        title={detailNode ? `${detailNode.name} · 实时指标` : '节点详情'}
        visible={detailOpen}
        footer={null}
        unmountOnExit
        onCancel={() => setDetailOpen(false)}
      >
        {detailNode ? (
          <>
            <ul className="kv" style={{ marginBottom: 16 }}>
              <li>
                <span>地址</span>
                <b>{detailNode.host}</b>
              </li>
              <li>
                <span>系统</span>
                <b>{detailNode.os}</b>
              </li>
              <li>
                <span>CPU</span>
                <b>{detailNode.cpuModel}</b>
              </li>
              <li>
                <span>运行环境</span>
                <b>
                  Python {detailNode.python} · Scrapy {detailNode.scrapy}
                </b>
              </li>
              <li>
                <span>主机运行时长</span>
                <b>{fmtUptime(detailNode.uptimeSec)}</b>
              </li>
              <li>
                <span>心跳</span>
                <b>{fmtTime(detailNode.heartbeat)}</b>
              </li>
              <li>
                <span>运行中的爬虫</span>
                <b>{detailNode.runningSpiders.length ? detailNode.runningSpiders.join('、') : '无'}</b>
              </li>
            </ul>
            <CoreGrid cores={detailNode.metrics.cpu.cores} />
            <div style={{ marginTop: 16 }}>
              <MemoryBar
                usedGb={detailNode.metrics.memory.usedGb}
                totalGb={detailNode.metrics.memory.totalGb}
                percent={detailNode.metrics.memory.percent}
              />
            </div>
            <div style={{ marginTop: 16 }}>
              <DiskUsage disk={detailNode.metrics.disk} />
            </div>
          </>
        ) : null}
      </Drawer>

      <Modal
        title={editorDraft.id ? '编辑远程节点' : '登记远程节点'}
        visible={editorOpen}
        okText={editorDraft.id ? '保存' : '登记'}
        cancelText="取消"
        unmountOnExit
        onCancel={() => setEditorOpen(false)}
        onOk={() => void commitEditor()}
      >
        <Form layout="vertical">
          <Form.Item label="节点名称" required>
            <Input value={editorDraft.name} placeholder="例如：2号采集机" onChange={(value) => setEditorDraft((current) => ({ ...current, name: value }))} />
          </Form.Item>
          <Form.Item label="地址" required extra="机器IP:端口（该机器需已部署本平台，探活走 /api/health）">
            <Input value={editorDraft.host} placeholder="192.168.1.50:5173" onChange={(value) => setEditorDraft((current) => ({ ...current, host: value }))} />
          </Form.Item>
          <Form.Item label="描述">
            <Input value={editorDraft.description} placeholder="用途说明（可选）" onChange={(value) => setEditorDraft((current) => ({ ...current, description: value }))} />
          </Form.Item>
          {formError ? <Alert type="error" content={formError} /> : null}
        </Form>
      </Modal>

      <Modal
        title="移除节点"
        visible={deleteTarget !== null}
        okText="移除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        unmountOnExit
        onCancel={() => setDeleteTarget(null)}
        onOk={() => {
          if (deleteTarget) void removeNode(deleteTarget)
          setDeleteTarget(null)
        }}
      >
        <p>确定从列表移除 {deleteTarget?.name}（{deleteTarget?.host}）？这只影响登记信息，不影响该机器本身。</p>
      </Modal>
    </div>
  )
}
