import { CircleCheck, CircleDashed, CircleMinus, TriangleAlert } from 'lucide-react'
import type { FuenteEnriquecimiento, NivelSeveridad } from '../../api/types'
import { ESTADO_FUENTE_LABEL, isFailedSource, SEVERITY_LABEL } from '../../domain/severity'
import styles from './Signals.module.css'

/** Severidad con punto + texto: el color nunca es el único indicador. null = sin informe. */
export function SeverityBadge({ nivel }: { nivel: NivelSeveridad | null }) {
  return (
    <span className={`${styles.severity} ${styles[nivel ?? 'sinEvaluar']}`}>
      <span className={styles.dot} aria-hidden="true" />
      <span className="sr-only">Severidad: </span>
      {nivel ? SEVERITY_LABEL[nivel] : 'Sin evaluar'}
    </span>
  )
}

function SourceIcon({ estado }: Pick<FuenteEnriquecimiento, 'estado'>) {
  if (estado === 'con_evidencia') return <CircleCheck aria-hidden="true" />
  if (isFailedSource(estado)) return <TriangleAlert aria-hidden="true" />
  if (estado === 'sin_evidencia') return <CircleMinus aria-hidden="true" />
  return <CircleDashed aria-hidden="true" />
}

/** Una píldora por fuente: qué respondió, qué no y qué no aplica. */
export function SourceChips({ fuentes }: { fuentes: readonly FuenteEnriquecimiento[] }) {
  return (
    <ul className={styles.chips} aria-label="Estado de las fuentes">
      {fuentes.map((f) => {
        const tono = f.estado === 'con_evidencia' ? 'hit' : isFailedSource(f.estado) ? 'fallo' : 'neutro'
        return (
          <li key={f.fuente} className={`${styles.chip} ${styles[tono]}`} title={f.error ?? undefined}>
            <SourceIcon estado={f.estado} />
            <span className={styles.name}>{f.etiqueta}</span>
            <span className={styles.state}>{ESTADO_FUENTE_LABEL[f.estado]}</span>
          </li>
        )
      })}
    </ul>
  )
}
