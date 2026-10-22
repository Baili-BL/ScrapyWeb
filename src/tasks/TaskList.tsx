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
import { useEffect, useMemo, useState } from 'react'
import type { RunRecord, TaskItem } from '../api.ts'
import { createTask, deleteTask, fetchRuns, fetchTasks, pollRun, runTask as apiRunTask, updateTask } from '../api.ts'
import { NODE } from '../data.ts'
import { EMPTY_DRAFT, dayKey, describeCron, formatDateTime, nextRunFromCron } from './model.ts'
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

const TODAY = dayKey(new Date())
const TOMORROW_DATE = new Date()
TOMORROW_DATE.setDate(TOMORROW_DATE.getDate() + 1)
const TOMORROW = dayKey(TOMORROW_DATE)

/** 把后端任务记录补上客户端计算的调度信息。 */
function withDerived(task: TaskItem): SpiderTask {
  return {
    ...task,
    nextRun: task.status === 'active' ? nextRunFromCron(task.cron) : null,
    lastRun: task.lastRun ? formatDateTime(new Date(task.lastRun)) : null,
    running: false,
  }
}

function statusLabel(status: SpiderTask['status']): string {
  return status === 'active' ? '活跃' : '已暂停'
}

/* ------------------------- 标签自动颜色 ------------------------- */

const TAG_PALETTE = ['#165dff', '#00b42a', '#ff7d00', '#f53f3f', '#722ed1', '#14c9c9', '#f7ba1e', '#f77eb9', '#3491fa', '#a871e3']

function hashTag(tag: string): number {
  let hash = 0
  for (let index = 0; index < tag.length; index += 1) {
    hash = Math.imul(hash, 31) + tag.charCodeAt(index)
  }
  return hash >>> 0
}

/** 标签颜色：优先 localStorage 手动覆盖，否则按标签名哈希自动分配（同名标签恒定同色）。 */
function tagColor(tag: string): string {
  if (tag) {
    const override = window.localStorage.getItem(`scrapyweb-tag-color:${tag}`)
    if (override) return override
  }
  return TAG_PALETTE[hashTag(tag) % TAG_PALETTE.length]
}

function tagPillStyle(tag: string): React.CSSProperties {
  const color = tagColor(tag)
  return { background: `${color}1a`, color, borderColor: `${color}59` }
}

function pickTagColor(tag: string, color: string): void {
  if (!tag) return
  window.localStorage.setItem(`scrapyweb-tag-color:${tag}`, color)
}

