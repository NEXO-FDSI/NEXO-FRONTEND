import { toErrorInfo, type ErrorInfo } from '../api/http'
import { nexoApi } from '../api/nexo'
import type {
  BatchCreate,
  BatchCreated,
  BatchDetail,
  BatchReportRead,
  BatchSummary,
  BatchValidationRead,
  IndicatorCreate,
  IndicatorRead,
  IndicatorTipo,
  ValidationRequest,
} from '../api/types'
import { CONCURRENCIA_LOTE, fuentesFallidas, miembroListo, ordenDeProceso, PASOS_LOTE } from '../domain/batch'
import {
  AUTOMATIC_STEPS,
  isStepDone,
  type AutomaticStep,
  type Investigation,
} from '../domain/investigation'
import { fromSnapshot, newInvestigation, type InvestigationsAction } from './investigations'

export type RegisterResult =
  | { ok: true; indicator: IndicatorRead }
  | { ok: false; error: ErrorInfo }

export type LoadResult = { ok: true } | { ok: false; error: ErrorInfo }
export type SyncResult = { ok: true; total: number } | { ok: false; error: ErrorInfo }

// ponytail: se recorren todas las páginas al arrancar (el Panel agrega sobre todo). Con
// miles de investigaciones convendría cargar bajo demanda y pedir los agregados al backend.
export type DeleteResult = { ok: true; eliminados: Record<string, number> } | { ok: false; error: ErrorInfo }
export type BatchCreateResult = { ok: true; created: BatchCreated } | { ok: false; error: ErrorInfo }
export type BatchLoadResult = { ok: true; detail: BatchDetail } | { ok: false; error: ErrorInfo }
export type BatchListResult = { ok: true; batches: BatchSummary[] } | { ok: false; error: ErrorInfo }
export type BatchReportResult = { ok: true; report: BatchReportRead } | { ok: false; error: ErrorInfo }
export type BatchValidateResult = { ok: true; validation: BatchValidationRead } | { ok: false; error: ErrorInfo }

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
  /** Encadena los pasos que falten (todos con `forzar`) y se detiene en el primer fallo. */
  runAutomatic(inv: Investigation, pasos?: readonly AutomaticStep[], forzar?: boolean): Promise<boolean>
  validate(indicatorId: number, reportId: number, request: ValidationRequest): Promise<boolean>
  /** Registra el lote (POST /batches), trae a sus miembros y, con `autoRun`, los analiza. */
  createBatch(payload: BatchCreate, options: { autoRun: boolean }): Promise<BatchCreateResult>
  /** GET /batches/{id}: fusiona la investigación de cada miembro y devuelve el lote. */
  loadBatch(batchId: number): Promise<BatchLoadResult>
  listBatches(): Promise<BatchListResult>
  /** enrich → correlate en los miembros que lo necesiten, CONCURRENCIA_LOTE a la vez, hashes primero. */
  analyzeBatch(miembros: readonly Investigation[]): Promise<void>
  /** Repite enrich → correlate en los miembros con fuentes sin verificar (p. ej. cupo de VirusTotal). */
  completeSources(miembros: readonly Investigation[]): Promise<void>
  /** Genera una versión nueva del informe conjunto a partir de lo ya persistido. */
  createBatchReport(batchId: number): Promise<BatchReportResult>
  validateBatchReport(reportId: number, request: ValidationRequest): Promise<BatchValidateResult>
  /** Elimina el lote del backend, en cascada. Sus indicadores siguen en Investigaciones. */
  deleteBatch(batchId: number): Promise<DeleteResult>
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

  async function runAutomatic(inv: Investigation, pasos = AUTOMATIC_STEPS, forzar = false): Promise<boolean> {
    const id = inv.indicator.id
    return withLock(id, async () => {
      for (const step of pasos) {
        if (!forzar && isStepDone(inv, step)) continue
        // Se corta en el primer fallo: cada paso exige el anterior en el backend.
        if (!(await execute(id, step))) return false
      }
      return true
    })
  }

  /**
   * Reparte el trabajo entre CONCURRENCIA_LOTE trabajadores. Un fallo no detiene a los demás:
   * queda en la actividad de ese indicador, con su "Reintentar".
   */
  async function enCola(miembros: readonly Investigation[], trabajo: (inv: Investigation) => Promise<boolean>) {
    const cola = ordenDeProceso(miembros)
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCIA_LOTE, cola.length) }, async () => {
        for (let inv = cola.shift(); inv; inv = cola.shift()) await trabajo(inv)
      }),
    )
  }

  const analyzeBatch = (miembros: readonly Investigation[]) =>
    enCola(miembros.filter((inv) => !miembroListo(inv)), (inv) => runAutomatic(inv, PASOS_LOTE))

  async function loadBatch(batchId: number): Promise<BatchLoadResult> {
    try {
      const detail = await nexoApi.getBatch(batchId)
      const entradas = new Map(detail.items.map((item) => [item.indicator_id, item.entrada]))
      for (const snapshot of detail.investigaciones) {
        dispatch({ type: 'loaded', snapshot, entrada: entradas.get(snapshot.indicator.id) })
      }
      return { ok: true, detail }
    } catch (error) {
      return { ok: false, error: toErrorInfo(error) }
    }
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

    async createBatch(payload, { autoRun }) {
      let created: BatchCreated
      try {
        created = await nexoApi.createBatch(payload)
      } catch (error) {
        return { ok: false, error: toErrorInfo(error) }
      }
      // Los miembros entran a la caché (y a Investigaciones) con su entrada original.
      const loaded = await loadBatch(created.batch.id)
      if (autoRun && loaded.ok) void analyzeBatch(loaded.detail.investigaciones.map((s) => fromSnapshot(s)))
      return { ok: true, created }
    },

    loadBatch,

    async listBatches() {
      try {
        return { ok: true, batches: await nexoApi.listBatches() }
      } catch (error) {
        return { ok: false, error: toErrorInfo(error) }
      }
    },

    analyzeBatch,

    completeSources: (miembros) =>
      enCola(
        miembros.filter((inv) => fuentesFallidas(inv).length > 0),
        // Forzado: el enriquecimiento ya está hecho, pero /enrich solo vuelve a consultar las
        // fuentes sin caché, y la correlación debe recalcularse con la evidencia nueva.
        (inv) => runAutomatic(inv, PASOS_LOTE, true),
      ),

    async createBatchReport(batchId) {
      try {
        return { ok: true, report: await nexoApi.createBatchReport(batchId) }
      } catch (error) {
        return { ok: false, error: toErrorInfo(error) }
      }
    },

    async deleteBatch(batchId) {
      try {
        return { ok: true, eliminados: (await nexoApi.deleteBatch(batchId)).eliminados }
      } catch (error) {
        const info = toErrorInfo(error)
        // 404: ya no estaba en el backend (otra sesión lo borró); el resultado es el mismo.
        return info.status === 404 ? { ok: true, eliminados: {} } : { ok: false, error: info }
      }
    },

    async validateBatchReport(reportId, request) {
      try {
        return { ok: true, validation: await nexoApi.validateBatchReport(reportId, request) }
      } catch (error) {
        return { ok: false, error: toErrorInfo(error) }
      }
    },

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
