import type { ConclusionLote, FuenteEnriquecimiento, IndicatorTipo, Ingesta, SenalLote } from '../api/types'
import { detectType, refang } from './format'
import { isStepDone, type AutomaticStep, type Investigation, type StepId } from './investigation'
import { isFailedSource } from './severity'

/** Espejo de app/schemas/batch.py::MAX_INDICADORES_LOTE (el backend responde 422 si se pasa). */
export const MAX_INDICADORES_LOTE = 20
/** Indicadores en vuelo a la vez: el backend es síncrono y cada /enrich abre tres consultas. */
export const CONCURRENCIA_LOTE = 3
/**
 * Pasos de cada miembro. Sin informe individual: el informe conjunto hace una sola llamada al
 * LLM para todo el lote (con 20 informes, el límite de Groq obligaría a esperar minutos).
 */
export const PASOS_LOTE: readonly AutomaticStep[] = ['enrich', 'correlate']

export interface LineaLote {
  posicion: number
  entrada: string
  /** null: no se reconoce; se envía igual y el backend la registra como inválida. */
  tipo: IndicatorTipo | null
  /** Posición de la primera línea con el mismo valor. Aproximado: la forma canónica la decide el backend. */
  duplicadoDe: number | null
}

/** Un indicador por línea; las vacías se ignoran. Es la vista previa: el backend revalida todo. */
export function parseBlock(texto: string): LineaLote[] {
  const primera = new Map<string, number>()
  return texto
    .split(/\r?\n/)
    .map((linea) => linea.trim())
    .filter(Boolean)
    .map((entrada, i) => {
      const posicion = i + 1
      const tipo = detectType(entrada)
      // Como el backend: una URL conserva las mayúsculas de su path; lo demás no las distingue.
      const clave = tipo && (tipo === 'url' ? refang(entrada) : refang(entrada).toLowerCase())
      const duplicadoDe = clave ? (primera.get(clave) ?? null) : null
      if (clave && duplicadoDe === null) primera.set(clave, posicion)
      return { posicion, entrada, tipo, duplicadoDe }
    })
}

const PRIORIDAD: Record<string, number> = { hash: 0, url: 1, domain: 2, ip: 3 }

/**
 * Orden de proceso: hashes primero. VirusTotal admite 4 consultas/min y es la fuente que más
 * aporta en un hash (detecciones y familia); en dominios e IPs suelen bastar OTX y ThreatFox.
 */
export function ordenDeProceso(invs: readonly Investigation[]): Investigation[] {
  return invs.toSorted((a, b) => (PRIORIDAD[a.indicator.tipo] ?? 4) - (PRIORIDAD[b.indicator.tipo] ?? 4))
}

export const miembroListo = (inv: Investigation): boolean => PASOS_LOTE.every((paso) => isStepDone(inv, paso))

/** Fuentes que debían responder y no lo hicieron (cupo, error): nunca equivalen a "sin evidencia". */
export const fuentesFallidas = (inv: Investigation): FuenteEnriquecimiento[] =>
  (inv.enrichment?.fuentes ?? []).filter((f) => isFailedSource(f.estado))

export type EstadoPaso = 'pendiente' | 'en_curso' | 'hecho' | 'fallido'

interface Actividad {
  running: StepId | null
  failure: { step: StepId } | null
}

export function estadoPaso(inv: Investigation, actividad: Actividad, paso: StepId): EstadoPaso {
  if (actividad.running === paso) return 'en_curso'
  if (isStepDone(inv, paso)) return 'hecho'
  return actividad.failure?.step === paso ? 'fallido' : 'pendiente'
}

export const CONCLUSION_LABEL: Record<ConclusionLote, string> = {
  relacion_demostrable: 'Relación demostrable',
  sin_relacion_demostrable: 'Sin relación demostrable',
}

export const INGESTA_LABEL: Record<Ingesta, string> = {
  creado: 'Nuevo',
  existente: 'Reutilizado',
  duplicado: 'Duplicado',
  invalido: 'Inválido',
  eliminado: 'Eliminado',
}

export const SENAL_LABEL: Record<SenalLote['tipo'], string> = {
  pulse_compartido: 'Pulse compartido',
  infraestructura: 'Infraestructura',
  misma_entidad: 'Misma entidad',
}
