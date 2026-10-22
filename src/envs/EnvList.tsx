import { Alert, Button, Form, Input, Modal, Table, Tag } from '@arco-design/web-react'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import { IconDelete, IconPlus } from '@arco-design/web-react/icon'
import { useEffect, useState } from 'react'
import type { EnvItem } from '../api.ts'
import { createEnv, deleteEnv, fetchEnvs, installEnvScrapy } from '../api.ts'

export function EnvList({ onNotify }: { onNotify: (text: string) => void }) {
  const [envs, setEnvs] = useState<EnvItem[]>([])
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState('')
  const [createOpen, setCreateOpen] = useState(false)
  const [envName, setEnvName] = useState('')
  const [formError, setFormError] = useState('')
  const [creating, setCreating] = useState(false)
  const [installingName, setInstallingName] = useState('')
  const [deleteTarget, setDeleteTarget] = useState<EnvItem | null>(null)

  const loadEnvs = async () => {
    try {
      const payload = await fetchEnvs()
      setEnvs(payload.envs)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadEnvs()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commitCreate = async () => {
    const name = envName.trim()
    if (!/^[a-zA-Z0-9_-]{2,32}$/.test(name)) {
      setFormError('环境名需 2-32 位，仅限字母/数字/下划线/中划线')
      return
    }
    setCreating(true)
    setFormError('')
    try {
      await createEnv(name)
      onNotify(`虚拟环境 ${name} 创建成功（真实 python -m venv），可点击「安装 Scrapy」`)
      setCreateOpen(false)
      setEnvName('')
      await loadEnvs()
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setCreating(false)
    }
  }

  const runInstall = async (env: EnvItem) => {
    setInstallingName(env.name)
    try {
      const result = await installEnvScrapy(env.name)
      onNotify(`${env.name} 已安装 Scrapy ${result.scrapyVersion}（${result.latencySec}s）`)
      await loadEnvs()
    } catch (err) {
      onNotify(`安装失败：${(err as Error).message}`)
    } finally {
      setInstallingName('')
    }
  }

  const removeEnv = async (env: EnvItem) => {
    try {
      await deleteEnv(env.name)
      onNotify(`已删除虚拟环境 ${env.name}`)
      await loadEnvs()
    } catch (err) {
      onNotify(`删除失败：${(err as Error).message}`)
    }
  }

  const columns: ColumnProps<EnvItem>[] = [
    {
      title: '环境名称',
      dataIndex: 'name',
      width: 170,
      render: (value: string, record) => (
        <span>
          <strong>{value}</strong>
          {record.isProjectVenv ? <Tag color="green" style={{ marginLeft: 8 }}>主环境</Tag> : null}
        </span>
      ),
    },
    {
      title: 'Python',
      dataIndex: 'python',
      width: 110,
    },
    {
      title: 'Scrapy',
      dataIndex: 'scrapy',
      width: 110,
      render: (value: string) => (value ? <Tag color="purple">{value}</Tag> : <Tag color="gray">未安装</Tag>),
    },
    { title: '关联任务', dataIndex: 'tasks', width: 90 },
    {
      title: '路径',
      dataIndex: 'path',
      ellipsis: true,
      render: (value: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#4e5969' }}>{value}</span>
      ),
    },
    {
      title: '操作',
      width: 230,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button
            size="mini"
            loading={installingName === record.name}
            disabled={Boolean(record.scrapy)}
            onClick={() => void runInstall(record)}
          >
            安装 Scrapy
          </Button>
          <Button
            size="mini"
            status="danger"
            disabled={record.isProjectVenv}
            icon={<IconDelete />}
            onClick={() => setDeleteTarget(record)}
          />
        </div>
      ),
    },
  ]

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>环境管理</h1>
            <p>真实虚拟环境（python -m venv）。爬虫任务统一使用主环境 scrapy_env 执行。</p>
          </div>
          <button type="button" className="task-create" onClick={() => { setEnvName(''); setFormError(''); setCreateOpen(true) }}>
            <IconPlus />
            创建虚拟环境
          </button>
        </header>

        {error ? (
          <section className="panel">
            <Alert type="error" content={error} />
          </section>
        ) : null}

        <section className="panel">
          <Table rowKey="name" columns={columns} data={envs} loading={loading} pagination={false} border={false} />
        </section>
      </div>

      <Modal
        title="创建虚拟环境"
        visible={createOpen}
        okText="创建"
        cancelText="取消"
        confirmLoading={creating}
        unmountOnExit
        onCancel={() => setCreateOpen(false)}
        onOk={() => void commitCreate()}
      >
        <Form layout="vertical">
          <Form.Item label="环境名称" required>
            <Input value={envName} placeholder="例如：spider-ext-01" onChange={setEnvName} />
          </Form.Item>
          <Alert
            type="info"
            content="将真实执行 python -m venv 创建到 .venvs/ 目录（约 10-30 秒）。创建后可单独安装 Scrapy；当前调度仍统一使用主环境 scrapy_env。"
          />
          {formError ? <Alert style={{ marginTop: 10 }} type="error" content={formError} /> : null}
        </Form>
      </Modal>

      <Modal
        title="删除虚拟环境"
        visible={deleteTarget !== null}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        unmountOnExit
        onCancel={() => setDeleteTarget(null)}
        onOk={() => {
          if (deleteTarget) void removeEnv(deleteTarget)
          setDeleteTarget(null)
        }}
      >
        <p>确定删除虚拟环境 {deleteTarget?.name}？其目录将被真实移除，不可恢复。</p>
      </Modal>
    </div>
  )
}
