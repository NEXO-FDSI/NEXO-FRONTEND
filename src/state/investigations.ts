import type { ErrorInfo } from '../api/http'
import type {
  CorrelationResponse,
  EnrichmentResponse,
  IndicatorRead,
  InvestigationSnapshot,
  ReportRead,
  ValidationRead,
} from '../api/types'
import type { Investigation, StepId } from '../domain/investigation'
import { summarizeOtx } from '../domain/otx'

/** Estado transitorio de una investigación: qué paso corre y cuál fue el último fallo. */
export interface CaseActivity {
  running: StepId | null
  failure: { step: StepId; error: ErrorInfo } | null
}

export interface InvestigationsState {
  /** Más reciente primero. */
  items: Investigation[]
  activity: Record<number, CaseActivity>
}

export type InvestigationsAction =
  | { type: 'registered'; indicator: IndicatorRead; entrada: string }
  | { type: 'loaded'; snapshot: InvestigationSnapshot }
  | { type: 'synced'; ids: number[] }
  | { type: 'removed'; indicatorId: number }
  | { type: 'stepStarted'; indicatorId: number; step: StepId }
  | { type: 'stepFailed'; indicatorId: number; step: StepId; error: ErrorInfo }
  | { type: 'failureDismissed'; indicatorId: number }
  | { type: 'enriched'; response: EnrichmentResponse }
  | { type: 'correlated'; response: CorrelationResponse }
  | { type: 'reportCreated'; report: ReportRead }
  | { type: 'validated'; indicatorId: number; validation: ValidationRead }

export const IDLE: CaseActivity = { running: null, failure: null }

export function newInvestigation(indicator: IndicatorRead, entrada: string): Investigation {
  return {
    indicator,
    entrada,
    enrichment: null,
    correlation: null,
    reports: [],
    validations: [],
    missing: false,
  }
}

function snapshotEnrichment(response: EnrichmentResponse) {
  const { fuente, tiene_evidencia, detalle, fuentes, detalle_completo } = response
  return {
    fuente,
    tiene_evidencia,
    resumen: summarizeOtx(detalle),
    // fuentes ?? []: un backend anterior a la Fase 2 no la envía.
    fuentes: fuentes ?? [],
    // Recortado (listado paginado) no se guarda como crudo: el visor ofrece recargarlo.
    detalle: detalle_completo === false ? undefined : detalle,
  }
}

/** Investigación reconstruida por GET /indicators/{id} (otro navegador, historial borrado…). */
export function fromSnapshot(snapshot: InvestigationSnapshot, entrada?: string): Investigation {
  return {
    indicator: snapshot.indicator,
    entrada: entrada ?? snapshot.indicator.valor,
    enrichment: snapshot.enrichment && snapshotEnrichment(snapshot.enrichment),
    correlation: snapshot.correlation,
    reports: snapshot.reports,
    validations: snapshot.validations,
    missing: false,
  }
}

const unirPorId = <T extends { id: number }>(a: T[], b: T[]): T[] =>
  [...new Map([...a, ...b].map((x) => [x.id, x])).values()].toSorted((x, y) => x.id - y.id)

/**
 * Fusión monotónica de lo local con lo del backend: nunca retrocede. Lo local viene de las
 * respuestas de los POST y puede ser más nuevo que un GET que salió antes (un paso que
 * terminó mientras viajaba la consulta); de lo remoto se suma lo que falte (informes y
 * validaciones hechos en otra sesión).
 */
function fusionar(local: Investigation, remoto: Investigation): Investigation {
  return {
    ...local,
    indicator: remoto.indicator,
    enrichment: local.enrichment ?? remoto.enrichment,
    correlation: local.correlation ?? remoto.correlation,
    reports: unirPorId(local.reports, remoto.reports),
    validations: unirPorId(local.validations, remoto.validations),
    missing: false,
  }
}

/** Más reciente primero: el id del backend es incremental. */
const porIdDesc = (items: Investigation[]) => items.toSorted((a, b) => b.indicator.id - a.indicator.id)

