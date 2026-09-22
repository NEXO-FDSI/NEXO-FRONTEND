import type { AutomaticStep, Investigation } from '../../domain/investigation'
import type { CaseActivity } from '../../state/investigations'

/** Lo que recibe cada pestaña del detalle de una investigación. */
export interface CasePanelProps {
  inv: Investigation
  activity: CaseActivity
  onRun: (step: AutomaticStep) => void
}
