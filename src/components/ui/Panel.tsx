import { useId, type ReactNode } from 'react'
import styles from './Panel.module.css'

interface PanelProps {
  title?: ReactNode
  icon?: ReactNode
  actions?: ReactNode
  children: ReactNode
  className?: string
}

export function Panel({ title, icon, actions, children, className }: PanelProps) {
  const headingId = useId()
  return (
    <section
      className={[styles.panel, className].filter(Boolean).join(' ')}
      aria-labelledby={title ? headingId : undefined}
    >
      {title && (
        <header className={styles.header}>
          <h2 id={headingId} className={styles.title}>
            {icon}
            {title}
          </h2>
          {actions && <div className={styles.actions}>{actions}</div>}
        </header>
      )}
      {children}
    </section>
  )
}
