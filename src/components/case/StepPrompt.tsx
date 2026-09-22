import { Play } from 'lucide-react'
import type { ReactNode } from 'react'
import { canRunStep, PIPELINE_STEPS, type AutomaticStep } from '../../domain/investigation'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import type { CasePanelProps } from './types'

interface StepPromptProps extends CasePanelProps {
  step: AutomaticStep
  icon: ReactNode
  title: string
  children: ReactNode
}

/** Estado vacío de una pestaña cuyo paso aún no corre, con el botón para ejecutarlo. */
export function StepPrompt({ step, inv, activity, onRun, icon, title, children }: StepPromptProps) {
  const definition = PIPELINE_STEPS.find((s) => s.id === step)
  const ready = canRunStep(inv, step)
  const running = activity.running === step
  return (
    <EmptyState
      icon={icon}
      title={title}
      action={
        <Button
          variant="primary"
          icon={<Play size={15} aria-hidden="true" />}
          loading={running}
          disabled={!ready || activity.running !== null || inv.missing}
          onClick={() => onRun(step)}
        >
          Ejecutar {definition?.label.toLowerCase()}
        </Button>
      }
    >
      {children}
      {!ready && <p>Requiere completar antes el enriquecimiento.</p>}
    </EmptyState>
  )
}
