import { request } from './http'
import type {
  BatchCreate,
  BatchCreated,
  BatchDeleteResponse,
  BatchDetail,
  BatchReportRead,
  BatchSummary,
  BatchValidationRead,
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

  /** Registra o reutiliza cada indicador; un ítem inválido no aborta el lote. */
  createBatch: (payload: BatchCreate) => request<BatchCreated>('POST', '/batches', { body: payload }),

  listBatches: () => request<BatchSummary[]>('GET', '/batches'),

  /** Ítems, investigación de cada miembro y correlación entre ellos (determinística). */
  getBatch: (batchId: number) => request<BatchDetail>('GET', `/batches/${batchId}`),

  /** Una versión nueva del informe conjunto: una sola llamada al LLM para todo el lote. */
  createBatchReport: (batchId: number) =>
    request<BatchReportRead>('POST', `/batches/${batchId}/report`, { timeoutMs: REPORT_TIMEOUT_MS }),

  /** Irreversible: borra informes, validaciones y entradas del lote; sus indicadores no. */
  deleteBatch: (batchId: number) => request<BatchDeleteResponse>('DELETE', `/batches/${batchId}`),

  validateBatchReport: (reportId: number, payload: ValidationRequest) =>
    request<BatchValidationRead>('POST', `/batch-reports/${reportId}/validate`, { body: payload }),
}
