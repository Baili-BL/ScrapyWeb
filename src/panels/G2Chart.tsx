import { Chart } from '@antv/g2'
import { useEffect, useRef } from 'react'

/**
 * 通用 G2 图表容器：负责实例化、自适应尺寸与销毁。
 * render 回调引用变化时整体重建图表，StrictMode 双挂载也安全。
 */
export function G2Chart({
  render,
  className,
  ariaLabel,
}: {
  render: (chart: Chart) => void
  className?: string
  ariaLabel?: string
}) {
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    const el = ref.current
    if (!el) return
    const chart = new Chart({ container: el, autoFit: true })
    render(chart)
    chart.render().catch(() => {})
    return () => {
      chart.destroy()
    }
  }, [render])

  return <div ref={ref} className={className} role="img" aria-label={ariaLabel} />
}
