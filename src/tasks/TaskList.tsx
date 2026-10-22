import { Checkbox, Drawer, Dropdown, Empty, Form, Input, Menu, Modal, Select, Switch, Tooltip } from '@arco-design/web-react'
import {
  IconCalendar,
  IconCheckCircle,
  IconClockCircle,
  IconClose,
  IconCode,
  IconCopy,
  IconDelete,
  IconDesktop,
  IconEdit,
  IconFolder,
  IconHistory,
  IconInfoCircle,
  IconPause,
  IconPlayArrow,
  IconPlus,
  IconSearch,
  IconStorage,
  IconTag,
  IconThunderbolt,
} from '@arco-design/web-react/icon'
import type { ReactNode } from 'react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { DEMO_NOW, ENVS, NODE, PROJECTS, recentExecutions } from '../data.ts'
import { EMPTY_DRAFT, SEED_TASKS, dayKey, describeCron, formatDateTime, nextRunFromCron } from './model.ts'
import type { SpiderTask, TaskDraft } from './model.ts'

type ScheduleFilter = 'today' | 'tomorrow' | 'unscheduled' | null

type TaskFilters = {
  keyword: string
  node: string | null
  status: SpiderTask['status'] | null
  project: string | null
  env: string | null
  tag: string | null
  schedule: ScheduleFilter
  runningOnly: boolean
}

const INITIAL_FILTERS: TaskFilters = {
  keyword: '',
  node: NODE.name,
  status: null,
  project: null,
  env: null,
  tag: null,
  schedule: null,
  runningOnly: false,
}

const TODAY = dayKey(DEMO_NOW)
const TOMORROW_DATE = new Date(DEMO_NOW.getTime())
TOMORROW_DATE.setDate(TOMORROW_DATE.getDate() + 1)
const TOMORROW = dayKey(TOMORROW_DATE)

let taskSeq = 1

function nextTaskId(): string {
  taskSeq += 1
  return `task-${taskSeq}`
}

function statusLabel(status: SpiderTask['status']): string {
  return status === 'active' ? '活跃' : '已暂停'
}

