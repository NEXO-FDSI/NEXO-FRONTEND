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

const DEFANG: readonly [RegExp, string][] = [
  [/\[\.\]|\(\.\)|\[dot\]/gi, '.'],
  [/\[:\]/g, ':'],
  [/^hxxp/i, 'http'],
]
const IPV4 = /^(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)(\.(25[0-5]|2[0-4]\d|1\d\d|[1-9]?\d)){3}$/
const IPV6 = /^[0-9a-f:]+$/i
const HASH = /^([0-9a-f]{32}|[0-9a-f]{40}|[0-9a-f]{64})$/i
const DOMAIN = /^(?!-)[a-z0-9-]{1,63}(?<!-)(\.(?!-)[a-z0-9-]{1,63}(?<!-))*\.[a-z]{2,}$/i

/**
 * Tipo probable de un IoC pegado por el analista, para preseleccionarlo en el formulario.
 * Es solo una ayuda: el backend normaliza y valida, y el analista puede cambiar el tipo.
 */
export function detectType(input: string): IndicatorTipo | null {
  const value = DEFANG.reduce((v, [pattern, replacement]) => v.replace(pattern, replacement), input.trim())
  if (/^https?:\/\//i.test(value)) return 'url'
  if (IPV4.test(value) || (value.split(':').length > 2 && IPV6.test(value))) return 'ip'
  if (HASH.test(value)) return 'hash'
  if (DOMAIN.test(value)) return 'domain'
  return null
}
