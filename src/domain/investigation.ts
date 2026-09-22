import type {
  CorrelationResponse,
  Decision,
  IndicatorRead,
  OtxDetalle,
  ReportRead,
  ValidationRead,
} from '../api/types'
import type { OtxSummary } from './otx'

export interface EnrichmentSnapshot {
  fuente: string
  tiene_evidencia: boolean
  resumen: OtxSummary
  /** Respuesta cruda de OTX. Solo vive en memoria: no se persiste en el navegador. */
  detalle?: OtxDetalle
}

/**
 * Una investigación = un indicador y lo que el backend devolvió en cada paso.
 * El backend no expone endpoints de consulta (GET), así que este es el único
 * registro que la interfaz tiene de los resultados.
 */
export interface Investigation {
  indicator: IndicatorRead
  /** Valor tal como lo escribió el analista, antes de la normalización del backend. */
  entrada: string
  enrichment: EnrichmentSnapshot | null
  correlation: CorrelationResponse | null
  reports: ReportRead[]
  validations: ValidationRead[]
  /** El backend respondió 404: el indicador o informe ya no existe (p. ej. BD reiniciada). */
  missing: boolean
}

export type StepId = 'ingest' | 'enrich' | 'correlate' | 'report' | 'validate'
export type AutomaticStep = Extract<StepId, 'enrich' | 'correlate' | 'report'>

export interface StepDefinition {
  id: StepId
  label: string
  description: string
  /** Paso que el backend exige antes (400 si no se cumplió). */
  requires: StepId | null
}

export const PIPELINE_STEPS: readonly StepDefinition[] = [
  { id: 'ingest', label: 'Ingesta', description: 'Normalización y validación', requires: null },
  { id: 'enrich', label: 'Enriquecimiento', description: 'Reputación en AlienVault OTX', requires: 'ingest' },
  { id: 'correlate', label: 'Correlación', description: 'Entidad y técnicas MITRE ATT&CK', requires: 'enrich' },
  { id: 'report', label: 'Informe', description: 'Análisis grounded (LLM + RAG)', requires: 'enrich' },
  { id: 'validate', label: 'Validación', description: 'Decisión del analista', requires: 'report' },
]

/** Pasos que la interfaz puede encadenar sin intervención humana. */
export const AUTOMATIC_STEPS: readonly AutomaticStep[] = ['enrich', 'correlate', 'report']

export const isAutomaticStep = (step: StepId): step is AutomaticStep =>
  (AUTOMATIC_STEPS as readonly StepId[]).includes(step)

export function latestReport(inv: Investigation): ReportRead | null {
  return inv.reports.at(-1) ?? null
}

/** Historial de decisiones de un informe, la más reciente primero. */
export function validationsFor(inv: Investigation, reportId: number): ValidationRead[] {
  return inv.validations.filter((v) => v.report_id === reportId).toReversed()
}

export function currentDecision(inv: Investigation, reportId: number): Decision | null {
  const decision = validationsFor(inv, reportId)[0]?.decision
  return decision === 'aceptado' || decision === 'rechazado' ? decision : null
}

export function isStepDone(inv: Investigation, step: StepId): boolean {
  switch (step) {
    case 'ingest':
      return true
    case 'enrich':
      return inv.enrichment !== null
    case 'correlate':
      return inv.correlation !== null
    case 'report':
      return inv.reports.length > 0
    case 'validate': {
      const report = latestReport(inv)
      return report !== null && currentDecision(inv, report.id) !== null
    }
  }
}

export function canRunStep(inv: Investigation, step: StepId): boolean {
  const requires = PIPELINE_STEPS.find((s) => s.id === step)?.requires
  return requires == null || isStepDone(inv, requires)
}

export type InvestigationStatus =
  | 'registrado'
  | 'enriquecido'
  | 'correlacionado'
  | 'pendiente'
  | 'aceptado'
  | 'rechazado'

export const STATUS_LABEL: Record<InvestigationStatus, string> = {
  registrado: 'Registrado',
  enriquecido: 'Enriquecido',
  correlacionado: 'Correlacionado',
  pendiente: 'Pendiente de validación',
  aceptado: 'Aceptado',
  rechazado: 'Rechazado',
}

export function investigationStatus(inv: Investigation): InvestigationStatus {
  const report = latestReport(inv)
  if (report) return currentDecision(inv, report.id) ?? 'pendiente'
  if (inv.correlation) return 'correlacionado'
  if (inv.enrichment) return 'enriquecido'
  return 'registrado'
}

/**
 * Investigación local que corresponde a lo que el analista acaba de escribir.
 * Sirve para el 409: la API no devuelve el id del indicador ya registrado.
 * Se compara sin distinguir mayúsculas salvo en URLs, cuyo path sí las distingue
 * (el backend solo baja a minúsculas el esquema y el host).
 */
export function findByInput(
  investigations: Investigation[],
  tipo: string,
  entrada: string,
): Investigation | undefined {
  const key = (value: string) => (tipo === 'url' ? value : value.toLowerCase())
  const wanted = key(entrada)
  return investigations.find(
    (inv) => inv.indicator.tipo === tipo && (key(inv.entrada) === wanted || key(inv.indicator.valor) === wanted),
  )
}
