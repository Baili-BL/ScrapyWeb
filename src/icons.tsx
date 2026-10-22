import type { ReactNode } from 'react'

type IconProps = { size?: number }

function Svg({ size = 18, children }: { size?: number; children: ReactNode }) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      {children}
    </svg>
  )
}

export function IconApps({ size = 20 }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="3.5" width="7" height="7" rx="1.6" fill="currentColor" />
      <rect x="13.5" y="3.5" width="7" height="7" rx="1.6" fill="currentColor" />
      <rect x="3.5" y="13.5" width="7" height="7" rx="1.6" fill="currentColor" />
      <rect x="13.5" y="13.5" width="7" height="7" rx="1.6" fill="currentColor" />
    </Svg>
  )
}

/** 品牌图标：八爪蜘蛛 + 监控脉冲（雷达体）。 */
export function SpiderIcon({ size = 20 }: IconProps) {
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" fill="none" aria-hidden="true">
      <g stroke="currentColor" strokeWidth="1.7" strokeLinecap="round">
        {/* 八条腿（左右各四） */}
        <path d="M8.6 10.6C6.8 9.4 5.4 7.6 4.8 5.2" />
        <path d="M7.8 12.6C5.6 12 3.8 10.6 2.4 8.6" />
        <path d="M7.8 13.8C5.6 14.4 3.8 15.8 2.4 17.8" />
        <path d="M8.6 15.4C6.8 16.8 5.6 18.6 5 21" />
        <path d="M15.4 10.6C17.2 9.4 18.6 7.6 19.2 5.2" />
        <path d="M16.2 12.6C18.4 12 20.2 10.6 21.6 8.6" />
        <path d="M16.2 13.8C18.4 14.4 20.2 15.8 21.6 17.8" />
        <path d="M15.4 15.4C17.2 16.8 18.4 18.6 19 21" />
        {/* 蜘蛛躯体（雷达） */}
        <circle cx="12" cy="13" r="4.6" />
      </g>
      {/* 监控脉冲 */}
      <path
        d="M9.5 13.2h1.5l1-2l1.2 4l1-2h1.8"
        stroke="currentColor"
        strokeWidth="1.4"
        strokeLinecap="round"
        strokeLinejoin="round"
      />
      {/* 复眼 */}
      <circle cx="10.6" cy="10.9" r="0.8" fill="currentColor" />
      <circle cx="13.4" cy="10.9" r="0.8" fill="currentColor" />
    </svg>
  )
}

export function IconClock({ size }: IconProps) {
  return (
    <Svg size={size}>
      <circle cx="12" cy="12" r="8" stroke="currentColor" strokeWidth="1.8" />
      <path d="M12 8v4.5l3 2" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconPlay({ size = 20 }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8.5 6.8v10.4L18 12 8.5 6.8z" fill="currentColor" />
    </Svg>
  )
}

export function IconPause({ size = 20 }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="7" y="6" width="3.2" height="12" rx="1" fill="currentColor" />
      <rect x="13.8" y="6" width="3.2" height="12" rx="1" fill="currentColor" />
    </Svg>
  )
}

export function IconBars({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M5 19V10M10 19V6M15 19v-6M20 19V8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
    </Svg>
  )
}

export function IconPulse({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3 12h3.2l2.2-5 3.4 10 2.3-5H21" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconCpu({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="7" y="7" width="10" height="10" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M9 4v3M12 4v3M15 4v3M9 17v3M12 17v3M15 17v3M4 9h3M4 12h3M4 15h3M17 9h3M17 12h3M17 15h3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  )
}

export function IconList({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M8 7h11M8 12h11M8 17h11" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" />
      <circle cx="4.5" cy="7" r="1" fill="currentColor" />
      <circle cx="4.5" cy="12" r="1" fill="currentColor" />
      <circle cx="4.5" cy="17" r="1" fill="currentColor" />
    </Svg>
  )
}

export function IconFolder({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M3.5 8.5V7.2A1.7 1.7 0 0 1 5.2 5.5h3.2l1.6 1.8h8.8A1.7 1.7 0 0 1 20.5 9v7.3a1.7 1.7 0 0 1-1.7 1.7H5.2a1.7 1.7 0 0 1-1.7-1.7V8.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconLayers({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M12 4.5 20 8.5 12 12.5 4 8.5 12 4.5z" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" />
      <path d="M4 12.2 12 16.2 20 12.2M4 15.6 12 19.6 20 15.6" stroke="currentColor" strokeWidth="1.7" strokeLinejoin="round" strokeLinecap="round" />
    </Svg>
  )
}

export function IconTrend({ size }: IconProps) {
  return (
    <Svg size={size}>
      <path d="M4 16.5 9 11l3 3 8-8" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
      <path d="M14 6h6v6" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
    </Svg>
  )
}

export function IconDesktop({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="4.5" width="17" height="11.5" rx="1.8" stroke="currentColor" strokeWidth="1.7" />
      <path d="M8 19.5h8M12 16v3.5" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  )
}

export function IconDisk({ size }: IconProps) {
  return (
    <Svg size={size}>
      <rect x="3.5" y="5" width="17" height="14" rx="2" stroke="currentColor" strokeWidth="1.7" />
      <circle cx="12" cy="12" r="2.2" stroke="currentColor" strokeWidth="1.7" />
      <path d="M7 5.5v2.2M7 16.3V19" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" />
    </Svg>
  )
}
