import type { IndicatorTipo } from '../api/types'

const DATE_TIME = new Intl.DateTimeFormat('es-CO', { dateStyle: 'medium', timeStyle: 'short' })

export function formatDateTime(iso: string | null | undefined): string {
  if (!iso) return '—'
  const date = new Date(iso)
  return Number.isNaN(date.getTime()) ? iso : DATE_TIME.format(date)
}

export function formatPercent(value: number | null | undefined): string {
  return value == null ? '—' : `${Math.round(value * 100)} %`
}

/** Acorta hashes y URLs largos conservando inicio y fin, que es lo que el analista compara. */
export function truncateMiddle(value: string, max = 28): string {
  if (value.length <= max) return value
  const side = Math.floor((max - 1) / 2)
  return `${value.slice(0, side)}…${value.slice(-side)}`
}

export interface IndicatorTypeInfo {
  tipo: IndicatorTipo
  label: string
  placeholder: string
}

/** Tipos que acepta POST /indicators (IndicatorTipo en el backend). */
export const INDICATOR_TYPES: readonly IndicatorTypeInfo[] = [
  { tipo: 'ip', label: 'IP', placeholder: '203.0.113.7 · 2001:db8::1' },
  { tipo: 'domain', label: 'Dominio', placeholder: 'evil[.]example.com' },
  { tipo: 'hash', label: 'Hash', placeholder: 'MD5, SHA-1 o SHA-256' },
  { tipo: 'url', label: 'URL', placeholder: 'hxxp://evil[.]example.com/payload' },
]

export function indicatorTypeLabel(tipo: string): string {
  return INDICATOR_TYPES.find((t) => t.tipo === tipo)?.label ?? tipo
}
