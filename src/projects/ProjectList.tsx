import { Checkbox, Dropdown, Empty, Form, Input, Menu, Modal, Radio, Select } from '@arco-design/web-react'
import {
  IconCalendar,
  IconClockCircle,
  IconCloud,
  IconCopy,
  IconDelete,
  IconDesktop,
  IconEdit,
  IconFile,
  IconFolder,
  IconList,
  IconPlus,
  IconTag,
  IconUpload,
  IconUser,
} from '@arco-design/web-react/icon'
import type { ReactNode } from 'react'
import { useMemo, useState } from 'react'
import { NODE } from '../data.ts'
import { DEMO_PROJECT_TIME, EMPTY_PROJECT, SEED_PROJECTS } from './model.ts'
import type { ProjectDraft, ProjectItem } from './model.ts'

type ProjectFilters = {
  keyword: string
  node: string | null
  tag: string | null
}

const INITIAL_FILTERS: ProjectFilters = {
  keyword: '',
  node: null,
  tag: null,
}

let projectSeq = 1

function nextProjectId(): string {
  projectSeq += 1
  return `project-${projectSeq}`
}

function splitTags(value: string): string[] {
  return value
    .split(/[,，]/)
    .map((item) => item.trim())
    .filter(Boolean)
}

export function ProjectList({ onNotify }: { onNotify: (text: string) => void }) {
  const [projects, setProjects] = useState<ProjectItem[]>(SEED_PROJECTS)
  const [filters, setFilters] = useState<ProjectFilters>(INITIAL_FILTERS)
  const [editor, setEditor] = useState<'create' | 'import' | ProjectItem | null>(null)
  const [draft, setDraft] = useState<ProjectDraft>(EMPTY_PROJECT)
  const [formError, setFormError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<ProjectItem | null>(null)
  const [deleteName, setDeleteName] = useState('')

  const tagOptions = useMemo(() => {
    const names = new Set<string>()
    projects.forEach((item) => item.tags.forEach((tag) => names.add(tag)))
    return [...names]
  }, [projects])

  const visible = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return projects.filter((item) => {
      if (keyword) {
        const blob = `${item.name} ${item.description} ${item.path} ${item.archive}`.toLowerCase()
        if (!blob.includes(keyword)) return false
      }
      if (filters.node && item.node !== filters.node) return false
      if (filters.tag && !item.tags.includes(filters.tag)) return false
      return true
    })
  }, [filters, projects])

  const openCreate = () => {
    setDraft(EMPTY_PROJECT)
    setFormError('')
    setEditor('create')
  }

  const openImport = () => {
    setDraft({ ...EMPTY_PROJECT, description: '导入的代码包' })
    setFormError('')
    setEditor('import')
  }

  const openEdit = (project: ProjectItem) => {
    setDraft({
      name: project.name,
      description: project.description,
      path: project.path,
      archive: project.archive,
      collaborators: project.collaborators,
      node: project.node === '无' ? '' : project.node,
      tags: project.tags.join(', '),
      source: project.archive.endsWith('.zip') || !project.archive ? 'zip' : 'git',
      gitUrl: project.archive.endsWith('.zip') ? '' : project.archive,
      members: project.collaborators
        .split(/[,，]/)
        .map((item) => item.trim())
        .filter((item) => item === 'admin' || item === 'demo'),
    })
    setFormError('')
    setEditor(project)
  }

  const commitDraft = () => {
    const name = draft.name.trim()
    const path = draft.path.trim() || '/'
    const archive = draft.source === 'git' ? draft.gitUrl.trim() : draft.archive.trim()
    if (!name) {
      setFormError('请填写项目名称')
      return
    }
    if (!path.startsWith('/')) {
      setFormError('工作路径应以 / 开头')
      return
    }
    if (draft.source === 'zip' && !archive) {
      setFormError('请上传 ZIP 文件')
      return
    }
    if (draft.source === 'git' && !archive) {
      setFormError('请填写 Git 仓库地址')
      return
    }
    if (!editor) return
    const editingId = editor === 'create' || editor === 'import' ? null : editor.id
    if (projects.some((item) => item.name === name && item.id !== editingId)) {
      setFormError('已有同名项目')
      return
    }
    const tags = splitTags(draft.tags)
    if (editor === 'create' || editor === 'import') {
      const created: ProjectItem = {
        id: nextProjectId(),
        name,
        description: draft.description.trim() || (editor === 'import' ? '导入的代码包' : ''),
        path,
        archive,
        tasks: 0,
        collaborators: draft.members.join(', ') || '—',
        node: draft.node || '无',
        createdAt: DEMO_PROJECT_TIME,
        updatedAt: DEMO_PROJECT_TIME,
        status: 'active',
        tags,
      }
      setProjects((list) => [created, ...list])
      onNotify(editor === 'import' ? `已导入 ${name}` : `已创建 ${name}`)
    } else {
      setProjects((list) =>
        list.map((item) =>
          item.id === editor.id
            ? {
                ...item,
                name,
                description: draft.description.trim(),
                path,
                archive,
                collaborators: draft.members.join(', ') || '—',
                node: draft.node || '无',
                tags,
                updatedAt: DEMO_PROJECT_TIME,
              }
            : item,
        ),
      )
      onNotify(`已保存 ${name}`)
    }
    setEditor(null)
  }

  const duplicate = (project: ProjectItem) => {
    let name = `${project.name}_copy`
    let index = 2
    while (projects.some((item) => item.name === name)) {
      name = `${project.name}_copy${index}`
      index += 1
    }
    const copy: ProjectItem = {
      ...project,
      id: nextProjectId(),
      name,
      tasks: 0,
      tags: [...project.tags],
      createdAt: DEMO_PROJECT_TIME,
      updatedAt: DEMO_PROJECT_TIME,
    }
    setProjects((list) => [copy, ...list])
    onNotify(`已复制为 ${name}`)
  }

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>项目管理</h1>
            <p>管理您的项目和代码</p>
          </div>
          <div className="task-head-actions">
            <button type="button" className="task-icon-btn" aria-label="导入项目" onClick={openImport}>
              <IconUpload />
            </button>
            <button type="button" className="task-create" onClick={openCreate}>
              创建项目
              <IconPlus />
            </button>
          </div>
        </header>

        <div className="task-filters">
          <Input
            className="task-search"
            allowClear
            placeholder="搜索"
            value={filters.keyword}
            onChange={(value) => setFilters((current) => ({ ...current, keyword: value }))}
          />
          <FilterDrop
            label="工作节点"
            icon={<IconDesktop />}
            active={filters.node !== null}
            options={[
              { key: '__all', label: '全部节点' },
              { key: '无', label: '无' },
              { key: NODE.name, label: NODE.name },
            ]}
            onPick={(key) => setFilters((current) => ({ ...current, node: key === '__all' ? null : key }))}
          />
          {filters.node ? (
            <button type="button" className="filter-chip" onClick={() => setFilters((current) => ({ ...current, node: null }))}>
              {filters.node}
            </button>
          ) : null}
          <FilterDrop
            label="标签"
            icon={<IconTag />}
            active={filters.tag !== null}
            options={[{ key: '__all', label: '全部标签' }, ...tagOptions.map((name) => ({ key: name, label: name }))]}
            onPick={(key) => setFilters((current) => ({ ...current, tag: key === '__all' ? null : key }))}
          />
          {filters.tag ? (
            <button type="button" className="filter-chip" onClick={() => setFilters((current) => ({ ...current, tag: null }))}>
              {filters.tag}
            </button>
          ) : null}
        </div>

        {visible.length === 0 ? (
          <Empty className="task-empty" description="没有匹配的项目" />
        ) : (
          <div className="project-list">
            {visible.map((project) => (
              <article key={project.id} className="project-card">
                <div className="project-main">
                  <span className="project-folder" aria-hidden="true">
                    <IconFolder />
                  </span>
                  <div>
                    <div className="project-title">
                      <strong>{project.name}</strong>
                      <span className={project.status === 'active' ? 'task-badge active' : 'task-badge paused'}>
                        <i />
                        {project.status === 'active' ? '活跃' : '已暂停'}
                      </span>
                    </div>
                    <p className="project-desc">{project.description}</p>
                    <div className="project-files">
                      <span className="project-file">
                        <IconFolder />
                        {project.path}
                      </span>
                      <button
                        type="button"
                        className="project-file"
                        onClick={() => onNotify(`演示环境无法下载 ${project.archive}`)}
                      >
                        <IconFile />
                        {project.archive}
                      </button>
                    </div>
                    {project.tags.length > 0 ? (
                      <div className="project-tags">
                        {project.tags.map((tag) => (
                          <span key={tag} className="task-pill">
                            {tag}
                          </span>
                        ))}
                      </div>
                    ) : null}
                  </div>
                </div>
                <div className="project-stats">
                  <span className="project-stat">
                    <IconList />
                    任务管理
                    <strong>{project.tasks}</strong>
                  </span>
                  <span className="project-stat">
                    <IconCalendar />
                    创建时间
                    <strong>{project.createdAt}</strong>
                  </span>
                  <span className="project-stat">
                    <IconUser />
                    协作者
                    <strong>{project.collaborators}</strong>
                  </span>
                  <span className="project-stat">
                    <IconClockCircle />
                    更新时间
                    <strong>{project.updatedAt}</strong>
                  </span>
                  <span className="project-stat">
                    <IconDesktop />
                    工作节点
                    <strong>{project.node}</strong>
                  </span>
                </div>
                <div className="task-actions">
                  <button type="button" className="task-icon-btn" aria-label={`编辑 ${project.name}`} onClick={() => openEdit(project)}>
                    <IconEdit />
                  </button>
                  <button type="button" className="task-icon-btn" aria-label={`复制 ${project.name}`} onClick={() => duplicate(project)}>
                    <IconCopy />
                  </button>
                  <button
                    type="button"
                    className="task-icon-btn"
                    aria-label={`删除 ${project.name}`}
                    onClick={() => {
                      setDeleteName(project.name)
                      setPendingDelete(project)
                    }}
                  >
                    <IconDelete />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Modal
        className="create-dialog"
        style={{ width: 720 }}
        title={
          <div className="dialog-title">
            <strong>{editor === 'create' || editor === 'import' ? '创建项目' : '编辑项目'}</strong>
            <p>创建一个新项目以开始管理任务。</p>
          </div>
        }
        visible={editor !== null}
        okText={editor === 'create' || editor === 'import' ? '创建项目' : '保存'}
        cancelText="取消"
        unmountOnExit
        onCancel={() => setEditor(null)}
        onOk={commitDraft}
      >
        <Form layout="vertical">
          <div className="form-split">
            <Form.Item label="名称" required>
              <Input value={draft.name} placeholder="我的项目" onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
            </Form.Item>
            <Form.Item
              label="工作路径"
              required
              extra="工作路径是项目文件的发布目录，如 /test。不要填写绝对路径，应以 / 开头。留空时使用默认路径 /。"
            >
              <Input value={draft.path} placeholder="/" onChange={(value) => setDraft((current) => ({ ...current, path: value }))} />
            </Form.Item>
          </div>
          <Form.Item label="描述">
            <Input.TextArea
              value={draft.description}
              placeholder="项目描述..."
              onChange={(value) => setDraft((current) => ({ ...current, description: value }))}
            />
          </Form.Item>
          <Form.Item label="来源类型">
            <Radio.Group value={draft.source} onChange={(value) => setDraft((current) => ({ ...current, source: value as 'zip' | 'git' }))}>
              <Radio value="zip">Zip 上传</Radio>
              <Radio value="git">Git 仓库</Radio>
            </Radio.Group>
          </Form.Item>
          {draft.source === 'zip' ? (
            <Form.Item label="项目文件 (zip)" required extra="上传包含项目代码的 .zip 文件。">
              <label
                className="zip-drop"
                onDragOver={(event) => event.preventDefault()}
                onDrop={(event) => {
                  event.preventDefault()
                  const file = event.dataTransfer.files[0]
                  if (!file) return
                  setDraft((current) => ({ ...current, archive: file.name }))
                }}
              >
                <input
                  type="file"
                  accept=".zip,application/zip"
                  onChange={(event) => {
                    const file = event.target.files?.[0]
                    if (!file) return
                    setDraft((current) => ({ ...current, archive: file.name }))
                  }}
                />
                <IconCloud />
                <span>{draft.archive || '拖拽 ZIP 文件到此处，或点击选择'}</span>
              </label>
            </Form.Item>
          ) : (
            <Form.Item label="Git 仓库" required extra="填写可克隆的仓库地址。">
              <Input
                value={draft.gitUrl}
                placeholder="https://github.com/org/repo.git"
                onChange={(value) => setDraft((current) => ({ ...current, gitUrl: value }))}
              />
            </Form.Item>
          )}
          <Form.Item label="工作节点" extra="将此项目分配给特定工作节点。">
            <Select
              placeholder="选择一个工作节点（可选）"
              allowClear
              value={draft.node || undefined}
              options={[NODE.name]}
              onChange={(value) => setDraft((current) => ({ ...current, node: value ? String(value) : '' }))}
            />
          </Form.Item>
          <Form.Item label="协作者" extra="选择可以访问此项目的用户。">
            <div className="member-box">
              <Checkbox
                checked={draft.members.includes('admin')}
                onChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    members: checked ? [...current.members, 'admin'] : current.members.filter((item) => item !== 'admin'),
                  }))
                }
              >
                admin
              </Checkbox>
              <Checkbox
                checked={draft.members.includes('demo')}
                onChange={(checked) =>
                  setDraft((current) => ({
                    ...current,
                    members: checked ? [...current.members, 'demo'] : current.members.filter((item) => item !== 'demo'),
                  }))
                }
              >
                demo
              </Checkbox>
            </div>
          </Form.Item>
          <Form.Item label="标签" extra="多个标签用逗号分隔">
            <Input value={draft.tags} placeholder="示例" onChange={(value) => setDraft((current) => ({ ...current, tags: value }))} />
          </Form.Item>
          {formError ? <p className="task-form-error">{formError}</p> : null}
        </Form>
      </Modal>

      <Modal
        title="删除项目"
        visible={pendingDelete !== null}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        onCancel={() => setPendingDelete(null)}
        onOk={() => {
          if (!pendingDelete) return
          setProjects((list) => list.filter((item) => item.id !== pendingDelete.id))
          onNotify(`已删除 ${pendingDelete.name}`)
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
