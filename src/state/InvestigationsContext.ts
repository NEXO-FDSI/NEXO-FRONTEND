import { createContext, useContext } from 'react'
import type { Investigation } from '../domain/investigation'
import type { CaseActivity } from './investigations'
import type { PipelineActions } from './pipelineActions'

export type Sincronizacion =
  | { estado: 'sincronizando'; pagina: number; paginas: number }
  | { estado: 'listo' }
  | { estado: 'error'; mensaje: string }

export interface InvestigationsContextValue extends PipelineActions {
  items: Investigation[]
  /** false si el navegador no pudo guardar el historial (modo privado, cuota llena). */
  persisted: boolean
  /** Estado de la sincronización inicial con el backend (fuente de verdad). */
  sincronizacion: Sincronizacion
  activityOf(indicatorId: number): CaseActivity
  dismissFailure(indicatorId: number): void
}

export const InvestigationsContext = createContext<InvestigationsContextValue | null>(null)

export function useInvestigations(): InvestigationsContextValue {
  const value = useContext(InvestigationsContext)
  if (!value) throw new Error('useInvestigations debe usarse dentro de <InvestigationsProvider>')
  return value
}
