import { API_URL } from '../config'

export type ApiErrorKind = 'network' | 'timeout' | 'http' | 'unknown'

/** Forma serializable de un fallo: es lo que guarda el estado y lo que muestra la UI. */
export interface ErrorInfo {
  kind: ApiErrorKind
  status: number | null
  message: string
}

export class ApiError extends Error {
  readonly kind: ApiErrorKind
  readonly status: number | null

  constructor(kind: ApiErrorKind, message: string, status: number | null = null) {
    super(message)
    this.name = 'ApiError'
    this.kind = kind
    this.status = status
  }
}

const DEFAULT_TIMEOUT_MS = 30_000

// Un 500 del backend sale sin cabeceras CORS (ServerErrorMiddleware va por fuera de
// CORSMiddleware), así que el navegador lo reporta igual que un backend caído.
const NETWORK_MESSAGE =
  'No se pudo contactar al backend. Puede estar caído o haber fallado con un error interno (500).'

interface RequestOptions {
  body?: unknown
  timeoutMs?: number
}

export async function request<T>(
  method: 'GET' | 'POST',
  path: string,
  { body, timeoutMs = DEFAULT_TIMEOUT_MS }: RequestOptions = {},
): Promise<T> {
  const controller = new AbortController()
  const timer = setTimeout(() => controller.abort(), timeoutMs)
  try {
    let response: Response
    try {
      response = await fetch(`${API_URL}${path}`, {
        method,
        headers: body === undefined ? undefined : { 'Content-Type': 'application/json' },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      })
    } catch {
      if (controller.signal.aborted) {
        throw new ApiError('timeout', `El backend no respondió en ${Math.round(timeoutMs / 1000)} s.`)
      }
      throw new ApiError('network', NETWORK_MESSAGE)
    }

    const payload = parseJson(await response.text())
    if (!response.ok) {
      throw new ApiError('http', describeDetail(payload, response.status), response.status)
    }
    if (payload === undefined) {
      throw new ApiError('http', 'El backend devolvió una respuesta que no es JSON.', response.status)
    }
    return payload as T
  } finally {
    clearTimeout(timer)
  }
}

function parseJson(text: string): unknown {
  try {
    return JSON.parse(text)
  } catch {
    return undefined
  }
}

interface ValidationItem {
  loc?: unknown
  msg?: unknown
}

/** `detail` de FastAPI: string (HTTPException) o lista de errores de validación (422). */
export function describeDetail(payload: unknown, status: number): string {
  const detail = (payload as { detail?: unknown } | null | undefined)?.detail
  if (typeof detail === 'string' && detail) return detail
  if (Array.isArray(detail) && detail.length > 0) {
    return detail.map((item: ValidationItem) => describeValidationItem(item)).join(' · ')
  }
  return `El backend respondió con estado ${status}.`
}

function describeValidationItem({ loc, msg }: ValidationItem): string {
  // Pydantic antepone "Value error, " a los ValueError del model_validator.
  const message = String(msg ?? 'Valor inválido').replace(/^Value error, /, '')
  const field = Array.isArray(loc) ? loc.at(-1) : undefined
  return typeof field === 'string' && field !== 'body' ? `${field}: ${message}` : message
}

export function toErrorInfo(error: unknown): ErrorInfo {
  if (error instanceof ApiError) {
    return { kind: error.kind, status: error.status, message: error.message }
  }
  return { kind: 'unknown', status: null, message: 'Ocurrió un error inesperado en la interfaz.' }
}
