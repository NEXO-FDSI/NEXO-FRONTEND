import { toErrorInfo, type ErrorInfo } from '../api/http'
import { nexoApi } from '../api/nexo'
import type { IndicatorCreate, IndicatorRead, IndicatorTipo, ValidationRequest } from '../api/types'
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

export type LoadResult = { ok: true } | { ok: false; error: ErrorInfo }
export type SyncResult = { ok: true; total: number } | { ok: false; error: ErrorInfo }

// ponytail: se recorren todas las páginas al arrancar (el Panel agrega sobre todo). Con
// miles de investigaciones convendría cargar bajo demanda y pedir los agregados al backend.
export type DeleteResult = { ok: true; eliminados: Record<string, number> } | { ok: false; error: ErrorInfo }

export interface PipelineActions {
  register(payload: IndicatorCreate, options: { autoRun: boolean }): Promise<RegisterResult>
  /** Trae del backend la investigación completa (GET /indicators/{id}) y la fusiona. */
  load(indicatorId: number): Promise<LoadResult>
  /**
   * Alinea la caché con el backend recorriendo GET /investigations de a 10: fusiona cada
   * investigación y quita lo que ya no existe. `onPagina` informa el avance.
   */
  sync(onPagina?: (pagina: number, paginas: number) => void): Promise<SyncResult>
  /** Id del indicador ya registrado con ese valor (GET /indicators?tipo&valor), o null. */
  locate(tipo: IndicatorTipo, valor: string): Promise<number | null>
  /** Elimina el indicador del backend (en cascada) y lo quita del historial local. */
  deleteIndicator(indicatorId: number): Promise<DeleteResult>
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

  async function load(indicatorId: number): Promise<LoadResult> {
    try {
      dispatch({ type: 'loaded', snapshot: await nexoApi.getInvestigation(indicatorId) })
      return { ok: true }
    } catch (error) {
      const info = toErrorInfo(error)
      // 404: ya no existe en el backend (eliminado en otra sesión): sale de la caché.
      if (info.status === 404) dispatch({ type: 'removed', indicatorId })
      return { ok: false, error: info }
    }
  }

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

    load,

    async sync(onPagina) {
      const ids: number[] = []
      try {
        for (let pagina = 1, paginas = 1; pagina <= paginas; pagina++) {
          const respuesta = await nexoApi.listInvestigations(pagina)
          paginas = respuesta.pages
          onPagina?.(pagina, paginas)
          for (const snapshot of respuesta.items) {
            dispatch({ type: 'loaded', snapshot })
            ids.push(snapshot.indicator.id)
          }
        }
      } catch (error) {
        return { ok: false, error: toErrorInfo(error) }
      }
      dispatch({ type: 'synced', ids })
      return { ok: true, total: ids.length }
    },

    async locate(tipo, valor) {
      try {
        return (await nexoApi.findIndicator(tipo, valor))[0]?.id ?? null
      } catch {
        return null
      }
    },

    async deleteIndicator(indicatorId) {
      // Con el candado: no se borra mientras corre un paso sobre la misma investigación.
      if (locks.has(indicatorId)) return { ok: false, error: { kind: 'unknown', status: null, message: 'Hay un paso en curso.' } }
      locks.add(indicatorId)
      try {
        const { eliminados } = await nexoApi.deleteIndicator(indicatorId)
        dispatch({ type: 'removed', indicatorId })
        return { ok: true, eliminados }
      } catch (error) {
        const info = toErrorInfo(error)
        // 404: ya no estaba en el backend; igual se quita del historial.
        if (info.status === 404) {
          dispatch({ type: 'removed', indicatorId })
          return { ok: true, eliminados: {} }
        }
        return { ok: false, error: info }
      } finally {
        locks.delete(indicatorId)
      }
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
