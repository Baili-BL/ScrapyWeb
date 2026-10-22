import { Button, Form, Input, Switch, Table, Tag } from '@arco-design/web-react'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import { useState } from 'react'
import { NODE } from '../data.ts'
import { LogList } from '../logs/LogList.tsx'
import { NodeList } from '../nodes/NodeList.tsx'
import { EnvList } from '../envs/EnvList.tsx'
import { ProjectList } from '../projects/ProjectList.tsx'
import { TaskList } from '../tasks/TaskList.tsx'
import { FlowList } from '../workflow/FlowList.tsx'
import { menuLabel } from './menu.ts'
import type { MenuKey } from './menu.ts'

type Row = Record<string, string | number>

function StatusTag({ value }: { value: string }) {
  const color = value === '运行中' || value === '在线' || value === '当前使用' ? 'green' : value === '已暂停' ? 'orange' : 'gray'
  return <Tag color={color}>{value}</Tag>
}

function DataCard({
  title,
  desc,
  columns,
  rows,
}: {
  title: string
  desc: string
  columns: ColumnProps<Row>[]
  rows: Row[]
}) {
  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="brand-text">
            <h1>{title}</h1>
            <p>{desc}</p>
          </div>
        </header>
        <section className="panel">
          <Table rowKey="id" columns={columns} data={rows} pagination={false} border={false} />
        </section>
      </div>
    </div>
  )
}

export function ModulePage({
  menuKey,
  onSaved,
}: {
  menuKey: MenuKey
  onSaved: (text: string) => void
}) {
  const [model, setModel] = useState('deepseek-chat')
  const [endpoint, setEndpoint] = useState('https://api.example.com/v1')
  const [siteName, setSiteName] = useState('监控仪表盘')
  const [alertOn, setAlertOn] = useState(true)

  if (menuKey === 'tasks') {
    return <TaskList onNotify={onSaved} />
  }

  if (menuKey === 'workflow') {
    return <FlowList onNotify={onSaved} />
  }

  if (menuKey === 'projects') {
    return <ProjectList onNotify={onSaved} />
  }

  if (menuKey === 'envs') {
    return <EnvList onNotify={onSaved} />
  }

  if (menuKey === 'python') {
    return (
      <DataCard
        title="Python版本"
        desc="节点上可用的 Python 解释器"
        columns={[
          { title: '版本', dataIndex: 'name' },
          { title: '节点', dataIndex: 'node' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value) => <StatusTag value={String(value)} />,
          },
        ]}
        rows={[{ id: 'py311', name: `Python ${NODE.python}`, node: NODE.name, status: '当前使用' }]}
      />
    )
  }

  if (menuKey === 'nodes') {
    return <NodeList onNotify={onSaved} />
  }

  if (menuKey === 'users') {
    return (
      <DataCard
        title="用户管理"
        desc="账号与访问权限"
        columns={[
          { title: '用户', dataIndex: 'name' },
          { title: '账号', dataIndex: 'account' },
          { title: '角色', dataIndex: 'role' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value) => <StatusTag value={String(value)} />,
          },
        ]}
        rows={[{ id: 'demo', name: 'Demo User', account: 'demo', role: 'readonly', status: '在线' }]}
      />
    )
  }

  if (menuKey === 'logs') {
    return <LogList onNotify={onSaved} />
  }

  if (menuKey === 'ai-assistant') {
    return (
      <div className="page">
        <div className="page-inner">
          <header className="page-header">
            <div className="brand-text">
              <h1>AI助手</h1>
              <p>只读账号可查看助手入口，不能发起执行</p>
            </div>
          </header>
          <section className="panel ai-panel">
            <p className="ai-hint">可以询问任务失败原因、调度峰值和节点负载。当前账号为 readonly。</p>
            <Input.TextArea placeholder="输入想了解的监控问题" autoSize={{ minRows: 4, maxRows: 6 }} />
            <div className="ai-actions">
              <Button type="primary" onClick={() => onSaved('只读账号无法发送消息')}>
                发送
              </Button>
            </div>
          </section>
        </div>
      </div>
    )
  }

  if (menuKey === 'ai-config') {
    return (
      <div className="page">
        <div className="page-inner">
          <header className="page-header">
            <div className="brand-text">
              <h1>AI配置</h1>
              <p>模型接口与访问地址</p>
            </div>
          </header>
          <section className="panel form-panel">
            <Form layout="vertical">
              <Form.Item label="模型">
                <Input value={model} onChange={setModel} />
              </Form.Item>
              <Form.Item label="接口地址">
                <Input value={endpoint} onChange={setEndpoint} />
              </Form.Item>
              <Button type="primary" onClick={() => onSaved('AI 配置已保存')}>
                保存
              </Button>
            </Form>
          </section>
        </div>
      </div>
    )
  }

  if (menuKey === 'ai-bot') {
    return (
      <DataCard
        title="机器人配置"
        desc="把告警推送到外部机器人"
        columns={[
          { title: '名称', dataIndex: 'name' },
          { title: '渠道', dataIndex: 'channel' },
          {
            title: '状态',
            dataIndex: 'status',
            render: (value) => <StatusTag value={String(value)} />,
          },
        ]}
        rows={[{ id: '1', name: '默认告警机器人', channel: '未绑定', status: '已暂停' }]}
      />
    )
  }

  if (menuKey === 'settings-basic') {
    return (
      <div className="page">
        <div className="page-inner">
          <header className="page-header">
            <div className="brand-text">
              <h1>基础设置</h1>
              <p>站点名称与演示数据</p>
            </div>
          </header>
          <section className="panel form-panel">
            <Form layout="vertical">
              <Form.Item label="站点名称">
                <Input value={siteName} onChange={setSiteName} />
              </Form.Item>
              <Button type="primary" onClick={() => onSaved('基础设置已保存')}>
                保存
              </Button>
            </Form>
          </section>
        </div>
      </div>
    )
  }

  if (menuKey === 'settings-alert') {
    return (
      <div className="page">
        <div className="page-inner">
          <header className="page-header">
            <div className="brand-text">
              <h1>通知告警</h1>
              <p>任务失败或节点离线时发送通知</p>
            </div>
          </header>
          <section className="panel form-panel">
            <div className="switch-row">
              <div>
                <strong>失败告警</strong>
                <p>任务执行失败时通知</p>
              </div>
              <Switch checked={alertOn} onChange={setAlertOn} />
            </div>
            <Button type="primary" onClick={() => onSaved(alertOn ? '已开启失败告警' : '已关闭失败告警')}>
              保存
            </Button>
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
            <h1>{menuLabel(menuKey)}</h1>
          </div>
        </header>
      </div>
    </div>
  )
}
