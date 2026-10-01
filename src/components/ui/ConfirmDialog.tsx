import { CircleHelp, TriangleAlert } from 'lucide-react'
import { useEffect, useId, useRef, type ReactNode } from 'react'
import { createPortal } from 'react-dom'
import { Button } from './Button'
import styles from './ConfirmDialog.module.css'

const FOCUSABLE = 'button:not([disabled]), [href], input:not([disabled]), select, textarea, [tabindex]:not([tabindex="-1"])'

interface ConfirmDialogProps {
  open: boolean
  title: string
  children: ReactNode
  confirmLabel: string
  /** danger: acción irreversible (botón sólido rojo, ícono de advertencia). */
  tone?: 'danger' | 'neutral'
  /** Mientras la acción corre: botones deshabilitados y Esc no cierra. */
  busy?: boolean
  onConfirm: () => void
  onCancel: () => void
}

/**
 * Confirmación modal propia de la app (WAI-ARIA alertdialog), en lugar de window.confirm.
 * jsdom no implementa <dialog>.showModal(), así que el modal se resuelve a mano: portal,
 * foco inicial en Cancelar (lo seguro), foco atrapado dentro, Esc cancela y al cerrar el
 * foco vuelve a quien lo abrió.
 */
export function ConfirmDialog({
  open,
  title,
  children,
  confirmLabel,
  tone = 'danger',
  busy = false,
  onConfirm,
  onCancel,
}: ConfirmDialogProps) {
  const titleId = useId()
  const descriptionId = useId()
  const dialogRef = useRef<HTMLDivElement>(null)
  // Los handlers cambian en cada render del padre: se leen de una ref para no reiniciar
  // el efecto (que movería el foco a Cancelar en cada render).
  const latest = useRef({ busy, onCancel })
  useEffect(() => {
    latest.current = { busy, onCancel }
  })

  useEffect(() => {
    if (!open) return
    const previous = document.activeElement as HTMLElement | null
    dialogRef.current?.querySelector<HTMLElement>('[data-autofocus]')?.focus()

    function onKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        event.preventDefault()
        if (!latest.current.busy) latest.current.onCancel()
        return
      }
      if (event.key !== 'Tab' || !dialogRef.current) return
      const focusables = [...dialogRef.current.querySelectorAll<HTMLElement>(FOCUSABLE)]
      if (focusables.length === 0) return
      const first = focusables[0]
      const last = focusables[focusables.length - 1]
      const inside = dialogRef.current.contains(document.activeElement)
      if (event.shiftKey && (document.activeElement === first || !inside)) {
        event.preventDefault()
        last.focus()
      } else if (!event.shiftKey && (document.activeElement === last || !inside)) {
        event.preventDefault()
        first.focus()
      }
    }

    document.addEventListener('keydown', onKeyDown)
    return () => {
      document.removeEventListener('keydown', onKeyDown)
      previous?.focus()
    }
  }, [open])

  if (!open) return null

  return createPortal(
    <div
      className={styles.backdrop}
      onMouseDown={(event) => {
        if (event.target === event.currentTarget && !busy) onCancel()
      }}
    >
      <div
        ref={dialogRef}
        className={`${styles.dialog} ${styles[tone]}`}
        role="alertdialog"
        aria-modal="true"
        aria-labelledby={titleId}
        aria-describedby={descriptionId}
      >
        <div className={styles.header}>
          <span className={styles.icon} aria-hidden="true">
            {tone === 'danger' ? <TriangleAlert /> : <CircleHelp />}
          </span>
          <h2 id={titleId} className={styles.title}>
            {title}
          </h2>
        </div>
        <div id={descriptionId} className={styles.body}>
          {children}
        </div>
        <div className={styles.actions}>
          <Button variant="secondary" onClick={onCancel} disabled={busy} data-autofocus>
            Cancelar
          </Button>
          <Button variant={tone === 'danger' ? 'destructive' : 'primary'} loading={busy} onClick={onConfirm}>
            {confirmLabel}
          </Button>
        </div>
      </div>
    </div>,
    document.body,
  )
}
