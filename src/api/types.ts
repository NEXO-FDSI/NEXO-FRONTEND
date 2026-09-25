/**
 * Contratos de NEXO-BACKEND (app/schemas y respuestas de app/api).
 * Los nombres de campo están en español porque son las columnas reales de la BD.
 */

export type IndicatorTipo = 'ip' | 'domain' | 'hash' | 'url'

/** Body de POST /indicators (IndicatorCreate). */
export interface IndicatorCreate {
  tipo: IndicatorTipo
  valor: string
  fuente?: string | null
}

/** IndicatorRead: `valor` ya viene en forma canónica (refang, minúsculas, etc.). */
export interface IndicatorRead {
  id: number
  tipo: string
  valor: string
  fuente: string | null
  timestamp_ingesta: string
}

/** Respuesta cruda de OTX (`/indicators/{section}/{valor}/general`). Forma no garantizada. */
export type OtxDetalle = Record<string, unknown>

/** Respuesta de POST /indicators/{id}/enrich. */
export interface EnrichmentResponse {
  indicator_id: number
  fuente: string
  tiene_evidencia: boolean
  detalle: OtxDetalle
}

export interface EntityRef {
  id: number
  nombre: string
  tipo: string // malware / grupo / herramienta / campaña
}

export interface Technique {
  id: string // id oficial ATT&CK, ej. "T1566" o "T1059.001"
  nombre: string
  tactica: string
}

/** Respuesta de POST /indicators/{id}/correlate. Sin entidad: todo null y `tecnicas: []`. */
export interface CorrelationResponse {
  indicator_id: number
  resuelto: boolean
  entity: EntityRef | null
  confianza: number | null
  evidencia: string | null
  tecnicas: Technique[]
}

/** ReportRead: `contenido` es Markdown. */
export interface ReportRead {
  id: number
  indicator_id: number
  contenido: string
  nivel_confianza: number
  timestamp: string
}

export type Decision = 'aceptado' | 'rechazado'

/** Body de POST /reports/{id}/validate (HumanValidationRequest). */
export interface ValidationRequest {
  decision: Decision
  analista?: string | null
}

export interface ValidationRead {
  id: number
  report_id: number
  decision: string
  analista: string | null
  timestamp: string
}

export interface HealthResponse {
  status: string
}
