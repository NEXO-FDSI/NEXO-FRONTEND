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
  /** IDs ATT&CK que la fuente cita directamente (OTX `attack_ids`). Ausente en cachés antiguas. */
  tecnicas_attck?: string[]
  /** Referencias externas de la fuente: solo http(s), máx. 5. Ausente en cachés antiguas. */
  referencias?: string[]
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

/**
 * Respuesta de POST /indicators/{id}/enrich. `tiene_evidencia` es combinado (alguna fuente lo
 * encontró); `detalle` es OTX recortado ({} si OTX no respondió).
 */
export interface EnrichmentResponse {
  indicator_id: number
  fuente: string
  tiene_evidencia: boolean
  /** "parcial" si alguna fuente no se pudo verificar. */
  cobertura?: 'completa' | 'parcial'
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
  /** Procedencia: fuentes (`fuente_api`) que sustentan la entidad de la que sale la técnica. */
  fuentes?: string[]
  /** Fuentes que además citan este ID de ATT&CK directamente. */
  reportada_por?: string[]
}

/** Respuesta de POST /indicators/{id}/correlate. Sin entidad: todo null y `tecnicas: []`. */
export interface CorrelationResponse {
  indicator_id: number
  resuelto: boolean
  entity: EntityRef | null
  confianza: number | null
  evidencia: string | null
  /** Fuentes que respaldan la entidad (app/correlation/service.py). */
  fuentes?: string[]
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

/** app/reporting/severity.py::detectar_contradicciones. */
export interface Contradiccion {
  tipo: 'entidad_distinta' | 'vt_limpio' | 'lista_blanca'
  fuentes: string[]
  detalle: string
}

export type NivelConfianza = 'alta' | 'media' | 'baja' | 'sin_evidencia'

/** app/reporting/severity.py::calcular_confianza: regla determinística con su justificación. */
export interface ConfianzaInforme {
  nivel: NivelConfianza
  motivos: string[]
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
  /**
   * Cómo se eligieron las técnicas del contexto: por afinidad semántica (embeddings) con la
   * evidencia o, si no hubo embedding, repartidas por táctica. Ausente en informes anteriores.
   */
  seleccion?: SeleccionTecnicas | null
}

export interface SeleccionTecnicas {
  metodo: 'semantica' | 'por_tactica'
  consulta: string
  motivo: string | null
  /** Similitud coseno (0-1) de cada técnica de la entidad con la consulta. */
  puntajes: Record<string, number>
}

export interface ReportMetadatos {
  severidad: Severidad
  /** Ausentes en informes anteriores a la combinación de fuentes. */
  confianza?: ConfianzaInforme
  contradicciones?: Contradiccion[]
  cobertura?: 'completa' | 'parcial'
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

// --- Lotes (Fase 7): app/schemas/batch.py, app/api/batches.py, app/correlation/lote.py ---

/**
 * Ítem de POST /batches. Laxo a propósito: `tipo: null` (no reconocido) o un valor inválido
 * no tumban el lote; el backend lo registra como `invalido` con su motivo.
 */
export interface ItemLote {
  tipo: IndicatorTipo | null
  valor: string
}

/** Body de POST /batches: de 2 a 20 ítems. */
export interface BatchCreate {
  nombre: string | null
  indicadores: ItemLote[]
}

export type Ingesta = 'creado' | 'existente' | 'duplicado' | 'invalido' | 'eliminado'

export interface BatchRead {
  id: number
  nombre: string | null
  timestamp: string
}

/** Cada entrada pegada, en orden; `indicator_id` es null si se descartó o se eliminó. */
export interface BatchItem {
  posicion: number
  entrada: string
  tipo: string | null
  ingesta: Ingesta
  indicator_id: number | null
  valor: string | null
  motivo: string | null
}

export interface BatchCreated {
  batch: BatchRead
  items: BatchItem[]
  resumen: { creados: number; existentes: number; duplicados: number; invalidos: number }
}

export type ConclusionLote = 'relacion_demostrable' | 'sin_relacion_demostrable'

/** GET /batches. `decision`: la vigente del último informe (null = pendiente o sin informe). */
export interface BatchSummary extends BatchRead {
  indicadores: number
  descartados: number
  ultimo_informe: { id: number; conclusion: ConclusionLote; timestamp: string } | null
  decision: string | null
}

/** Solo participan en vínculos los miembros con entidad resuelta. */
export type EstadoMiembro = 'participa' | 'sin_entidad' | 'sin_correlacionar' | 'sin_enriquecer'

export interface MiembroLote {
  ref: string // I1, I2… en el orden del lote
  indicator_id: number
  tipo: string
  valor: string
  ingesta: Ingesta
  estado: EstadoMiembro
  entidad: EntityRef | null
  asociacion: number | null
  severidad: Severidad | null
  confianza: ConfianzaInforme | null
  contradicciones: Contradiccion[]
  cobertura: 'completa' | 'parcial' | null
  fuentes: Pick<FuenteEnriquecimiento, 'fuente' | 'etiqueta' | 'estado'>[]
}

export interface SenalLote {
  tipo: 'pulse_compartido' | 'infraestructura' | 'misma_entidad'
  fuerza: 'fuerte' | 'contextual'
  origen: 'alienvault_otx' | 'estructura' | 'correlacion_nexo'
  detalle: string
  /** pulse_compartido: hasta 5 pulses. El nombre es texto libre de terceros. */
  pulses?: { id: string; nombre: string | null; indicadores: number | null }[]
  entity_id?: number
}

export type ConfianzaVinculo = 'alta' | 'media' | 'baja'

export interface VinculoLote {
  id: string // V1, V2…
  a: string
  b: string
  confianza: ConfianzaVinculo
  senales: SenalLote[]
}

export interface AgrupacionLote {
  id: string // A1, A2…
  indicadores: string[]
  vinculos: string[]
  confianza: 'alta' | 'media'
  tecnicas_comunes: string[]
}

/** Correlación entre los indicadores del lote: determinística, calculada al vuelo en el GET. */
export interface CorrelacionLote {
  indicadores: MiembroLote[]
  vinculos: VinculoLote[]
  agrupaciones: AgrupacionLote[]
  conclusion: {
    nivel: ConclusionLote
    texto: string
    entidad_comun: string[]
    aislados: string[]
    no_participan: string[]
  }
  cobertura: {
    nivel: 'completa' | 'parcial'
    validos: number
    participan: number
    descartados: number
    sin_entidad: string[]
    sin_correlacionar: string[]
    sin_enriquecer: string[]
    fuentes: { fuente: string; etiqueta: string; verificados: string[]; sin_verificar: string[] }[]
  }
  /** Técnicas documentadas por táctica, en orden ATT&CK. Compartir técnicas NO es una señal. */
  cadena_ataque: {
    tactica: string
    tecnicas: { id: string; nombre: string; indicadores: string[]; entidades: string[]; varias_entidades: boolean }[]
  }[]
}

/** Una versión del informe conjunto (POST /batches/{id}/report). */
export interface BatchReportRead {
  id: number
  batch_id: number
  contenido: string
  conclusion: ConclusionLote
  metadatos: { correlacion: CorrelacionLote; descartados: Omit<BatchItem, 'tipo' | 'indicator_id' | 'valor'>[]; ia: RegistroIA } | null
  timestamp: string
}

export interface BatchValidationRead {
  id: number
  batch_report_id: number
  decision: string
  analista: string | null
  timestamp: string
}

/** GET /batches/{id}: las investigaciones tienen la forma de GET /indicators/{id}. */
export interface BatchDetail {
  batch: BatchRead
  items: BatchItem[]
  investigaciones: InvestigationSnapshot[]
  correlacion: CorrelacionLote
  informes: BatchReportRead[]
  validaciones: BatchValidationRead[]
}
