import { Alert, Button, Form, Input, Modal, Tag } from '@arco-design/web-react'
import { IconEdit } from '@arco-design/web-react/icon'
import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import type { ProjectItem } from '../api.ts'
import { fetchProjects, updateProjectDescription } from '../api.ts'

function fmtTime(iso: string | null): string {
  if (!iso) return '从未运行'
  const date = new Date(iso)
  const pad = (value: number) => String(value).padStart(2, '0')
  return `${pad(date.getMonth() + 1)}-${pad(date.getDate())} ${pad(date.getHours())}:${pad(date.getMinutes())}`
}

export function ProjectList({ onNotify }: { onNotify: (text: string) => void }) {
  const navigate = useNavigate()
  const [projects, setProjects] = useState<ProjectItem[] | null>(null)
  const [error, setError] = useState('')
  const [editTarget, setEditTarget] = useState<ProjectItem | null>(null)
  const [editDescription, setEditDescription] = useState('')
  const [formError, setFormError] = useState('')

  const loadProjects = async () => {
    try {
      const payload = await fetchProjects()
      setProjects(payload.projects)
      setError('')
    } catch (err) {
      setError((err as Error).message)
    }
  }

  useEffect(() => {
    void loadProjects()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const commitEdit = async () => {
    if (!editTarget) return
    try {
      await updateProjectDescription(editTarget.name, editDescription.trim())
      onNotify(`已更新 ${editTarget.name} 的描述`)
      setEditTarget(null)
      await loadProjects()
    } catch (err) {
      setFormError((err as Error).message)
    }
  }

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>项目管理</h1>
            <p>项目由爬虫注册表真实定义（server/api-plugin.ts 的 SPIDERS），展示真实任务数与最近运行。</p>
          </div>
          <button type="button" className="task-create" onClick={() => void loadProjects()}>
            刷新
          </button>
        </header>

        {error ? (
          <section className="panel">
            <Alert type="error" content={error} />
          </section>
        ) : null}

        <div className="flow-list">
          {(projects ?? []).map((project) => (
            <div key={project.name} className="flow-card">
              <strong>{project.name}</strong>
              <span className="flow-desc">{project.description}</span>
              <span className="flow-steps">环境：{project.env}</span>
              <span className="flow-lastrun">
                最近运行：{fmtTime(project.lastRun)}
                {project.lastItems !== null ? ` · 产出 ${project.lastItems} 条` : ''}
              </span>
              <em>
                {project.tasks} 个任务
                {project.tags.map((tag) => (
                  <Tag key={tag} size="small" color="arcoblue">
                    {tag}
                  </Tag>
                ))}
              </em>
              <div className="flow-card-actions">
                <Button size="mini" type="primary" onClick={() => navigate('/tasks')}>
                  去运行
                </Button>
                <Button
                  size="mini"
                  icon={<IconEdit />}
                  onClick={() => {
                    setEditTarget(project)
                    setEditDescription(project.description)
                    setFormError('')
                  }}
                >
                  描述
                </Button>
              </div>
            </div>
          ))}
        </div>
      </div>

      <Modal
        title={editTarget ? `编辑 ${editTarget.name} 描述` : '编辑描述'}
        visible={editTarget !== null}
        okText="保存"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setEditTarget(null)}
        onOk={() => void commitEdit()}
      >
        <Form layout="vertical">
          <Form.Item label="描述" required>
            <Input.TextArea value={editDescription} autoSize={{ minRows: 3, maxRows: 6 }} onChange={setEditDescription} />
          </Form.Item>
          {formError ? <p className="task-form-error">{formError}</p> : null}
        </Form>
      </Modal>
    </div>
  )
}
