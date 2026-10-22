import { Alert, Button, Form, Input, Select, Switch } from '@arco-design/web-react'
import { useEffect, useState } from 'react'
import type { AiConfigView, AiProvider } from '../api.ts'
import { AI_PROVIDER_PRESETS, fetchAiConfig, saveAiConfig, testAi } from '../api.ts'

type Draft = {
  provider: AiProvider
  baseUrl: string
  model: string
  apiKey: string
  enabled: boolean
  temperature: number
}

export function AiConfigPage({ onNotify }: { onNotify: (text: string) => void }) {
  const [view, setView] = useState<AiConfigView | null>(null)
  const [draft, setDraft] = useState<Draft>({
    provider: 'deepseek',
    baseUrl: AI_PROVIDER_PRESETS.deepseek.baseUrl,
    model: AI_PROVIDER_PRESETS.deepseek.models[0],
    apiKey: '',
    enabled: false,
    temperature: 0.3,
  })
  const [formError, setFormError] = useState('')
  const [saveBusy, setSaveBusy] = useState(false)
  const [testBusy, setTestBusy] = useState(false)
  const [testResult, setTestResult] = useState<{ ok: boolean; text: string } | null>(null)

  useEffect(() => {
    fetchAiConfig()
      .then((config) => {
        setView(config)
        setDraft({
          provider: config.provider,
          baseUrl: config.baseUrl,
          model: config.model,
          apiKey: '',
          enabled: config.enabled,
          temperature: config.temperature,
        })
      })
      .catch((err: Error) => setFormError(err.message))
  }, [])

  const providerOptions = Object.entries(AI_PROVIDER_PRESETS).map(([value, preset]) => ({ value: value as AiProvider, label: preset.label }))
  const modelOptions = (AI_PROVIDER_PRESETS[draft.provider]?.models ?? []).map((model) => ({ value: model, label: model }))

  const changeProvider = (provider: AiProvider) => {
    const preset = AI_PROVIDER_PRESETS[provider]
    setDraft((current) => ({
      ...current,
      provider,
      baseUrl: preset.baseUrl || current.baseUrl,
      model: preset.models[0] ?? '',
    }))
  }

  const commitSave = async () => {
    if (!draft.model.trim()) {
      setFormError('请选择或填写模型')
      return
    }
    if (!draft.baseUrl.trim()) {
      setFormError('请填写接口地址（Base URL）')
      return
    }
    if (!view?.hasKey && !draft.apiKey.trim()) {
      setFormError('请填写 API Key')
      return
    }
    setSaveBusy(true)
    setFormError('')
    try {
      const saved = await saveAiConfig({
        provider: draft.provider,
        baseUrl: draft.baseUrl.trim(),
        model: draft.model.trim(),
        apiKey: draft.apiKey.trim() || undefined,
        enabled: draft.enabled,
        temperature: draft.temperature,
      })
      setView(saved)
      setDraft((current) => ({ ...current, apiKey: '' }))
      onNotify('AI 配置已保存到服务器')
    } catch (err) {
      setFormError((err as Error).message)
    } finally {
      setSaveBusy(false)
    }
  }

  const runTest = async () => {
    setTestBusy(true)
    setTestResult(null)
    try {
      const result = await testAi()
      setTestResult({
        ok: result.ok,
        text: result.ok ? `连接成功（${result.latencyMs}ms）：${result.reply}` : `连接失败：${result.message}`,
      })
    } catch (err) {
      setTestResult({ ok: false, text: (err as Error).message })
    } finally {
      setTestBusy(false)
    }
  }

  return (
    <div className="page">
      <div className="page-inner">
        <header className="page-header">
          <div className="brand-text">
            <h1>AI 配置</h1>
            <p>选择模型供应商并填写 API Key（配置持久化在 data/ai-config.json，Key 回显打码）</p>
          </div>
        </header>

        <section className="panel ai-config-panel">
          {view?.hasKey ? (
            <Alert
              style={{ marginBottom: 16 }}
              type="info"
              content={`已保存 API Key：${view.apiKeyMasked}（留空表示不修改）· 最近更新：${view.updatedAt ? new Date(view.updatedAt).toLocaleString('zh-CN') : '—'}`}
            />
          ) : null}
          <Form layout="vertical">
            <div className="ai-config-grid">
              <Form.Item label="模型供应商" required>
                <Select value={draft.provider} options={providerOptions} onChange={(value) => changeProvider(value as AiProvider)} />
              </Form.Item>
              <Form.Item label="模型" required>
                {draft.provider === 'custom' ? (
                  <Input value={draft.model} placeholder="填写模型名，如 my-model" onChange={(value) => setDraft((current) => ({ ...current, model: value }))} />
                ) : (
                  <Select
                    value={draft.model || undefined}
                    placeholder="选择模型"
                    options={modelOptions}
                    allowCreate
                    onChange={(value) => setDraft((current) => ({ ...current, model: String(value) }))}
                  />
                )}
              </Form.Item>
            </div>
            <Form.Item label="接口地址（Base URL，OpenAI 兼容）" required>
              <Input value={draft.baseUrl} placeholder="https://api.deepseek.com/v1" onChange={(value) => setDraft((current) => ({ ...current, baseUrl: value }))} />
            </Form.Item>
            <Form.Item label="API Key" required={!(view?.hasKey ?? false)}>
              <Input.Password
                value={draft.apiKey}
                placeholder={view?.hasKey ? `已保存：${view.apiKeyMasked}（留空表示不修改）` : 'sk-...'}
                onChange={(value) => setDraft((current) => ({ ...current, apiKey: value }))}
              />
            </Form.Item>
            <div className="ai-config-row">
              <Form.Item label="启用 AI 助手">
                <Switch checked={draft.enabled} onChange={(checked) => setDraft((current) => ({ ...current, enabled: checked }))} />
              </Form.Item>
              <Form.Item label="温度（0-2）">
                <Input
                  style={{ width: 110 }}
                  value={String(draft.temperature)}
                  onChange={(value) => setDraft((current) => ({ ...current, temperature: Number(value) || 0 }))}
                />
              </Form.Item>
            </div>
            {formError ? <Alert style={{ marginBottom: 12 }} type="error" content={formError} /> : null}
            {testResult ? <Alert style={{ marginBottom: 12 }} type={testResult.ok ? 'success' : 'error'} content={testResult.text} /> : null}
            <div style={{ display: 'flex', gap: 10 }}>
              <Button type="primary" loading={saveBusy} onClick={() => void commitSave()}>
                保存配置
              </Button>
              <Button loading={testBusy} onClick={() => void runTest()}>
                测试连接（真实调用一次）
              </Button>
            </div>
          </Form>
        </section>
      </div>
    </div>
  )
}
