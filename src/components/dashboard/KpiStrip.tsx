import { CircleCheck, Clock, Crosshair, Radar, ShieldAlert } from 'lucide-react'
import type { CSSProperties, ReactNode } from 'react'
import { investigationStatus } from '../../domain/investigation'
import { useInvestigations } from '../../state/InvestigationsContext'
import styles from './KpiStrip.module.css'

interface Kpi {
  label: string
  value: number
  icon: ReactNode
  tone: string
}

export function KpiStrip() {
  const { items } = useInvestigations()
  const statuses = items.map(investigationStatus)
  const kpis: Kpi[] = [
    { label: 'Indicadores', value: items.length, icon: <Radar />, tone: 'var(--color-info)' },
    {
      label: 'Con evidencia OTX',
      value: items.filter((inv) => inv.enrichment?.tiene_evidencia).length,
      icon: <ShieldAlert />,
      tone: 'var(--color-accent)',
    },
    {
      label: 'Entidad resuelta',
      value: items.filter((inv) => inv.correlation?.resuelto).length,
      icon: <Crosshair />,
      tone: 'var(--color-entity)',
    },
    {
      label: 'Pendientes de validación',
      value: statuses.filter((s) => s === 'pendiente').length,
      icon: <Clock />,
      tone: 'var(--color-warning)',
    },
    {
      label: 'Validados',
      value: statuses.filter((s) => s === 'aceptado' || s === 'rechazado').length,
      icon: <CircleCheck />,
      tone: 'var(--color-success)',
    },
  ]

  return (
    <section aria-label="Resumen de investigaciones">
      <ul className={styles.strip}>
        {kpis.map((kpi) => (
          <li key={kpi.label} className={styles.kpi} style={{ '--tone': kpi.tone } as CSSProperties}>
            <span className={styles.icon} aria-hidden="true">
              {kpi.icon}
            </span>
            <span className={styles.value}>{kpi.value}</span>
            <span className={styles.label}>{kpi.label}</span>
          </li>
        ))}
      </ul>
    </section>
  )
}
