import { Alert, Button, Table, Tag } from '@arco-design/web-react'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import { useEffect, useState } from 'react'
import type { PythonInterpreter } from '../api.ts'
import { fetchPythons, setDefaultPython, verifyPython } from '../api.ts'

const SOURCE_LABEL: Record<PythonInterpreter['source'], { text: string; color: string }> = {
  venv: { text: '项目虚拟环境', color: 'green' },
  system: { text: '系统安装', color: 'blue' },
  PATH: { text: 'PATH', color: 'gray' },
}

export function PythonVersions({ onNotify }: { onNotify: (text: string) => void }) {
  const [interpreters, setInterpreters] = useState<PythonInterpreter[]>([])
  const [venvPath, setVenvPath] = useState('')
  const [loading, setLoading] = useState(true)
  const [verifyingPath, setVerifyingPath] = useState('')
  const [verifyResult, setVerifyResult] = useState<Record<string, string>>({})
  const [error, setError] = useState('')

  const load = async () => {
    try {
      const payload = await fetchPythons()
      setInterpreters(payload.interpreters)
      setVenvPath(payload.venvPath)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const runVerify = async (interpreter: PythonInterpreter) => {
    setVerifyingPath(interpreter.path)
    try {
      const result = await verifyPython(interpreter.path)
      setVerifyResult((current) => ({
        ...current,
        [interpreter.path]: result.ok
          ? `✓ ${result.version}（${result.latencyMs}ms）`
          : `✗ 无法执行：${result.message ?? '未知错误'}`,
      }))
    } catch (err) {
      setVerifyResult((current) => ({ ...current, [interpreter.path]: `✗ ${(err as Error).message}` }))
    } finally {
      setVerifyingPath('')
    }
  }

  const markDefault = async (interpreter: PythonInterpreter) => {
    try {
      await setDefaultPython(interpreter.path)
      onNotify(`已将 Python ${interpreter.version} 设为默认解释器`)
      await load()
    } catch (err) {
      onNotify(`设置失败：${(err as Error).message}`)
    }
  }

  const columns: ColumnProps<PythonInterpreter>[] = [
    {
      title: '版本',
      dataIndex: 'version',
      width: 120,
      render: (value: string, record) => (
        <span>
          <strong>{value}</strong>
          {record.inUse ? <Tag color="green" style={{ marginLeft: 8 }}>任务使用中</Tag> : null}
          {record.isDefault && !record.inUse ? <Tag color="blue" style={{ marginLeft: 8 }}>默认</Tag> : null}
        </span>
      ),
    },
    {
      title: '来源',
      dataIndex: 'source',
      width: 130,
      render: (value: PythonInterpreter['source']) => <Tag color={SOURCE_LABEL[value].color}>{SOURCE_LABEL[value].text}</Tag>,
    },
    {
      title: '路径',
      dataIndex: 'path',
      ellipsis: true,
      render: (value: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#4e5969' }}>{value}</span>
      ),
    },
    {
      title: 'Scrapy',
      dataIndex: 'scrapyVersion',
      width: 110,
      render: (value: string) => (value ? <Tag color="purple">{value}</Tag> : <span style={{ color: '#c9cdd4' }}>—</span>),
    },
    {
      title: '验证结果',
      width: 200,
      render: (_, record) => {
        const result = verifyResult[record.path]
        return result ? (
          <span style={{ fontSize: 12, color: result.startsWith('✓') ? '#00b42a' : '#f53f3f' }}>{result}</span>
        ) : (
          <span style={{ color: '#c9cdd4', fontSize: 12 }}>未验证</span>
        )
      },
    },
    {
      title: '操作',
      width: 190,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="mini" loading={verifyingPath === record.path} onClick={() => void runVerify(record)}>
            验证
          </Button>
          <Button
            size="mini"
            disabled={record.isDefault || record.inUse}
            onClick={() => void markDefault(record)}
          >
            设为默认
          </Button>
        </div>
      ),
    },
  ]

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="brand-text">
            <h1>Python 版本</h1>
            <p>自动检测本机解释器（系统安装 + 项目虚拟环境），真实执行 --version 验证</p>
          </div>
          <Button type="primary" loading={loading} onClick={() => void load()}>
            重新检测
          </Button>
        </header>

        {error ? (
          <section className="panel">
            <Alert type="error" content={error} />
          </section>
        ) : null}

        <section className="panel">
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            content="爬虫任务与流程统一使用工程内虚拟环境 .venv 的 scrapy.exe 执行（绿色「任务使用中」标记）；此处登记的解释器作为环境管理与新建虚拟环境的基础版本参考。"
          />
          <Table rowKey="path" columns={columns} data={interpreters} loading={loading} pagination={false} border={false} />
          <p className="auth-hint" style={{ textAlign: 'left' }}>
            虚拟环境路径：{venvPath || '—'}
          </p>
        </section>
      </div>
    </div>
  )
}
