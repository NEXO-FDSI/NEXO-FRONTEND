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

/**
 * Respuesta de OTX recortada por el backend (`recortar_otx`): `type`, `validation` y
 * `pulse_info`. La cruda solo queda en la BD. Forma no garantizada.
 */
export type OtxDetalle = Record<string, unknown>

/** Estado de una fuente en /enrich (app/enrichment/service.py). Un fallo nunca es "sin evidencia". */
export type EstadoFuente =
  | 'con_evidencia'
  | 'sin_evidencia'
  | 'error'
  | 'limite_cuota'
  | 'no_soportado'
  | 'no_configurado'
  | 'omitido'
  | 'no_disponible'

export type Veredicto = 'malicioso' | 'sospechoso' | 'sin_evidencia' | 'benigno_conocido'

/** Resumen normalizado, igual para toda fuente (app/enrichment/providers/base.py). */
export interface ResumenFuente {
  tiene_evidencia: boolean
  veredicto: Veredicto
  familias: string[]
  etiquetas: string[]
  /** OTX: {pulses, pulses_masivos} · ThreatFox: {registros} · VirusTotal: {maliciosos, sospechosos, total}. */
  detecciones: Record<string, number> | null
  confianza: number | null
  primera_vez: string | null
  ultima_vez: string | null
  referencia_url: string | null
}

export interface FuenteEnriquecimiento {
  fuente: string
  etiqueta: string
  estado: EstadoFuente
  resumen: ResumenFuente | null
  error: string | null
  desde_cache: boolean
  latencia_ms: number | null
}

/** Respuesta de POST /indicators/{id}/enrich. `tiene_evidencia` y `detalle` son de OTX. */
export interface EnrichmentResponse {
  indicator_id: number
  fuente: string
  tiene_evidencia: boolean
  detalle: OtxDetalle
  fuentes: FuenteEnriquecimiento[]
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

export type NivelSeveridad = 'critica' | 'alta' | 'media' | 'baja' | 'benigno' | 'indeterminada'

/** app/reporting/severity.py: determinística, nunca la decide el LLM. */
export interface Severidad {
  nivel: NivelSeveridad
  motivos: string[]
}

export interface Concordancia {
  fuente: string
  etiqueta: string
  familias: string[]
  /** Entidades ATT&CK a las que resuelven esas familias. */
  entidades: string[]
  resultado: 'concuerda' | 'discrepa' | 'sugiere' | 'no_comparable'
}

export type TipoHallazgo = 'evidencia' | 'inferencia' | 'hipotesis'

/** Salida del LLM ya depurada contra el contexto (app/ai_component/schema.py). */
export interface AnalisisIA {
  resumen: string
  hallazgos: { afirmacion: string; tipo: TipoHallazgo; fuentes: string[] }[]
  tecnicas_destacadas: { id: string; motivo: string }[]
  investigacion_recomendada: string[]
  limitaciones: string[]
  informacion_faltante: string[]
}

/** Bloque del contexto enviado al modelo: E-COR, E-OTX, E-TF, E-VT o T####. */
export interface BloqueContexto {
  id: string
  titulo: string
  texto: string
}

/** Registro de trazabilidad del análisis (app/ai_component/service.py). */
export interface RegistroIA {
  estado: 'generado' | 'no_llamado' | 'fallido' | 'descartado'
  motivo: string | null
  analisis: AnalisisIA | null
  descartes: { seccion: string; texto: string; motivo: string }[]
  contexto: BloqueContexto[]
  prompt: string | null
  proveedor: string | null
  modelo: string | null
  latencia_ms: number | null
  tokens: { prompt: number | null; respuesta: number | null } | null
  intentos_fallidos: { proveedor: string; modelo: string; error: string }[]
}

export interface ReportMetadatos {
  severidad: Severidad
  concordancia: Concordancia[]
  fuentes: Pick<FuenteEnriquecimiento, 'fuente' | 'etiqueta' | 'estado' | 'resumen' | 'error'>[]
  ia: RegistroIA
}

/** ReportRead: `contenido` es Markdown; `metadatos` es null en informes previos a la Fase 4. */
export interface ReportRead {
  id: number
  indicator_id: number
  contenido: string
  nivel_confianza: number
  timestamp: string
  metadatos?: ReportMetadatos | null
}

export type Decision = 'aceptado' | 'rechazado'

/** Body de POST /reports/{id}/validate (HumanValidationRequest). */
export interface ValidationRequest {
  decision: Decision
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

/** GET /indicators/{id}: la investigación reconstruida desde lo persistido (solo lectura). */
export interface InvestigationSnapshot {
  indicator: IndicatorRead
  enrichment: EnrichmentResponse | null
  /** null si /correlate aún no se ejecutó. */
  correlation: CorrelationResponse | null
  reports: ReportRead[]
  validations: ValidationRead[]
}

/** GET /investigations: todas las investigaciones, en páginas de hasta 10. */
export interface InvestigationsPage {
  items: InvestigationSnapshot[]
  page: number
  size: number
  total: number
  pages: number
}

/** DELETE /indicators/{id}: filas borradas por tabla en la eliminación en cascada. */
export interface DeleteResponse {
  indicator_id: number
  valor: string
  eliminados: Record<string, number>
}

/** GET /status: qué fuentes y qué IA usará el pipeline. Sin secretos. */
export interface StatusResponse {
  fuentes: { fuente: string; etiqueta: string; configurada: boolean }[]
  /** Proveedor activo. El respaldo opera en el backend pero no se expone. */
  ia: { proveedor: string; modelo: string }
}
