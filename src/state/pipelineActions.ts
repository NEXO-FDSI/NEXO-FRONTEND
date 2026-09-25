import { toErrorInfo, type ErrorInfo } from '../api/http'
import { nexoApi } from '../api/nexo'
import type { IndicatorCreate, IndicatorRead, ValidationRequest } from '../api/types'
import {
  AUTOMATIC_STEPS,
  isStepDone,
  type AutomaticStep,
  type Investigation,
} from '../domain/investigation'
import { newInvestigation, type InvestigationsAction } from './investigations'

export type RegisterResult =
  | { ok: true; indicator: IndicatorRead }
  | { ok: false; error: ErrorInfo }

export interface PipelineActions {
  register(payload: IndicatorCreate, options: { autoRun: boolean }): Promise<RegisterResult>
  runStep(indicatorId: number, step: AutomaticStep): Promise<boolean>
  runAutomatic(inv: Investigation): Promise<boolean>
  validate(indicatorId: number, reportId: number, request: ValidationRequest): Promise<boolean>
}

/**
 * Orquesta las llamadas al backend y traduce cada resultado en una acción del reducer.
 * Un candado por indicador impide pasos concurrentes sobre la misma investigación
 * (doble clic, "análisis completo" mientras corre un paso suelto).
 */
export function createPipelineActions(dispatch: (action: InvestigationsAction) => void): PipelineActions {
  const locks = new Set<number>()

  async function withLock(indicatorId: number, work: () => Promise<boolean>): Promise<boolean> {
    if (locks.has(indicatorId)) return false
    locks.add(indicatorId)
    try {
      return await work()
    } finally {
      locks.delete(indicatorId)
    }
  }

  async function attempt(
    indicatorId: number,
    step: AutomaticStep | 'validate',
    call: () => Promise<InvestigationsAction>,
  ): Promise<boolean> {
    dispatch({ type: 'stepStarted', indicatorId, step })
    try {
      dispatch(await call())
      return true
    } catch (error) {
      dispatch({ type: 'stepFailed', indicatorId, step, error: toErrorInfo(error) })
      return false
    }
  }

  const STEP_CALLS: Record<AutomaticStep, (id: number) => Promise<InvestigationsAction>> = {
    enrich: async (id) => ({ type: 'enriched', response: await nexoApi.enrich(id) }),
    correlate: async (id) => ({ type: 'correlated', response: await nexoApi.correlate(id) }),
    report: async (id) => ({ type: 'reportCreated', report: await nexoApi.createReport(id) }),
  }

  const execute = (indicatorId: number, step: AutomaticStep) =>
    attempt(indicatorId, step, () => STEP_CALLS[step](indicatorId))

  async function runAutomatic(inv: Investigation): Promise<boolean> {
    const id = inv.indicator.id
    return withLock(id, async () => {
      for (const step of AUTOMATIC_STEPS) {
        if (isStepDone(inv, step)) continue
        // Se corta en el primer fallo: cada paso exige el anterior en el backend.
        if (!(await execute(id, step))) return false
      }
      return true
    })
  }

  return {
    async register(payload, { autoRun }) {
      let indicator: IndicatorRead
      try {
        indicator = await nexoApi.createIndicator(payload)
      } catch (error) {
        return { ok: false, error: toErrorInfo(error) }
      }
      dispatch({ type: 'registered', indicator, entrada: payload.valor })
      if (autoRun) void runAutomatic(newInvestigation(indicator, payload.valor))
      return { ok: true, indicator }
    },

    runStep: (indicatorId, step) => withLock(indicatorId, () => execute(indicatorId, step)),

    runAutomatic,

    validate: (indicatorId, reportId, request) =>
      withLock(indicatorId, () =>
        attempt(indicatorId, 'validate', async () => ({
          type: 'validated',
          indicatorId,
          validation: await nexoApi.validateReport(reportId, request),
        })),
      ),
  }
}
