import { Component } from 'react'
import type { ReactNode, ErrorInfo } from 'react'

type Props = { children: ReactNode }
type State = { error: Error | null }

/** 渲染期异常兜底：避免整页白屏，给出可见的错误信息与自救按钮。 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    console.error('[ScrapyWeb] 渲染异常:', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      return (
        <div
          style={{
            minHeight: '100vh',
            display: 'grid',
            placeItems: 'center',
            background: 'linear-gradient(135deg, #f7f8fc 0%, #eef0f7 100%)',
            fontFamily: 'system-ui, -apple-system, "Segoe UI", "PingFang SC", "Microsoft YaHei", sans-serif',
            padding: 24,
          }}
        >
          <div
            style={{
              width: 560,
              maxWidth: '100%',
              background: '#fff',
              borderRadius: 16,
              padding: 28,
              boxShadow: '0 18px 50px rgba(29,33,41,.12)',
            }}
          >
            <h1 style={{ margin: '0 0 8px', fontSize: 18, color: '#f53f3f' }}>页面渲染出错</h1>
            <p style={{ margin: '0 0 14px', color: '#4e5969', fontSize: 13, lineHeight: 1.6, wordBreak: 'break-all' }}>
              {this.state.error.message}
            </p>
            <div style={{ display: 'flex', gap: 10 }}>
              <button
                type="button"
                onClick={() => window.location.reload()}
                style={{
                  height: 34,
                  padding: '0 16px',
                  borderRadius: 6,
                  border: '1px solid rgb(70,66,230)',
                  background: 'rgb(86,82,255)',
                  color: '#fff',
                  cursor: 'pointer',
                }}
              >
                刷新页面
              </button>
              <button
                type="button"
                onClick={() => {
                  localStorage.removeItem('scrapyweb-auth')
                  localStorage.removeItem('scrapyweb-auth-token')
                  window.location.reload()
                }}
                style={{
                  height: 34,
                  padding: '0 16px',
                  borderRadius: 6,
                  border: '1px solid #e5e6eb',
                  background: '#fff',
                  color: '#4e5969',
                  cursor: 'pointer',
                }}
              >
                清除本地登录数据并刷新
              </button>
            </div>
          </div>
        </div>
      )
    }
    return this.props.children
  }
}