export function initialState(items: Investigation[]): InvestigationsState {
  // La investigación abierta la da la URL (hooks/useRoute.ts), no el estado.
  return { items, activity: {} }
}

function withActivity(
  state: InvestigationsState,
  indicatorId: number,
  activity: CaseActivity,
): Record<number, CaseActivity> {
  return { ...state.activity, [indicatorId]: activity }
}

/**
 * Cada resultado del backend actualiza los datos y libera el paso en curso en una
 * sola transición: la UI nunca ve un dato nuevo con el paso todavía "corriendo".
 */
function settle(
  state: InvestigationsState,
  indicatorId: number,
  update: (inv: Investigation) => Investigation,
): InvestigationsState {
  return {
    ...state,
    items: state.items.map((inv) => (inv.indicator.id === indicatorId ? update(inv) : inv)),
    activity: withActivity(state, indicatorId, IDLE),
  }
}

export function investigationsReducer(
  state: InvestigationsState,
  action: InvestigationsAction,
): InvestigationsState {
  switch (action.type) {
    case 'registered': {
      const id = action.indicator.id
      return {
        ...state,
        items: [
          newInvestigation(action.indicator, action.entrada),
          ...state.items.filter((inv) => inv.indicator.id !== id),
        ],
        activity: withActivity(state, id, IDLE),
      }
    }
    case 'loaded': {
      const id = action.snapshot.indicator.id
      const local = state.items.find((inv) => inv.indicator.id === id)
      // La entrada original del analista solo la conoce el navegador que la registró.
      const remoto = fromSnapshot(action.snapshot, local?.entrada)
      return {
        ...state,
        items: local
          ? state.items.map((i) => (i.indicator.id === id ? fusionar(i, remoto) : i))
          : porIdDesc([remoto, ...state.items]),
        activity: withActivity(state, id, state.activity[id] ?? IDLE),
      }
    }
    case 'synced': {
      // El backend es la fuente de verdad: lo que ya no está allí (eliminado, BD reiniciada)
      // sale de la caché. Un id mayor que todos los listados se conserva: se registró
      // mientras viajaba la consulta.
      const vigentes = new Set(action.ids)
      const maximo = Math.max(0, ...action.ids)
      const items = state.items.filter((i) => vigentes.has(i.indicator.id) || (maximo > 0 && i.indicator.id > maximo))
      return { ...state, items: porIdDesc(items) }
    }
    case 'removed': {
      const items = state.items.filter((inv) => inv.indicator.id !== action.indicatorId)
      const { [action.indicatorId]: _removed, ...activity } = state.activity
      return { items, activity }
    }
    case 'stepStarted':
      return {
        ...state,
        activity: withActivity(state, action.indicatorId, { running: action.step, failure: null }),
      }
    case 'stepFailed':
      return {
        ...state,
        // 404: el backend ya no tiene el indicador/informe (BD reiniciada o limpiada).
        items:
          action.error.status === 404
            ? state.items.map((inv) =>
                inv.indicator.id === action.indicatorId ? { ...inv, missing: true } : inv,
              )
            : state.items,
        activity: withActivity(state, action.indicatorId, {
          running: null,
          failure: { step: action.step, error: action.error },
        }),
      }
    case 'failureDismissed':
      return { ...state, activity: withActivity(state, action.indicatorId, IDLE) }
    case 'enriched': {
      return settle(state, action.response.indicator_id, (inv) => ({
        ...inv,
        enrichment: snapshotEnrichment(action.response),
      }))
    }
    case 'correlated':
      return settle(state, action.response.indicator_id, (inv) => ({
        ...inv,
        correlation: action.response,
      }))
    case 'reportCreated':
      return settle(state, action.report.indicator_id, (inv) => ({
        ...inv,
        reports: [...inv.reports, action.report],
      }))
    case 'validated':
      return settle(state, action.indicatorId, (inv) => ({
        ...inv,
        validations: [...inv.validations, action.validation],
      }))
  }
}