export function TaskList({ onNotify }: { onNotify: (text: string) => void }) {
  const [tasks, setTasks] = useState<SpiderTask[]>(SEED_TASKS)
  const [filters, setFilters] = useState<TaskFilters>(INITIAL_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const [editor, setEditor] = useState<'create' | SpiderTask | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [showNext, setShowNext] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SpiderTask | null>(null)
  const [historyTask, setHistoryTask] = useState<SpiderTask | null>(null)
  const [extraRuns, setExtraRuns] = useState<Record<string, string[]>>({})
  const [tagTask, setTagTask] = useState<SpiderTask | null>(null)
  const [tagDraft, setTagDraft] = useState('')
  const timers = useRef<number[]>([])
  const runOffset = useRef(0)

  useEffect(() => {
    const pending = timers.current
    return () => {
      pending.forEach((id) => window.clearTimeout(id))
    }
  }, [])

  const projectOptions = useMemo(() => {
    const names = new Set<string>([...PROJECTS.map((item) => item.name), ...tasks.map((item) => item.project)])
    return [...names]
  }, [tasks])

  const envOptions = useMemo(() => {
    const names = new Set<string>([...ENVS.map((item) => item.name), ...tasks.map((item) => item.env)])
    return [...names]
  }, [tasks])

  const tagOptions = useMemo(() => {
    const names = new Set<string>()
    tasks.forEach((item) => item.tags.forEach((tag) => names.add(tag)))
    return [...names]
  }, [tasks])

  const visible = useMemo(() => {
    const keyword = filters.keyword.trim().toLowerCase()
    return tasks.filter((task) => {
      if (keyword) {
        const blob = `${task.name} ${task.command} ${task.project} ${task.cron}`.toLowerCase()
        if (!blob.includes(keyword)) return false
      }
      if (filters.node && task.node !== filters.node) return false
      if (filters.status && task.status !== filters.status) return false
      if (filters.project && task.project !== filters.project) return false
      if (filters.env && task.env !== filters.env) return false
      if (filters.tag && !task.tags.includes(filters.tag)) return false
      if (filters.runningOnly && !task.running) return false
      if (filters.schedule === 'unscheduled' && task.nextRun) return false
      if (filters.schedule === 'today' && !task.nextRun?.startsWith(TODAY)) return false
      if (filters.schedule === 'tomorrow' && !task.nextRun?.startsWith(TOMORROW)) return false
      return true
    })
  }, [filters, tasks])

  const patch = (id: string, recipe: (task: SpiderTask) => SpiderTask) => {
    setTasks((list) => list.map((item) => (item.id === id ? recipe(item) : item)))
  }

  const openCreate = () => {
    setDraft(EMPTY_DRAFT)
    setFormError('')
    setShowNext(false)
    setEditor('create')
  }

  const openEdit = (task: SpiderTask) => {
    setDraft({
      name: task.name,
      description: task.description,
      project: task.project,
      env: task.env,
      node: task.node,
      command: task.command,
      cron: task.cron,
      concurrent: task.concurrent,
    })
    setFormError('')
    setShowNext(false)
    setEditor(task)
  }

  const commitDraft = () => {
    const name = draft.name.trim()
    const command = draft.command.trim()
    const cron = draft.cron.trim()
    if (!name) {
      setFormError('请填写任务名称')
      return
    }
    if (!command) {
      setFormError('请填写启动命令')
      return
    }
    const nextRun = nextRunFromCron(cron)
    if (!nextRun) {
      setFormError('Cron 需要 5 段：分 时 日 月 周。日和月请填 *，周填 * 或 MON–SUN')
      return
    }
    if (!editor) return
    const editingId = editor === 'create' ? null : editor.id
    const duplicated = tasks.some((item) => item.name === name && item.id !== editingId)
    if (duplicated) {
      setFormError('已有同名任务')
      return
    }
    if (editor === 'create') {
      const created: SpiderTask = {
        id: nextTaskId(),
        name,
        description: draft.description.trim(),
        project: draft.project,
        env: draft.env,
        node: draft.node,
        command,
        cron,
        concurrent: draft.concurrent,
        nextRun,
        lastRun: null,
        status: 'active',
        running: false,
        tags: [],
      }
      setTasks((list) => [created, ...list])
      onNotify('已创建任务，正在调度...')
    } else if (editor) {
      patch(editor.id, (task) => ({
        ...task,
        name,
        description: draft.description.trim(),
        project: draft.project,
        env: draft.env,
        node: draft.node,
        command,
        cron,
        concurrent: task.concurrent,
        nextRun: task.status === 'active' ? nextRun : null,
      }))
      onNotify('已更新任务，正在重新调度...')
    }
    setEditor(null)
  }

  const toggleStatus = (task: SpiderTask) => {
    if (task.status === 'active') {
      patch(task.id, (item) => ({ ...item, status: 'paused', running: false, nextRun: null }))
      onNotify(`已暂停 ${task.name}`)
      return
    }
    const nextRun = nextRunFromCron(task.cron)
    patch(task.id, (item) => ({ ...item, status: 'active', nextRun }))
    onNotify(nextRun ? `已恢复 ${task.name}` : `已恢复 ${task.name}，下次运行未能计算`)
  }

  const runTask = (task: SpiderTask) => {
    if (task.running) return
    const stamp = formatDateTime(new Date(DEMO_NOW.getTime() + runOffset.current * 1000))
    runOffset.current += 1
    patch(task.id, (item) => ({ ...item, running: true, lastRun: stamp }))
    setExtraRuns((current) => ({ ...current, [task.id]: [stamp, ...(current[task.id] ?? [])] }))
    onNotify(`已触发 ${task.name}`)
    const timer = window.setTimeout(() => {
      patch(task.id, (item) => ({ ...item, running: false }))
    }, 8000)
    timers.current.push(timer)
  }

  const duplicate = (task: SpiderTask) => {
    let name = `${task.name}_copy`
    let index = 2
    while (tasks.some((item) => item.name === name)) {
      name = `${task.name}_copy${index}`
      index += 1
    }
    const copy: SpiderTask = {
      ...task,
      id: nextTaskId(),
      name,
      running: false,
      lastRun: null,
      nextRun: task.status === 'active' ? nextRunFromCron(task.cron) : null,
      tags: [...task.tags],
    }
    setTasks((list) => [copy, ...list])
    onNotify(`已复制为 ${name}`)
  }

  const removeTasks = (ids: string[]) => {
    setTasks((list) => list.filter((item) => !ids.includes(item.id)))
    setSelected((list) => list.filter((id) => !ids.includes(id)))
  }

  const addTag = () => {
    const tag = tagDraft.trim()
    if (!tagTask) return
    if (!tag) {
      setFormError('请填写标签')
      return
    }
    if (tagTask.tags.includes(tag)) {
      setFormError('标签已存在')
      return
    }
    patch(tagTask.id, (item) => ({ ...item, tags: [...item.tags, tag] }))
    onNotify(`已为 ${tagTask.name} 添加标签 ${tag}`)
    setTagTask(null)
    setTagDraft('')
    setFormError('')
  }

  const historyRows = (task: SpiderTask) => {
    const fresh = extraRuns[task.id] ?? []
    const seeded =
      task.name === 'hourly_test1_runner'
        ? recentExecutions().map((item) => `${item.time} · ${item.duration}`)
        : task.lastRun
          ? [task.lastRun]
          : []
    return [...fresh, ...seeded]
  }

  const scheduleLabel =
    filters.schedule === 'today' ? '今天' : filters.schedule === 'tomorrow' ? '明天' : filters.schedule === 'unscheduled' ? '未调度' : null

  return (
    <div className="page task-page">
      <div className="page-inner">
        <header className="task-head">
          <div>
            <h1>任务管理</h1>
            <p>管理和监控您的任务</p>
          </div>
          <div className="task-head-actions">
            <button
              type="button"
              className="task-icon-btn"
              aria-label="搜索任务"
              onClick={() => document.getElementById('task-filter-keyword')?.focus()}
            >
              <IconSearch />
            </button>
            <button type="button" className="task-create" onClick={openCreate}>
              创建任务
              <IconPlus />
            </button>
          </div>
        </header>

        <div className="task-filters">
          <Input
            id="task-filter-keyword"
            className="task-search"
            allowClear
            placeholder="筛选任务..."
            value={filters.keyword}
            onChange={(value) => setFilters((current) => ({ ...current, keyword: value }))}
          />
          <FilterDrop
            label="节点"
            icon={<IconDesktop />}
            active={filters.node !== null}
            options={[
              { key: '__all', label: '全部节点' },
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
            label="状态"
            icon={<IconCheckCircle />}
            active={filters.status !== null}
            options={[
              { key: '__all', label: '全部状态' },
              { key: 'active', label: '活跃' },
              { key: 'paused', label: '已暂停' },
            ]}
            onPick={(key) =>
              setFilters((current) => ({
                ...current,
                status: key === '__all' ? null : (key as SpiderTask['status']),
              }))
            }
          />
          {filters.status ? (
            <button type="button" className="filter-chip" onClick={() => setFilters((current) => ({ ...current, status: null }))}>
              {statusLabel(filters.status)}
            </button>
          ) : null}
          <FilterDrop
            label="项目"
            icon={<IconFolder />}
            active={filters.project !== null}
            options={[{ key: '__all', label: '全部项目' }, ...projectOptions.map((name) => ({ key: name, label: name }))]}
            onPick={(key) => setFilters((current) => ({ ...current, project: key === '__all' ? null : key }))}
          />
          {filters.project ? (
            <button type="button" className="filter-chip" onClick={() => setFilters((current) => ({ ...current, project: null }))}>
              {filters.project}
            </button>
          ) : null}
          <FilterDrop
            label="环境"
            icon={<IconStorage />}
            active={filters.env !== null}
            options={[{ key: '__all', label: '全部环境' }, ...envOptions.map((name) => ({ key: name, label: name }))]}
            onPick={(key) => setFilters((current) => ({ ...current, env: key === '__all' ? null : key }))}
          />
          {filters.env ? (
            <button type="button" className="filter-chip" onClick={() => setFilters((current) => ({ ...current, env: null }))}>
              {filters.env}
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
          <FilterDrop
            label="计划时间"
            icon={<IconCalendar />}
            active={filters.schedule !== null}
            options={[
              { key: '__all', label: '全部时间' },
              { key: 'today', label: '今天' },
              { key: 'tomorrow', label: '明天' },
              { key: 'unscheduled', label: '未调度' },
            ]}
            onPick={(key) =>
              setFilters((current) => ({
                ...current,
                schedule: key === '__all' ? null : (key as Exclude<ScheduleFilter, null>),
              }))
            }
          />
          {scheduleLabel ? (
            <button type="button" className="filter-chip" onClick={() => setFilters((current) => ({ ...current, schedule: null }))}>
              {scheduleLabel}
            </button>
          ) : null}
          <button
            type="button"
            className={filters.runningOnly ? 'filter-btn on' : 'filter-btn'}
            onClick={() => setFilters((current) => ({ ...current, runningOnly: !current.runningOnly }))}
          >
            <IconPlayArrow />
            运行中
          </button>
          <button type="button" className="filter-reset" onClick={() => setFilters({ ...INITIAL_FILTERS, node: null })}>
            重置
            <IconClose />
          </button>
        </div>

        {selected.length > 0 ? (
          <div className="task-bulk">
            <span>已选 {selected.length} 个任务</span>
            <button
              type="button"
              className="task-text-btn"
              onClick={() => {
                selected.forEach((id) => {
                  const task = tasks.find((item) => item.id === id)
                  if (task?.status === 'active') toggleStatus(task)
                })
              }}
            >
              暂停所选
            </button>
            <button
              type="button"
              className="task-text-btn danger"
              onClick={() => {
                removeTasks(selected)
                onNotify(`已删除 ${selected.length} 个任务`)
              }}
            >
              删除所选
            </button>
            <button type="button" className="task-text-btn" onClick={() => setSelected([])}>
              取消选择
            </button>
          </div>
        ) : null}

        {visible.length === 0 ? (
          <Empty className="task-empty" description="没有匹配的任务" />
        ) : (
          <div className="task-list">
            {visible.map((task) => (
              <article key={task.id} className="task-card">
                <Checkbox
                  checked={selected.includes(task.id)}
                  onChange={(checked) =>
                    setSelected((list) => (checked ? [...list, task.id] : list.filter((id) => id !== task.id)))
                  }
                />
                <div className="task-main">
                  <div className="task-name">
                    <strong>{task.name}</strong>
                    <Tooltip
                      content={`节点 ${task.node} · 项目 ${task.project} · 环境 ${task.env}`}
                    >
                      <button type="button" className="task-info" aria-label={`${task.name} 详情`}>
                        <IconInfoCircle />
                      </button>
                    </Tooltip>
                    <span className={task.status === 'active' ? 'task-badge active' : 'task-badge paused'}>
                      <i />
                      {statusLabel(task.status)}
                    </span>
                    {task.running ? <span className="task-badge running">运行中</span> : null}
                  </div>
                  <div className="task-meta">
                    <span className="task-pill">
                      <IconFolder />
                      {task.project}
                    </span>
                    <span className="task-pill">
                      <IconStorage />
                      {task.env}
                    </span>
                    {task.tags.map((tag) => (
                      <button
                        key={tag}
                        type="button"
                        className="task-pill task-tag"
                        onClick={() => {
                          patch(task.id, (item) => ({ ...item, tags: item.tags.filter((value) => value !== tag) }))
                          if (filters.tag === tag) setFilters((current) => ({ ...current, tag: null }))
                        }}
                      >
                        {tag}
                      </button>
                    ))}
                    <button
                      type="button"
                      className="task-plus"
                      aria-label={`为 ${task.name} 添加标签`}
                      onClick={() => {
                        setTagTask(task)
                        setTagDraft('')
                        setFormError('')
                      }}
                    >
                      <IconPlus />
                    </button>
                  </div>
                  <div className="task-cmd">
                    <IconCode />
                    <span>{task.command}</span>
                  </div>
                </div>
                <div className="task-schedule">
                  <div className="task-kicker">
                    <IconCalendar />
                    调度
                  </div>
                  <div>Cron: {task.cron}</div>
                </div>
                <div className="task-times">
                  <div className="task-time-row">
                    <IconClockCircle />
                    <span>下次运行</span>
                    <strong>{task.nextRun ?? '未调度'}</strong>
                  </div>
                  <div className="task-time-row">
                    <IconClockCircle />
                    <span>上次运行</span>
                    <strong>{task.lastRun ?? '—'}</strong>
                  </div>
                </div>
                <div className="task-actions">
                  <button
                    type="button"
                    className={task.status === 'active' ? 'task-pause' : 'task-icon-btn'}
                    aria-label={task.status === 'active' ? `暂停 ${task.name}` : `恢复 ${task.name}`}
                    onClick={() => toggleStatus(task)}
                  >
                    {task.status === 'active' ? <IconPause /> : <IconPlayArrow />}
                  </button>
                  <button type="button" className="task-run" disabled={task.running} onClick={() => runTask(task)}>
                    <IconThunderbolt />
                    运行
                  </button>
                  <button type="button" className="task-icon-btn" aria-label={`${task.name} 执行记录`} onClick={() => setHistoryTask(task)}>
                    <IconHistory />
                  </button>
                  <button type="button" className="task-icon-btn" aria-label={`复制 ${task.name}`} onClick={() => duplicate(task)}>
                    <IconCopy />
                  </button>
                  <button type="button" className="task-icon-btn" aria-label={`编辑 ${task.name}`} onClick={() => openEdit(task)}>
                    <IconEdit />
                  </button>
                  <button type="button" className="task-icon-btn" aria-label={`删除 ${task.name}`} onClick={() => setPendingDelete(task)}>
                    <IconDelete />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <Drawer
        className="task-drawer"
        width={520}
        title={
          <div className="dialog-title">
            <strong>{editor === 'create' ? '创建任务' : '更新任务'}</strong>
            <p>{editor === 'create' ? '创建任务配置。' : '更新任务配置。'}</p>
          </div>
        }
        visible={editor !== null}
        okText={editor === 'create' ? '创建' : '保存'}
        cancelText="取消"
        unmountOnExit
        onCancel={() => setEditor(null)}
        onOk={commitDraft}
      >
        <Form layout="vertical">
          <Form.Item label="名称" required>
            <Input value={draft.name} placeholder="hourly_test1_runner" onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
          </Form.Item>
          <Form.Item label="描述">
            <Input value={draft.description} placeholder="每小时运行一次test1.py" onChange={(value) => setDraft((current) => ({ ...current, description: value }))} />
          </Form.Item>
          <Form.Item label="命令" required>
            <Input value={draft.command} placeholder="python src/test1.py" onChange={(value) => setDraft((current) => ({ ...current, command: value }))} />
          </Form.Item>
          <Form.Item label="触发类型">
            <Select value="cron" options={[{ value: 'cron', label: 'Cron' }]} />
          </Form.Item>
          <Form.Item label="Cron 表达式" required>
            <Input value={draft.cron} onChange={(value) => setDraft((current) => ({ ...current, cron: value }))} />
            <div className="cron-help">
              <p>格式: 分 时 日 月 周</p>
              <p>周字段（第5位）必须使用英文缩写: MON, TUE, WED, THU, FRI, SAT, SUN</p>
              {describeCron(draft.cron) ? <p className="cron-phrase">{describeCron(draft.cron)}</p> : null}
              <button type="button" className="cron-next" onClick={() => setShowNext((value) => !value)}>
                显示下次运行时间
              </button>
              {showNext ? <p>{nextRunFromCron(draft.cron) ?? '暂时无法计算下次运行时间'}</p> : null}
            </div>
          </Form.Item>
          <div className="form-split">
            <Form.Item label="工作节点">
              <Select value={draft.node} options={[NODE.name]} onChange={(value) => setDraft((current) => ({ ...current, node: String(value) }))} />
            </Form.Item>
            <Form.Item label="启用并发" extra="对于已有任务无法启动并发设置。请重新创建任务以进行修改。">
              <Switch
                checked={draft.concurrent}
                disabled={editor !== 'create'}
                onChange={(checked) => setDraft((current) => ({ ...current, concurrent: checked }))}
              />
            </Form.Item>
          </div>
          <div className="form-split">
            <Form.Item label="项目">
              <Select value={draft.project} options={projectOptions} onChange={(value) => setDraft((current) => ({ ...current, project: String(value) }))} />
            </Form.Item>
            <Form.Item label="环境">
              <Select value={draft.env} options={envOptions} onChange={(value) => setDraft((current) => ({ ...current, env: String(value) }))} />
            </Form.Item>
          </div>
          {formError ? <p className="task-form-error">{formError}</p> : null}
        </Form>
      </Drawer>

      <Modal
        title="删除任务"
        visible={pendingDelete !== null}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        onCancel={() => setPendingDelete(null)}
        onOk={() => {
          if (!pendingDelete) return
          removeTasks([pendingDelete.id])
          onNotify(`已删除 ${pendingDelete.name}`)
          setPendingDelete(null)
        }}
      >
        <p>确定删除 {pendingDelete?.name}？此操作只影响当前演示列表。</p>
      </Modal>

      <Modal
        title={tagTask ? `为 ${tagTask.name} 添加标签` : '添加标签'}
        visible={tagTask !== null}
        okText="添加"
        cancelText="取消"
        unmountOnExit
        onCancel={() => setTagTask(null)}
        onOk={addTag}
      >
        <Input value={tagDraft} placeholder="标签名称" onChange={setTagDraft} />
        {formError ? <p className="task-form-error">{formError}</p> : null}
      </Modal>

      <Drawer
        width={420}
        title={historyTask ? `${historyTask.name} 执行记录` : '执行记录'}
        visible={historyTask !== null}
        footer={null}
        unmountOnExit
        onCancel={() => setHistoryTask(null)}
      >
        {historyTask && historyRows(historyTask).length === 0 ? (
          <Empty description="还没有执行记录" />
        ) : (
          <ul className="task-history">
            {historyTask
              ? historyRows(historyTask).map((row, index) => (
                  <li key={`${row}-${index}`}>{row}</li>
                ))
              : null}
          </ul>
        )}
      </Drawer>
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
