import { createContext, useContext } from 'react'
import type { Investigation } from '../domain/investigation'
import type { CaseActivity } from './investigations'
import type { PipelineActions } from './pipelineActions'

export interface InvestigationsContextValue extends PipelineActions {
  items: Investigation[]
  selected: Investigation | null
  /** false si el navegador no pudo guardar el historial (modo privado, cuota llena). */
  persisted: boolean
  activityOf(indicatorId: number): CaseActivity
  select(indicatorId: number): void
  remove(indicatorId: number): void
  dismissFailure(indicatorId: number): void
}

export const InvestigationsContext = createContext<InvestigationsContextValue | null>(null)

export function useInvestigations(): InvestigationsContextValue {
  const value = useContext(InvestigationsContext)
  if (!value) throw new Error('useInvestigations debe usarse dentro de <InvestigationsProvider>')
  return value
}
