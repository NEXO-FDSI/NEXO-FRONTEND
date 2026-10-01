import { request } from './http'
import type {
  CorrelationResponse,
  DeleteResponse,
  EnrichmentResponse,
  HealthResponse,
  StatusResponse,
  IndicatorCreate,
  IndicatorRead,
  IndicatorTipo,
  InvestigationSnapshot,
  InvestigationsPage,
  ReportRead,
  ValidationRead,
  ValidationRequest,
} from './types'

const HEALTH_TIMEOUT_MS = 5_000
// Peor caso del backend (app/ai_component/llm_client.py): primario 20 s + espera de un 429
// (≤ 8 s) + reintento 20 s + respaldo 60 s ≈ 108 s, más correlación y Chroma.
export const REPORT_TIMEOUT_MS = 120_000

/** Un método por endpoint de NEXO-BACKEND, en el orden del pipeline. */
export const nexoApi = {
  health: () => request<HealthResponse>('GET', '/health', { timeoutMs: HEALTH_TIMEOUT_MS }),

  status: () => request<StatusResponse>('GET', '/status', { timeoutMs: HEALTH_TIMEOUT_MS }),

  createIndicator: (payload: IndicatorCreate) =>
    request<IndicatorRead>('POST', '/indicators', { body: payload }),

  /** Lista de 0 o 1: el backend normaliza el valor igual que al registrar. */
  findIndicator: (tipo: IndicatorTipo, valor: string) =>
    request<IndicatorRead[]>('GET', `/indicators?${new URLSearchParams({ tipo, valor })}`),

  /** Página de hasta 10 investigaciones completas (OTX recortado), de la más reciente. */
  listInvestigations: (page: number) =>
    request<InvestigationsPage>('GET', `/investigations?page=${page}&size=10`),

  getInvestigation: (indicatorId: number) =>
    request<InvestigationSnapshot>('GET', `/indicators/${indicatorId}`),

  /** Irreversible: borra en cascada informes, validaciones, caché y links del indicador. */
  deleteIndicator: (indicatorId: number) =>
    request<DeleteResponse>('DELETE', `/indicators/${indicatorId}`),

  enrich: (indicatorId: number) =>
    request<EnrichmentResponse>('POST', `/indicators/${indicatorId}/enrich`),

  correlate: (indicatorId: number) =>
    request<CorrelationResponse>('POST', `/indicators/${indicatorId}/correlate`),

  createReport: (indicatorId: number) =>
    request<ReportRead>('POST', `/indicators/${indicatorId}/report`, {
      timeoutMs: REPORT_TIMEOUT_MS,
    }),

  validateReport: (reportId: number, payload: ValidationRequest) =>
    request<ValidationRead>('POST', `/reports/${reportId}/validate`, { body: payload }),
}
