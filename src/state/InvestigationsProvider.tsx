import { useEffect, useMemo, useReducer, useSyncExternalStore, type ReactNode } from 'react'
import { InvestigationsContext, type InvestigationsContextValue } from './InvestigationsContext'
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

  useEffect(() => {
    saveInvestigations(state.items)
  }, [state.items])

  const value = useMemo<InvestigationsContextValue>(
    () => ({
      ...actions,
      items: state.items,
      selected: state.items.find((inv) => inv.indicator.id === state.selectedId) ?? null,
      persisted,
      activityOf: (indicatorId) => state.activity[indicatorId] ?? IDLE,
      select: (indicatorId) => dispatch({ type: 'selected', indicatorId }),
      remove: (indicatorId) => dispatch({ type: 'removed', indicatorId }),
      dismissFailure: (indicatorId) => dispatch({ type: 'failureDismissed', indicatorId }),
    }),
    [actions, state, persisted],
  )

  return <InvestigationsContext value={value}>{children}</InvestigationsContext>
}
