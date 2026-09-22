import { request } from './http'
import type {
  CorrelationResponse,
  EnrichmentResponse,
  HealthResponse,
  IndicatorCreate,
  IndicatorRead,
  ReportRead,
  ValidationRead,
  ValidationRequest,
} from './types'

const HEALTH_TIMEOUT_MS = 5_000
// El LLM tiene 60 s de timeout en el backend (app/ai_component/llm_client.py) más la
// correlación y la consulta a Chroma: se deja margen para no cortar un informe válido.
export const REPORT_TIMEOUT_MS = 120_000

/** Un método por endpoint de NEXO-BACKEND, en el orden del pipeline. */
export const nexoApi = {
  health: () => request<HealthResponse>('GET', '/health', { timeoutMs: HEALTH_TIMEOUT_MS }),

  createIndicator: (payload: IndicatorCreate) =>
    request<IndicatorRead>('POST', '/indicators', { body: payload }),

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
