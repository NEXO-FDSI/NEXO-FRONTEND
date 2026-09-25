import { vi } from 'vitest'

/** Respuesta simulada; un Error hace que fetch rechace, como un backend caído o un 500 sin CORS. */
export type Reply = { status: number; body?: unknown } | Error
type Route = Reply | ((request: { body: unknown }) => Reply | Promise<Reply>)

export const reply = (status: number, body?: unknown): Reply => ({ status, body })
export const fail = (status: number, detail: unknown): Reply => ({ status, body: { detail } })

export interface BackendCall {
  method: string
  path: string
  body: unknown
}

/**
 * Sustituye fetch por un NEXO-BACKEND en memoria: rutas "MÉTODO /path" → respuesta.
 * Una ruta no declarada responde 404 como FastAPI.
 */
export function mockBackend(routes: Record<string, Route>) {
  const calls: BackendCall[] = []
  const fetchMock = vi.fn(async (input: RequestInfo | URL, init?: RequestInit) => {
    const url = new URL(String(input))
    const method = init?.method ?? 'GET'
    const body = typeof init?.body === 'string' ? JSON.parse(init.body) : undefined
    calls.push({ method, path: url.pathname, body })

    const route = routes[`${method} ${url.pathname}`] ?? fail(404, 'Not Found')
    const result = typeof route === 'function' ? await route({ body }) : route
    if (result instanceof Error) throw result
    return new Response(result.body === undefined ? '' : JSON.stringify(result.body), {
      status: result.status,
      headers: { 'Content-Type': 'application/json' },
    })
  })
  vi.stubGlobal('fetch', fetchMock)
  return { calls, fetchMock, paths: () => calls.map((c) => `${c.method} ${c.path}`) }
}

/** Promesa controlable desde el test, para observar estados intermedios ("cargando"). */
export function deferred<T>() {
  let resolve!: (value: T) => void
  const promise = new Promise<T>((r) => {
    resolve = r
  })
  return { promise, resolve }
}
