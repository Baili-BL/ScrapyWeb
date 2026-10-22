import { Button, Form, Input, Switch } from '@arco-design/web-react'
import { useState } from 'react'
import { AiAssistant } from '../ai/AiAssistant.tsx'
import { AiConfigPage } from '../ai/AiConfigPage.tsx'
import { BotConfig } from '../bots/BotConfig.tsx'
import { LogList } from '../logs/LogList.tsx'
import { UserAdmin } from '../users/UserAdmin.tsx'
import { PythonVersions } from '../python/PythonVersions.tsx'
import { TechDocs } from '../docs/TechDocs.tsx'
import { NodeList } from '../nodes/NodeList.tsx'
import { EnvList } from '../envs/EnvList.tsx'
import { ProjectList } from '../projects/ProjectList.tsx'
import { TaskList } from '../tasks/TaskList.tsx'
import { FlowList } from '../workflow/FlowList.tsx'
import { menuLabel } from './menu.ts'
import type { MenuKey } from './menu.ts'

export function ModulePage({
  menuKey,
  onSaved,
}: {
  menuKey: MenuKey
  onSaved: (text: string) => void
}) {
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
    return <PythonVersions onNotify={onSaved} />
  }

  if (menuKey === 'docs') {
    return <TechDocs />
  }

  if (menuKey === 'nodes') {
    return <NodeList onNotify={onSaved} />
  }

  if (menuKey === 'users') {
    return <UserAdmin onNotify={onSaved} />
  }

  if (menuKey === 'logs') {
    return <LogList onNotify={onSaved} />
  }

  if (menuKey === 'ai-assistant') {
    return <AiAssistant onNotify={onSaved} />
  }

  if (menuKey === 'ai-config') {
    return <AiConfigPage onNotify={onSaved} />
  }

  if (menuKey === 'ai-bot') {
    return <BotConfig onNotify={onSaved} />
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
