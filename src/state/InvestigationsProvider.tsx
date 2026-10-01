import { useEffect, useMemo, useReducer, useState, useSyncExternalStore, type ReactNode } from 'react'
import { InvestigationsContext, type InvestigationsContextValue, type Sincronizacion } from './InvestigationsContext'
import { IDLE, initialState, investigationsReducer } from './investigations'
import { createPipelineActions } from './pipelineActions'
import {
  isHistoryPersisted,
  loadInvestigations,
  saveInvestigations,
  subscribeHistoryPersisted,
} from './storage'

export function InvestigationsProvider({ children }: { children: ReactNode }) {
  const [state, dispatch] = useReducer(investigationsReducer, undefined, () =>
    initialState(loadInvestigations()),
  )
  const persisted = useSyncExternalStore(subscribeHistoryPersisted, isHistoryPersisted)
  const actions = useMemo(() => createPipelineActions(dispatch), [])
  const [sincronizacion, setSincronizacion] = useState<Sincronizacion>({
    estado: 'sincronizando',
    pagina: 0,
    paginas: 0,
  })

  useEffect(() => {
    saveInvestigations(state.items)
  }, [state.items])

  // La caché local se muestra al instante; el backend (fuente de verdad) la completa y depura.
  useEffect(() => {
    let active = true
    void actions
      .sync((pagina, paginas) => active && setSincronizacion({ estado: 'sincronizando', pagina, paginas }))
      .then((r) => {
        if (active) setSincronizacion(r.ok ? { estado: 'listo' } : { estado: 'error', mensaje: r.error.message })
      })
    return () => {
      active = false
    }
  }, [actions])

  const value = useMemo<InvestigationsContextValue>(
    () => ({
      ...actions,
      items: state.items,
      persisted,
      sincronizacion,
      activityOf: (indicatorId) => state.activity[indicatorId] ?? IDLE,
      dismissFailure: (indicatorId) => dispatch({ type: 'failureDismissed', indicatorId }),
    }),
    [actions, state, persisted, sincronizacion],
  )

  return <InvestigationsContext value={value}>{children}</InvestigationsContext>
}
