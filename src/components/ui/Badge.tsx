import type { ReactNode } from 'react'
import styles from './Badge.module.css'

export type Tone = 'neutral' | 'accent' | 'info' | 'success' | 'warning' | 'danger' | 'entity'

interface BadgeProps {
  tone?: Tone
  icon?: ReactNode
  children: ReactNode
  title?: string
}

export function Badge({ tone = 'neutral', icon, children, title }: BadgeProps) {
  return (
    <span className={`${styles.badge} ${styles[tone]}`} title={title}>
      {icon}
      {children}
    </span>
  )
}
