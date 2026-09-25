import { CircleAlert, CircleCheck, Info, TriangleAlert, X } from 'lucide-react'
import type { ReactNode } from 'react'
import styles from './Alert.module.css'

type AlertTone = 'info' | 'success' | 'warning' | 'danger'

const ICONS: Record<AlertTone, ReactNode> = {
  info: <Info aria-hidden="true" />,
  success: <CircleCheck aria-hidden="true" />,
  warning: <TriangleAlert aria-hidden="true" />,
  danger: <CircleAlert aria-hidden="true" />,
}

interface AlertProps {
  tone: AlertTone
  title: ReactNode
  children?: ReactNode
  actions?: ReactNode
  onDismiss?: () => void
}

export function Alert({ tone, title, children, actions, onDismiss }: AlertProps) {
  // Los fallos se anuncian de inmediato; lo informativo, sin interrumpir al lector.
  const role = tone === 'danger' || tone === 'warning' ? 'alert' : 'status'
  return (
    <div className={`${styles.alert} ${styles[tone]}`} role={role}>
      <span className={styles.icon}>{ICONS[tone]}</span>
      <div className={styles.body}>
        <p className={styles.title}>{title}</p>
        {children && <div className={styles.text}>{children}</div>}
        {actions && <div className={styles.actions}>{actions}</div>}
      </div>
      {onDismiss && (
        <button type="button" className={styles.dismiss} onClick={onDismiss} aria-label="Descartar aviso">
          <X aria-hidden="true" />
        </button>
      )}
    </div>
  )
}
