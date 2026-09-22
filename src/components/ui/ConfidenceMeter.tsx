import { CONFIDENCE_LABEL, confidenceLevel } from '../../domain/confidence'
import { formatPercent } from '../../domain/format'
import styles from './ConfidenceMeter.module.css'

/** Barra de confianza con texto: el color nunca es el único indicador. */
export function ConfidenceMeter({ value }: { value: number | null }) {
  const level = confidenceLevel(value)
  const percent = Math.round((value ?? 0) * 100)
  return (
    <div className={`${styles.meter} ${styles[level]}`}>
      <div className={styles.labels}>
        <span>{CONFIDENCE_LABEL[level]}</span>
        <span className="mono">{formatPercent(value)}</span>
      </div>
      <div
        className={styles.track}
        role="meter"
        aria-label="Confianza de la asociación"
        aria-valuemin={0}
        aria-valuemax={100}
        aria-valuenow={percent}
        aria-valuetext={`${CONFIDENCE_LABEL[level]} (${formatPercent(value)})`}
      >
        <span className={styles.fill} style={{ width: `${percent}%` }} />
      </div>
    </div>
  )
}
