import { useId, useRef, type KeyboardEvent, type ReactNode } from 'react'
import styles from './Tabs.module.css'

export interface TabItem<Id extends string> {
  id: Id
  label: string
  icon?: ReactNode
  count?: number
  content: ReactNode
}

interface TabsProps<Id extends string> {
  label: string
  items: readonly TabItem<Id>[]
  value: Id
  onChange: (id: Id) => void
}

/** Pestañas WAI-ARIA con activación automática (flechas, Inicio, Fin). */
export function Tabs<Id extends string>({ label, items, value, onChange }: TabsProps<Id>) {
  const baseId = useId()
  const tabRefs = useRef(new Map<Id, HTMLButtonElement>())
  const active = items.find((item) => item.id === value) ?? items[0]

  function focusTab(index: number) {
    const item = items[(index + items.length) % items.length]
    onChange(item.id)
    tabRefs.current.get(item.id)?.focus()
  }

  function onKeyDown(event: KeyboardEvent<HTMLDivElement>) {
    const current = items.findIndex((item) => item.id === active.id)
    const moves: Record<string, number> = {
      ArrowRight: current + 1,
      ArrowLeft: current - 1,
      Home: 0,
      End: items.length - 1,
    }
    if (!(event.key in moves)) return
    event.preventDefault()
    focusTab(moves[event.key])
  }

  return (
    <div className={styles.tabs}>
      <div role="tablist" aria-label={label} className={styles.list} onKeyDown={onKeyDown}>
        {items.map((item) => {
          const selected = item.id === active.id
          return (
            <button
              key={item.id}
              ref={(node) => {
                if (node) tabRefs.current.set(item.id, node)
                else tabRefs.current.delete(item.id)
              }}
              type="button"
              role="tab"
              id={`${baseId}-tab-${item.id}`}
              aria-selected={selected}
              aria-controls={`${baseId}-panel-${item.id}`}
              tabIndex={selected ? 0 : -1}
              className={styles.tab}
              onClick={() => onChange(item.id)}
            >
              {item.icon}
              {item.label}
              {item.count !== undefined && (
                <>
                  <span className="sr-only">: </span>
                  <span className={styles.count}>{item.count}</span>
                </>
              )}
            </button>
          )
        })}
      </div>
      <div
        role="tabpanel"
        id={`${baseId}-panel-${active.id}`}
        aria-labelledby={`${baseId}-tab-${active.id}`}
        className={styles.panel}
      >
        {active.content}
      </div>
    </div>
  )
}
