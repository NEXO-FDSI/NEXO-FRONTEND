import { Check, Lock, X } from 'lucide-react'
import {
  canRunStep,
  isAutomaticStep,
  isStepDone,
  PIPELINE_STEPS,
  type AutomaticStep,
  type Investigation,
  type StepId,
} from '../../domain/investigation'
import type { CaseActivity } from '../../state/investigations'
import { Button } from '../ui/Button'
import { Spinner } from '../ui/Spinner'
import styles from './PipelineStepper.module.css'

type StepState = 'done' | 'running' | 'failed' | 'ready' | 'locked'

const STATE_LABEL: Record<StepState, string> = {
  done: 'completado',
  running: 'en curso',
  failed: 'falló',
  ready: 'disponible',
  locked: 'bloqueado: requiere el paso previo',
}

function stepState(inv: Investigation, activity: CaseActivity, step: StepId): StepState {
  if (activity.running === step) return 'running'
  if (activity.failure?.step === step) return 'failed'
  if (isStepDone(inv, step)) return 'done'
  return canRunStep(inv, step) ? 'ready' : 'locked'
}

interface PipelineStepperProps {
  inv: Investigation
  activity: CaseActivity
  onRun: (step: AutomaticStep) => void
  onValidate: () => void
}

export function PipelineStepper({ inv, activity, onRun, onValidate }: PipelineStepperProps) {
  const busy = activity.running !== null || inv.missing

  function action(step: StepId, state: StepState) {
    if (state === 'running' || state === 'locked') return null
    if (step === 'validate') {
      return state === 'done' ? null : (
        <Button size="sm" onClick={onValidate} disabled={busy}>
          Validar
        </Button>
      )
    }
    if (!isAutomaticStep(step)) return null
    // Enriquecer y correlacionar son idempotentes en el backend: repetirlos no aporta.
    // Un informe nuevo, en cambio, es una fila nueva (el LLM puede redactar distinto).
    if (state === 'done') {
      return step === 'report' ? (
        <Button size="sm" variant="ghost" onClick={() => onRun(step)} disabled={busy}>
          Regenerar
        </Button>
      ) : null
    }
    return (
      <Button size="sm" onClick={() => onRun(step)} disabled={busy}>
        {state === 'failed' ? 'Reintentar' : 'Ejecutar'}
      </Button>
    )
  }

  return (
    <ol className={styles.stepper} aria-label="Pipeline del indicador">
      {PIPELINE_STEPS.map((step, index) => {
        const state = stepState(inv, activity, step.id)
        return (
          <li key={step.id} className={`${styles.step} ${styles[state]}`}>
            <span className={styles.marker} aria-hidden="true">
              {state === 'done' && <Check size={15} />}
              {state === 'running' && <Spinner size={14} />}
              {state === 'failed' && <X size={15} />}
              {state === 'locked' && <Lock size={13} />}
              {state === 'ready' && index + 1}
            </span>
            <span className={styles.text}>
              <span className={styles.label}>{step.label}</span>
              <span className={styles.description}>{step.description}</span>
              <span className="sr-only">Estado: {STATE_LABEL[state]}</span>
            </span>
            <span className={styles.action}>{action(step.id, state)}</span>
          </li>
        )
      })}
    </ol>
  )
}
