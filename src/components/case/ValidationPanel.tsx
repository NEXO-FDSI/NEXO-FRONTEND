import { CircleCheck, CircleX, ClipboardCheck, History } from 'lucide-react'
import { useState, type FormEvent, type ReactNode } from 'react'
import type { Decision, ReportRead, ValidationRead, ValidationRequest } from '../../api/types'
import { entityTypeLabel, formatDateTime, formatPercent } from '../../domain/format'
import { STATUS_LABEL, validationsFor, type Investigation } from '../../domain/investigation'
import type { CaseActivity } from '../../state/investigations'
import { STATUS_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import styles from './ValidationPanel.module.css'

const ICONS: Record<Decision, ReactNode> = {
  aceptado: <CircleCheck aria-hidden="true" />,
  rechazado: <CircleX aria-hidden="true" />,
}

/** Qué significa cada decisión para lo que se valida. */
export type DescripcionDecisiones = Record<Decision, string>

const ASOCIACION: DescripcionDecisiones = {
  aceptado: 'La asociación propuesta es correcta y está sustentada.',
  rechazado: 'La asociación es incorrecta o la evidencia no la sustenta.',
}

/** Una fila del historial: la misma forma en human_validation y en batch_validation. */
export type DecisionRegistrada = Pick<ValidationRead, 'id' | 'decision' | 'analista' | 'timestamp'>

interface DecisionPanelProps {
  /** "Informe #1", "Informe conjunto #4". */
  titulo: string
  resumen: ReactNode
  /** Lo que se acepta o rechaza, para el aviso: "la asociación", "el informe conjunto". */
  objeto: string
  opciones: DescripcionDecisiones
  /** Más reciente primero. */
  historial: DecisionRegistrada[]
  ocupado: boolean
  bloqueado?: boolean
  onValidate: (request: ValidationRequest) => Promise<boolean>
}

/** Decisión del analista con su historial auditable. Lo comparten el informe de un indicador y el de un lote. */
export function DecisionPanel({ titulo, resumen, objeto, opciones, historial, ocupado, bloqueado = false, onValidate }: DecisionPanelProps) {
  const [decision, setDecision] = useState<Decision | null>(null)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const vigente = historial[0]?.decision
  const current = vigente === 'aceptado' || vigente === 'rechazado' ? vigente : null

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!decision) {
      setMessage({ tone: 'danger', text: `Elige si aceptas o rechazas ${objeto}.` })
      return
    }
    setMessage(null)
    // ponytail: sin analista; lo asignará el backend cuando exista el login.
    if (await onValidate({ decision })) {
      setDecision(null)
      setMessage({ tone: 'success', text: `Decisión registrada: ${STATUS_LABEL[decision].toLowerCase()}.` })
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        <div>
          <p className={styles.caption}>{titulo}</p>
          <p>{resumen}</p>
        </div>
        <Badge tone={STATUS_TONE[current ?? 'pendiente']}>Estado: {STATUS_LABEL[current ?? 'pendiente']}</Badge>
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <fieldset className={styles.options}>
          <legend className={styles.legend}>Decisión del analista</legend>
          {(['aceptado', 'rechazado'] as const).map((opcion) => (
            <label key={opcion} className={`${styles.option} ${styles[opcion]}`}>
              <input
                type="radio"
                name="decision"
                value={opcion}
                checked={decision === opcion}
                onChange={() => setDecision(opcion)}
              />
              <span className={styles.optionIcon}>{ICONS[opcion]}</span>
              <span>
                <span className={styles.optionLabel}>{opcion === 'aceptado' ? 'Aceptar' : 'Rechazar'}</span>
                <span className={styles.optionText}>{opciones[opcion]}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={styles.submit}>
          <Button type="submit" variant="primary" loading={ocupado} disabled={ocupado || bloqueado}>
            Registrar decisión
          </Button>
          <span className={styles.hint}>Cada decisión se guarda como una fila nueva: el historial es auditable.</span>
        </div>

        {message && <Alert tone={message.tone} title={message.text} />}
      </form>

      <section className={styles.history} aria-label="Historial de decisiones">
        <h3 className={styles.historyTitle}>
          <History size={15} aria-hidden="true" /> Historial de decisiones
        </h3>
        {historial.length === 0 ? (
          <p className={styles.hint}>Sin decisiones registradas para este informe.</p>
        ) : (
          <ol className={styles.timeline}>
            {historial.map((v) => (
              <li key={v.id}>
                <Badge tone={v.decision === 'aceptado' ? 'success' : 'danger'}>{v.decision}</Badge>
                <span>{v.analista || 'Analista no identificado'}</span>
                <span className={styles.hint}>{formatDateTime(v.timestamp)}</span>
              </li>
            ))}
          </ol>
        )}
      </section>
    </div>
  )
}

interface ValidationPanelProps {
  inv: Investigation
  activity: CaseActivity
  report: ReportRead | null
  onValidate: (reportId: number, request: ValidationRequest) => Promise<boolean>
}

export function ValidationPanel({ inv, activity, report, onValidate }: ValidationPanelProps) {
  if (!report) {
    return (
      <EmptyState icon={<ClipboardCheck />} title="Nada que validar todavía">
        <p>Genera un informe para que un analista acepte o rechace la asociación propuesta.</p>
      </EmptyState>
    )
  }

  const entity = inv.correlation?.entity
  return (
    <DecisionPanel
      // key: cambiar de versión del informe reinicia la decisión a medio elegir.
      key={report.id}
      titulo={`Informe #${report.id}`}
      resumen={
        <>
          Asociación propuesta:{' '}
          <strong className={styles.entity}>{entity ? `${entity.nombre} (${entityTypeLabel(entity.tipo)})` : 'ninguna'}</strong>{' '}
          · confianza {formatPercent(report.nivel_confianza)}
        </>
      }
      objeto="la asociación"
      opciones={ASOCIACION}
      historial={validationsFor(inv, report.id)}
      ocupado={activity.running === 'validate'}
      bloqueado={activity.running !== null || inv.missing}
      onValidate={(request) => onValidate(report.id, request)}
    />
  )
}
