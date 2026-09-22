/**
 * Lectura defensiva de la respuesta cruda de AlienVault OTX (`detalle` de /enrich).
 * OTX no garantiza la forma: todo campo ausente o de otro tipo cae a un valor vacío,
 * igual que hace el backend con sus `.get()` encadenados.
 */

// Espejo de MAX_INDICADORES_PULSE en app/correlation/service.py del backend: un pulse con
// más indicadores es un volcado agregado y la correlación lo descarta. Aquí solo se
// señala en pantalla para que el analista entienda la evidencia.
export const MAX_INDICADORES_PULSE = 1000

export interface OtxPulse {
  id: string
  name: string
  created: string | null
  indicatorCount: number | null
  tags: string[]
  malwareFamilies: string[]
  masivo: boolean
}

export interface OtxValidation {
  source: string
  name: string
  message: string
}

export interface OtxSummary {
  tipo: string | null
  pulseCount: number
  pulses: OtxPulse[]
  validations: OtxValidation[]
}

type Json = Record<string, unknown>

const asRecord = (value: unknown): Json =>
  value !== null && typeof value === 'object' && !Array.isArray(value) ? (value as Json) : {}
const asArray = (value: unknown): unknown[] => (Array.isArray(value) ? value : [])
const asString = (value: unknown): string | null =>
  typeof value === 'string' && value.trim() ? value : null
const asNumber = (value: unknown): number | null =>
  typeof value === 'number' && Number.isFinite(value) ? value : null

const strings = (values: unknown[]): string[] =>
  values.map(asString).filter((v): v is string => v !== null)

function toPulse(raw: unknown, index: number): OtxPulse {
  const pulse = asRecord(raw)
  const indicatorCount = asNumber(pulse.indicator_count)
  return {
    id: asString(pulse.id) ?? `pulse-${index}`,
    name: asString(pulse.name) ?? '(pulse sin nombre)',
    created: asString(pulse.created),
    indicatorCount,
    tags: strings(asArray(pulse.tags)),
    // El backend acepta tanto {display_name} como el string suelto.
    malwareFamilies: strings(
      asArray(pulse.malware_families).map((f) => asRecord(f).display_name ?? f),
    ),
    masivo: (indicatorCount ?? 0) > MAX_INDICADORES_PULSE,
  }
}

function toValidation(raw: unknown): OtxValidation {
  const item = asRecord(raw)
  return {
    source: asString(item.source) ?? 'otx',
    name: asString(item.name) ?? 'Validación OTX',
    message: asString(item.message) ?? '',
  }
}

export function summarizeOtx(detalle: unknown): OtxSummary {
  const root = asRecord(detalle)
  const pulseInfo = asRecord(root.pulse_info)
  return {
    tipo: asString(root.type),
    pulseCount: asNumber(pulseInfo.count) ?? 0,
    pulses: asArray(pulseInfo.pulses).map(toPulse),
    validations: asArray(root.validation).map(toValidation),
  }
}
