import { Waypoints } from 'lucide-react'
import { PIPELINE_STEPS } from '../../domain/investigation'
import { Panel } from '../ui/Panel'
import styles from './Welcome.module.css'

export function Welcome() {
  return (
    <Panel title="Cómo funciona NEXO" icon={<Waypoints aria-hidden="true" />}>
      <p className={styles.lead}>
        Registra un indicador de compromiso (IP, dominio, hash o URL) y sigue, paso a paso y de forma
        auditable, la cadena <strong>indicador → entidad → técnica ATT&amp;CK → evidencia</strong>.
      </p>
      <ol className={styles.steps}>
        {PIPELINE_STEPS.map((step, index) => (
          <li key={step.id}>
            <span className={`${styles.number} mono`}>{String(index + 1).padStart(2, '0')}</span>
            <span className={styles.label}>{step.label}</span>
            <span className={styles.description}>{step.description}</span>
          </li>
        ))}
      </ol>
      <p className={styles.note}>
        Si la evidencia no alcanza, NEXO declara “sin asociación” en lugar de adivinar: ninguna técnica
        se atribuye sin sustento, y cada propuesta queda sujeta a la validación de un analista.
      </p>
    </Panel>
  )
}
