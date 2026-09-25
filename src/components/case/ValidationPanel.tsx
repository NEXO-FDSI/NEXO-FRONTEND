import { CircleCheck, CircleX, ClipboardCheck, History } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { Decision, ReportRead, ValidationRequest } from '../../api/types'
import { formatDateTime, formatPercent } from '../../domain/format'
import { currentDecision, STATUS_LABEL, validationsFor, type Investigation } from '../../domain/investigation'
import type { CaseActivity } from '../../state/investigations'
import { loadAnalyst, saveAnalyst } from '../../state/storage'
import { STATUS_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import styles from './ValidationPanel.module.css'

const OPTIONS: readonly { decision: Decision; label: string; description: string; icon: ReactNode }[] = [
  {
    decision: 'aceptado',
    label: 'Aceptar',
    description: 'La asociación propuesta es correcta y está sustentada.',
    icon: <CircleCheck aria-hidden="true" />,
  },
  {
    decision: 'rechazado',
    label: 'Rechazar',
    description: 'La asociación es incorrecta o la evidencia no la sustenta.',
    icon: <CircleX aria-hidden="true" />,
  },
]

interface ValidationPanelProps {
  inv: Investigation
  activity: CaseActivity
  report: ReportRead | null
  onValidate: (reportId: number, request: ValidationRequest) => Promise<boolean>
}

export function ValidationPanel({ inv, activity, report, onValidate }: ValidationPanelProps) {
  const [decision, setDecision] = useState<Decision | null>(null)
  const [analista, setAnalista] = useState(loadAnalyst)
  const [message, setMessage] = useState<{ tone: 'success' | 'danger'; text: string } | null>(null)
  const analystId = useId()

  if (!report) {
    return (
      <EmptyState icon={<ClipboardCheck />} title="Nada que validar todavía">
        <p>Genera un informe para que un analista acepte o rechace la asociación propuesta.</p>
      </EmptyState>
    )
  }

  const reportId = report.id
  const history = validationsFor(inv, reportId)
  const current = currentDecision(inv, reportId)
  const entity = inv.correlation?.entity

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    if (!decision) {
      setMessage({ tone: 'danger', text: 'Elige si aceptas o rechazas la asociación.' })
      return
    }
    const name = analista.trim()
    saveAnalyst(name)
    setMessage(null)
    if (await onValidate(reportId, { decision, analista: name || null })) {
      setDecision(null)
      setMessage({ tone: 'success', text: `Decisión registrada: ${STATUS_LABEL[decision].toLowerCase()}.` })
    }
  }

  return (
    <div className={styles.panel}>
      <div className={styles.summary}>
        <div>
          <p className={styles.caption}>Informe #{reportId}</p>
          <p>
            Asociación propuesta:{' '}
            <strong className={styles.entity}>{entity ? `${entity.nombre} (${entity.tipo})` : 'ninguna'}</strong>{' '}
            · confianza {formatPercent(report.nivel_confianza)}
          </p>
        </div>
        <Badge tone={STATUS_TONE[current ?? 'pendiente']}>Estado: {STATUS_LABEL[current ?? 'pendiente']}</Badge>
      </div>

      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <fieldset className={styles.options}>
          <legend className={styles.legend}>Decisión del analista</legend>
          {OPTIONS.map((option) => (
            <label key={option.decision} className={`${styles.option} ${styles[option.decision]}`}>
              <input
                type="radio"
                name="decision"
                value={option.decision}
                checked={decision === option.decision}
                onChange={() => setDecision(option.decision)}
              />
              <span className={styles.optionIcon}>{option.icon}</span>
              <span>
                <span className={styles.optionLabel}>{option.label}</span>
                <span className={styles.optionText}>{option.description}</span>
              </span>
            </label>
          ))}
        </fieldset>

        <div className={styles.field}>
          <label htmlFor={analystId}>
            Analista <span className={styles.optional}>(opcional)</span>
          </label>
          <input
            id={analystId}
            value={analista}
            onChange={(e) => setAnalista(e.target.value)}
            placeholder="p. ej. analista SOC N1"
            autoComplete="off"
          />
        </div>

        <div className={styles.submit}>
          <Button
            type="submit"
            variant="primary"
            loading={activity.running === 'validate'}
            disabled={activity.running !== null || inv.missing}
          >
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
        {history.length === 0 ? (
          <p className={styles.hint}>Sin decisiones registradas para este informe.</p>
        ) : (
          <ol className={styles.timeline}>
            {history.map((v) => (
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
