import { Alert, Button, Input } from '@arco-design/web-react'
import { useEffect, useRef, useState } from 'react'
import type { AiChatMessage, AiConfigView } from '../api.ts'
import { chatAi, fetchAiConfig, fetchMe } from '../api.ts'

type ChatEntry = AiChatMessage & { latencyMs?: number }

export function AiAssistant({ onNotify }: { onNotify: (text: string) => void }) {
  const [config, setConfig] = useState<AiConfigView | null>(null)
  const [isReadonly, setIsReadonly] = useState(false)
  const [messages, setMessages] = useState<ChatEntry[]>([
    { role: 'assistant', content: '你好，我是 ScrapyWeb 的 AI 助手。可以问我任务失败原因、运行数据解读等问题。' },
  ])
  const [input, setInput] = useState('')
  const [busy, setBusy] = useState(false)
  const logRef = useRef<HTMLDivElement>(null)

  useEffect(() => {
    fetchAiConfig()
      .then(setConfig)
      .catch(() => setConfig(null))
    fetchMe()
      .then((user) => setIsReadonly(user.role === 'readonly'))
      .catch(() => setIsReadonly(false))
  }, [])

  useEffect(() => {
    logRef.current?.scrollTo({ top: logRef.current.scrollHeight })
  }, [messages])

  const send = async () => {
    const content = input.trim()
    if (!content || busy) return
    const userMessage: AiChatMessage = { role: 'user', content }
    const history: AiChatMessage[] = [...messages, userMessage].map((entry) => ({ role: entry.role, content: entry.content }))
    setMessages((list) => [...list, { role: 'user', content }])
    setInput('')
    setBusy(true)
    try {
      const result = await chatAi(history)
      setMessages((list) => [...list, { role: 'assistant', content: result.reply, latencyMs: result.latencyMs }])
    } catch (err) {
      setMessages((list) => [...list, { role: 'assistant', content: `⚠️ 调用失败：${(err as Error).message}` }])
      onNotify(`AI 调用失败：${(err as Error).message}`)
    } finally {
      setBusy(false)
    }
  }

  const notReady = config && (!config.hasKey || !config.enabled)

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="brand-text">
            <h1>AI 助手</h1>
            <p>
              {config
                ? `当前模型：${config.model}（${config.providerLabel}）${config.enabled ? '' : ' · 未启用'}`
                : '读取 AI 配置中…'}
            </p>
          </div>
        </header>

        <section className="panel ai-chat-panel">
          {isReadonly ? <Alert style={{ marginBottom: 12 }} type="warning" content="当前为只读账号，无法发送消息。" /> : null}
          {notReady ? (
            <Alert
              style={{ marginBottom: 12 }}
              type="warning"
              content="尚未配置模型或 API Key——请先到「AI 配置」选择模型、填写 Key 并启用。"
            />
          ) : null}
          <div className="ai-chat-log" ref={logRef}>
            {messages.map((entry, index) => (
              <div key={index} className={`ai-msg ${entry.role}`}>
                <span className="ai-msg-avatar">{entry.role === 'user' ? '我' : 'AI'}</span>
                <div className="ai-msg-bubble">
                  <p>{entry.content}</p>
                  {entry.latencyMs ? <em>{entry.latencyMs}ms</em> : null}
                </div>
              </div>
            ))}
            {busy ? <div className="ai-msg assistant"><span className="ai-msg-avatar">AI</span><div className="ai-msg-bubble"><p>思考中…</p></div></div> : null}
          </div>
          <div className="ai-chat-input">
            <Input
              placeholder={isReadonly ? '只读账号无法发送消息' : '输入问题，Enter 发送'}
              disabled={isReadonly || busy}
              value={input}
              onChange={setInput}
              onPressEnter={() => void send()}
            />
            <Button type="primary" disabled={isReadonly || busy || !input.trim()} loading={busy} onClick={() => void send()}>
              发送
            </Button>
          </div>
        </section>
      </div>
    </div>
  )
}
