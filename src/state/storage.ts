import type { Investigation } from '../domain/investigation'

/**
 * Caché local de las investigaciones: se muestra al instante al abrir la app, mientras la
 * sincronización con el backend (fuente de verdad) la completa y depura.
 * localStorage puede no existir o lanzar (modo privado, cuota): nunca se propaga.
 */
const INVESTIGATIONS_KEY = 'nexo.investigations.v1'

// Si el último guardado del historial funcionó. Es estado externo a React: la UI lo lee
// con useSyncExternalStore para avisar al analista cuando el historial no persiste.
let historyPersisted = true
const listeners = new Set<() => void>()

export function subscribeHistoryPersisted(listener: () => void): () => void {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export const isHistoryPersisted = (): boolean => historyPersisted

function read(key: string): string | null {
  try {
    return window.localStorage.getItem(key)
  } catch {
    return null
  }
}

function write(key: string, value: string): boolean {
  try {
    window.localStorage.setItem(key, value)
    return true
  } catch {
    return false
  }
}

const isRecord = (value: unknown): value is Record<string, unknown> =>
  value !== null && typeof value === 'object'

function isInvestigation(value: unknown): value is Investigation {
  if (!isRecord(value) || !isRecord(value.indicator)) return false
  const { indicator } = value
  return (
    typeof indicator.id === 'number' &&
    typeof indicator.valor === 'string' &&
    typeof indicator.tipo === 'string' &&
    typeof value.entrada === 'string' &&
    Array.isArray(value.reports) &&
    Array.isArray(value.validations)
  )
}

export function loadInvestigations(): Investigation[] {
  const raw = read(INVESTIGATIONS_KEY)
  if (!raw) return []
  try {
    const parsed: unknown = JSON.parse(raw)
    return Array.isArray(parsed) ? parsed.filter(isInvestigation) : []
  } catch {
    return []
  }
}

export function saveInvestigations(items: Investigation[]): boolean {
  const ok = write(INVESTIGATIONS_KEY, JSON.stringify(items))
  if (ok !== historyPersisted) {
    historyPersisted = ok
    listeners.forEach((listener) => listener())
  }
  return ok
}
