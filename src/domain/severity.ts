import type {
  EstadoFuente,
  FuenteEnriquecimiento,
  NivelSeveridad,
  ReportMetadatos,
  TipoHallazgo,
  Veredicto,
} from '../api/types'
import { latestReport, type Investigation } from './investigation'

export const SEVERITY_LABEL: Record<NivelSeveridad, string> = {
  critica: 'Crítica',
  alta: 'Alta',
  media: 'Media',
  baja: 'Baja',
  benigno: 'Benigno conocido',
  indeterminada: 'Indeterminada',
}

/** Orden para listas de triaje: lo más grave primero. */
export const SEVERITY_RANK: Record<NivelSeveridad, number> = {
  critica: 0,
  alta: 1,
  media: 2,
  indeterminada: 3,
  baja: 4,
  benigno: 5,
}

export const ESTADO_FUENTE_LABEL: Record<EstadoFuente, string> = {
  con_evidencia: 'con registros',
  sin_evidencia: 'sin registros',
  error: 'no respondió',
  limite_cuota: 'límite de cuota',
  no_soportado: 'no aplica a este tipo',
  no_configurado: 'no configurada',
  omitido: 'omitida (IP no pública)',
  no_disponible: 'sin respuesta registrada',
}

export const VEREDICTO_LABEL: Record<Veredicto, string> = {
  malicioso: 'Malicioso',
  sospechoso: 'Sospechoso',
  sin_evidencia: 'Sin evidencia',
  benigno_conocido: 'Benigno conocido',
}

export const HALLAZGO_LABEL: Record<TipoHallazgo, string> = {
  evidencia: 'Evidencia',
  inferencia: 'Inferencia',
  hipotesis: 'Hipótesis',
}

/** Estados en los que la fuente debía responder y no lo hizo: nunca equivalen a "sin evidencia". */
const FALLIDOS: readonly EstadoFuente[] = ['error', 'limite_cuota', 'no_disponible']
/** Estados en los que la fuente no participa: no cuentan para la cobertura. */
const FUERA: readonly EstadoFuente[] = ['no_configurado', 'no_soportado', 'omitido']

export const isFailedSource = (estado: EstadoFuente): boolean => FALLIDOS.includes(estado)

export interface SourceCoverage {
  consultadas: number
  conDatos: number
  fallidas: FuenteEnriquecimiento[]
}

/** ¿Cuántas fuentes que debían responder respondieron? Base del aviso de análisis parcial. */
export function sourceCoverage(fuentes: readonly FuenteEnriquecimiento[]): SourceCoverage {
  const consultadas = fuentes.filter((f) => !FUERA.includes(f.estado))
  const fallidas = consultadas.filter((f) => isFailedSource(f.estado))
  return { consultadas: consultadas.length, conDatos: consultadas.length - fallidas.length, fallidas }
}

/** Metadatos del informe más reciente. null sin informe o si es anterior a la Fase 4. */
export function latestMetadatos(inv: Investigation): ReportMetadatos | null {
  return latestReport(inv)?.metadatos ?? null
}