export function TaskList({ onNotify }: { onNotify: (text: string) => void }) {
  const [tasks, setTasks] = useState<SpiderTask[]>([])
  const [loading, setLoading] = useState(true)
  const [filters, setFilters] = useState<TaskFilters>(INITIAL_FILTERS)
  const [selected, setSelected] = useState<string[]>([])
  const [editor, setEditor] = useState<'create' | SpiderTask | null>(null)
  const [draft, setDraft] = useState<TaskDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [showNext, setShowNext] = useState(false)
  const [pendingDelete, setPendingDelete] = useState<SpiderTask | null>(null)
  const [historyTask, setHistoryTask] = useState<SpiderTask | null>(null)
  const [historyRuns, setHistoryRuns] = useState<RunRecord[] | null>(null)
  const [tagTask, setTagTask] = useState<SpiderTask | null>(null)
  const [tagDraft, setTagDraft] = useState('')
  const [, bumpTagColors] = useState(0)

  const loadTasks = async () => {
    try {
      const list = await fetchTasks()
      setTasks(list.map(withDerived))
    } catch (error) {
      onNotify(`加载任务失败：${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadTasks()
  }, [])

  const projectOptions = useMemo(() => {
    const names = new Set<string>(tasks.map((item) => item.project))
    return [...names]
  }, [tasks])

  const envOptions = useMemo(() => {
    const names = new Set<string>(tasks.map((item) => item.env))
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

  const commitDraft = async () => {
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
    try {
      if (editor === 'create') {
        await createTask({
          name,
          description: draft.description.trim(),
          spider: draft.project,
          project: draft.project,
          env: draft.env,
          node: draft.node,
          command,
          cron,
          concurrent: draft.concurrent,
          tags: [],
        })
        onNotify('已创建任务并保存到服务器')
      } else {
        await updateTask(editor.id, {
          name,
          description: draft.description.trim(),
          project: draft.project,
          env: draft.env,
          node: draft.node,
          command,
          cron,
          concurrent: editor.concurrent,
        })
        onNotify('已更新任务配置')
      }
      await loadTasks()
      setEditor(null)
    } catch (error) {
      setFormError((error as Error).message)
    }
  }

  const toggleStatus = async (task: SpiderTask) => {
    const nextStatus = task.status === 'active' ? 'paused' : 'active'
    try {
      await updateTask(task.id, { status: nextStatus })
      onNotify(nextStatus === 'paused' ? `已暂停 ${task.name}` : `已恢复 ${task.name}`)
      await loadTasks()
    } catch (error) {
      onNotify(`操作失败：${(error as Error).message}`)
    }
  }

  const runTask = async (task: SpiderTask) => {
    if (task.running) return
    patch(task.id, (item) => ({ ...item, running: true }))
    onNotify(`已触发 ${task.name}，爬虫后台运行中…`)
    try {
      const started = await apiRunTask(task.id)
      const run = started.status === 'running' ? await pollRun(started.id) : started
      onNotify(
        run.status === 'success'
          ? `${task.name} 运行成功：${run.items ?? '?'} 条数据，耗时 ${run.durationSec ?? '?'}s`
          : `${task.name} 运行失败：${run.message ?? '未知错误'}`,
      )
    } catch (error) {
      onNotify(`${task.name} 运行失败：${(error as Error).message}`)
    } finally {
      patch(task.id, (item) => ({ ...item, running: false }))
      await loadTasks()
    }
  }

  const duplicate = async (task: SpiderTask) => {
    let name = `${task.name}_copy`
    let index = 2
    while (tasks.some((item) => item.name === name)) {
      name = `${task.name}_copy${index}`
      index += 1
    }
    try {
      await createTask({
        name,
        description: task.description,
        spider: task.spider,
        project: task.project,
        env: task.env,
        node: task.node,
        command: task.command,
        cron: task.cron,
        concurrent: task.concurrent,
        tags: [...task.tags],
      })
      onNotify(`已复制为 ${name}`)
      await loadTasks()
    } catch (error) {
      onNotify(`复制失败：${(error as Error).message}`)
    }
  }

  const removeTasks = async (ids: string[]) => {
    try {
      await Promise.all(ids.map((id) => deleteTask(id)))
      setSelected((list) => list.filter((id) => !ids.includes(id)))
      await loadTasks()
    } catch (error) {
      onNotify(`删除失败：${(error as Error).message}`)
    }
  }

  const addTag = async () => {
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
    try {
      await updateTask(tagTask.id, { tags: [...tagTask.tags, tag] })
      onNotify(`已为 ${tagTask.name} 添加标签 ${tag}`)
      setTagTask(null)
      setTagDraft('')
      setFormError('')
      await loadTasks()
    } catch (error) {
      setFormError((error as Error).message)
    }
  }

  const removeTag = async (task: SpiderTask, tag: string) => {
    try {
      await updateTask(task.id, { tags: task.tags.filter((value) => value !== tag) })
      if (filters.tag === tag) setFilters((current) => ({ ...current, tag: null }))
      await loadTasks()
    } catch (error) {
      onNotify(`移除标签失败：${(error as Error).message}`)
    }
  }

  const openHistory = (task: SpiderTask) => {
    setHistoryTask(task)
    setHistoryRuns(null)
    fetchRuns(task.spider || task.project, 20)
      .then((runs) => setHistoryRuns(runs))
      .catch((error) => {
        setHistoryRuns([])
        onNotify(`读取运行记录失败：${(error as Error).message}`)
      })
  }

  const historyRows = (): string[] => {
    if (historyRuns === null) return []
    return historyRuns.map(
      (run) =>
        `${formatDateTime(new Date(run.finishedAt ?? run.startedAt))} · ${run.status} · ${
          run.items ?? '—'
        } 条 · ${run.durationSec ?? '—'}s`,
    )
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
            options={[{ key: '__all', label: '全部标签' }, ...tagOptions.map((name) => ({ key: name, label: name, color: tagColor(name) }))]}
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

        {loading && tasks.length === 0 ? (
          <Empty className="task-empty" description="正在从服务器加载任务..." />
        ) : visible.length === 0 ? (
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
                        style={tagPillStyle(tag)}
                        title="点击移除该标签"
                        onClick={() => void removeTag(task, tag)}
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
                  <button type="button" className="task-icon-btn" aria-label={`${task.name} 执行记录`} onClick={() => openHistory(task)}>
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
            <Input value={draft.name} placeholder="eastmoney_stock" onChange={(value) => setDraft((current) => ({ ...current, name: value }))} />
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
        <p>确定删除 {pendingDelete?.name}？该任务将从服务器（data/tasks.json）中移除。</p>
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
        <div className="tag-color-preview">
          <span className="tag-color-label">自动颜色</span>
          <span className="task-pill" style={tagPillStyle(tagDraft.trim() || '标签')}>
            {tagDraft.trim() || '标签'}
          </span>
        </div>
        <div className="tag-color-row">
          {TAG_PALETTE.map((color) => (
            <button
              key={color}
              type="button"
              className={`tag-color-dot${tagColor(tagDraft.trim() || '标签') === color ? ' on' : ''}`}
              style={{ background: color }}
              aria-label={`使用颜色 ${color}`}
              onClick={() => {
                pickTagColor(tagDraft.trim(), color)
                bumpTagColors((value) => value + 1)
              }}
            />
          ))}
        </div>
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
        {historyTask && historyRuns !== null && historyRuns.length === 0 ? (
          <Empty description="还没有执行记录，点击「运行」触发一次爬虫" />
        ) : (
          <ul className="task-history">
            {historyTask
              ? historyRows().map((row, index) => <li key={`${row}-${index}`}>{row}</li>)
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
  options: { key: string; label: string; color?: string }[]
  onPick: (key: string) => void
}) {
  return (
    <Dropdown
      trigger="click"
      position="bl"
      droplist={
        <Menu onClickMenuItem={(key) => onPick(key)}>
          {options.map((item) => (
            <Menu.Item key={item.key}>
              {item.color ? <i className="menu-dot" style={{ background: item.color }} /> : null}
              {item.label}
            </Menu.Item>
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
