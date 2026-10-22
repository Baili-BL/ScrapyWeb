import { Alert, Button, Form, Input, Modal, Select, Switch, Table, Tag } from '@arco-design/web-react'
import type { ColumnProps } from '@arco-design/web-react/es/Table'
import { useEffect, useState } from 'react'
import type { BotItem, BotType } from '../api.ts'
import { createBot, deleteBot, fetchBots, testBot, updateBot } from '../api.ts'

const TYPE_LABEL: Record<BotType, string> = { wecom: '企业微信', feishu: '飞书' }
const TYPE_COLOR: Record<BotType, string> = { wecom: 'green', feishu: 'blue' }
const WEBHOOK_PLACEHOLDER: Record<BotType, string> = {
  wecom: 'https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxxxxxxx-xxxx-xxxx',
  feishu: 'https://open.feishu.cn/open-apis/bot/v2/hook/xxxxxxxx-xxxx-xxxx',
}
const WEBHOOK_PATTERN: Record<BotType, RegExp> = {
  wecom: /^https:\/\/qyapi\.weixin\.qq\.com\/cgi-bin\/webhook\/send\?key=/,
  feishu: /^https:\/\/open\.feishu\.cn\/open-apis\/bot\/v2\/hook\//,
}

type BotDraft = {
  type: BotType
  name: string
  webhookUrl: string
  onlyFailed: boolean
}

const EMPTY_DRAFT: BotDraft = { type: 'wecom', name: '', webhookUrl: '', onlyFailed: false }

export function BotConfig({ onNotify }: { onNotify: (text: string) => void }) {
  const [bots, setBots] = useState<BotItem[]>([])
  const [loading, setLoading] = useState(true)
  const [editor, setEditor] = useState<'create' | BotItem | null>(null)
  const [draft, setDraft] = useState<BotDraft>(EMPTY_DRAFT)
  const [formError, setFormError] = useState('')
  const [pendingDelete, setPendingDelete] = useState<BotItem | null>(null)
  const [testingId, setTestingId] = useState('')

  const loadBots = async () => {
    try {
      setBots(await fetchBots())
    } catch (error) {
      onNotify(`加载机器人配置失败：${(error as Error).message}`)
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    void loadBots()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const openCreate = () => {
    setDraft(EMPTY_DRAFT)
    setFormError('')
    setEditor('create')
  }

  const openEdit = (bot: BotItem) => {
    setDraft({ type: bot.type, name: bot.name, webhookUrl: bot.webhookUrl, onlyFailed: bot.onlyFailed })
    setFormError('')
    setEditor(bot)
  }

  const commitDraft = async () => {
    const name = draft.name.trim()
    const webhookUrl = draft.webhookUrl.trim()
    if (!name) {
      setFormError('请填写机器人名称')
      return
    }
    if (!WEBHOOK_PATTERN[draft.type].test(webhookUrl)) {
      setFormError(
        draft.type === 'wecom'
          ? '企业微信 webhook 需形如 https://qyapi.weixin.qq.com/cgi-bin/webhook/send?key=xxx'
          : '飞书 webhook 需形如 https://open.feishu.cn/open-apis/bot/v2/hook/xxx',
      )
      return
    }
    try {
      if (editor === 'create') {
        await createBot({ type: draft.type, name, webhookUrl, onlyFailed: draft.onlyFailed })
        onNotify(`已添加机器人 ${name}（${TYPE_LABEL[draft.type]}）`)
      } else if (editor) {
        await updateBot(editor.id, { name, webhookUrl, onlyFailed: draft.onlyFailed })
        onNotify(`已更新机器人 ${name}`)
      }
      setEditor(null)
      await loadBots()
    } catch (error) {
      setFormError((error as Error).message)
    }
  }

  const toggleEnabled = async (bot: BotItem, enabled: boolean) => {
    try {
      await updateBot(bot.id, { enabled })
      onNotify(`${bot.name} 已${enabled ? '启用' : '停用'}`)
      await loadBots()
    } catch (error) {
      onNotify(`操作失败：${(error as Error).message}`)
    }
  }

  const runTest = async (bot: BotItem) => {
    setTestingId(bot.id)
    try {
      const result = await testBot(bot.id)
      onNotify(result.ok ? `${bot.name} 测试消息已发送，请到群里查看` : `${bot.name} 测试失败：${result.message}`)
    } catch (error) {
      onNotify(`${bot.name} 测试失败：${(error as Error).message}`)
    } finally {
      setTestingId('')
    }
  }

  const removeBot = async (bot: BotItem) => {
    try {
      await deleteBot(bot.id)
      onNotify(`已删除 ${bot.name}`)
      await loadBots()
    } catch (error) {
      onNotify(`删除失败：${(error as Error).message}`)
    }
  }

  const columns: ColumnProps<BotItem>[] = [
    {
      title: '类型',
      dataIndex: 'type',
      width: 110,
      render: (value: BotType) => <Tag color={TYPE_COLOR[value]}>{TYPE_LABEL[value]}</Tag>,
    },
    { title: '名称', dataIndex: 'name', width: 150 },
    {
      title: 'Webhook',
      dataIndex: 'webhookUrl',
      ellipsis: true,
      render: (value: string) => (
        <span style={{ fontFamily: 'monospace', fontSize: 12, color: '#4e5969' }}>{value}</span>
      ),
    },
    {
      title: '通知策略',
      dataIndex: 'onlyFailed',
      width: 110,
      render: (value: boolean) => (value ? <Tag color="orange">仅失败告警</Tag> : <Tag>全部通知</Tag>),
    },
    {
      title: '启用',
      dataIndex: 'enabled',
      width: 80,
      render: (value: boolean, record) => (
        <Switch size="small" checked={value} onChange={(checked) => void toggleEnabled(record, checked)} />
      ),
    },
    {
      title: '操作',
      width: 220,
      render: (_, record) => (
        <div style={{ display: 'flex', gap: 8 }}>
          <Button size="mini" type="primary" loading={testingId === record.id} onClick={() => void runTest(record)}>
            测试
          </Button>
          <Button size="mini" onClick={() => openEdit(record)}>
            编辑
          </Button>
          <Button size="mini" status="danger" onClick={() => setPendingDelete(record)}>
            删除
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
            <h1>机器人配置</h1>
            <p>把爬虫运行通知推送到企业微信群或飞书群（配置持久化在 data/bots.json）</p>
          </div>
          <Button type="primary" onClick={openCreate}>
            新增机器人
          </Button>
        </header>

        <section className="panel">
          <Alert
            style={{ marginBottom: 16 }}
            type="info"
            content="爬虫每次运行结束后，会向所有「启用中」的机器人推送运行结果；开启「仅失败告警」则只推送失败通知。点击「测试」会向群里发送一条真实消息。"
          />
          <Table
            rowKey="id"
            columns={columns}
            data={bots}
            loading={loading}
            pagination={false}
            border={false}
            noDataElement="还没有配置机器人，点击右上角「新增机器人」"
          />
        </section>
      </div>

      <DrawerLikeModal
        editor={editor}
        draft={draft}
        formError={formError}
        onCancel={() => setEditor(null)}
        onOk={() => void commitDraft()}
        onChange={setDraft}
      />

      <Modal
        title="删除机器人"
        visible={pendingDelete !== null}
        okText="删除"
        cancelText="取消"
        okButtonProps={{ status: 'danger' }}
        onCancel={() => setPendingDelete(null)}
        onOk={() => {
          if (pendingDelete) void removeBot(pendingDelete)
          setPendingDelete(null)
        }}
      >
        <p>确定删除 {pendingDelete?.name}？此后将不再向该 webhook 推送运行通知。</p>
      </Modal>
    </div>
  )
}

function DrawerLikeModal({
  editor,
  draft,
  formError,
  onCancel,
  onOk,
  onChange,
}: {
  editor: 'create' | BotItem | null
  draft: BotDraft
  formError: string
  onCancel: () => void
  onOk: () => void
  onChange: (draft: BotDraft) => void
}) {
  return (
    <Modal
      title={editor === 'create' ? '新增机器人' : '编辑机器人'}
      visible={editor !== null}
      okText={editor === 'create' ? '添加' : '保存'}
      cancelText="取消"
      unmountOnExit
      onCancel={onCancel}
      onOk={onOk}
    >
      <Form layout="vertical">
        <Form.Item label="类型" required>
          <Select
            value={draft.type}
            disabled={editor !== 'create'}
            options={[
              { value: 'wecom', label: '企业微信（群机器人）' },
              { value: 'feishu', label: '飞书（自定义机器人）' },
            ]}
            onChange={(value) => onChange({ ...draft, type: value as BotType })}
          />
        </Form.Item>
        <Form.Item label="名称" required>
          <Input
            value={draft.name}
            placeholder="例如：爬虫告警群"
            onChange={(value) => onChange({ ...draft, name: value })}
          />
        </Form.Item>
        <Form.Item label="Webhook 地址" required>
          <Input
            value={draft.webhookUrl}
            placeholder={WEBHOOK_PLACEHOLDER[draft.type]}
            onChange={(value) => onChange({ ...draft, webhookUrl: value })}
          />
        </Form.Item>
        <Form.Item label="通知策略" extra="开启后只在爬虫运行失败时推送">
          <Switch checked={draft.onlyFailed} onChange={(checked) => onChange({ ...draft, onlyFailed: checked })} />
        </Form.Item>
        {formError ? <Alert type="error" content={formError} /> : null}
      </Form>
    </Modal>
  )
}
