import { describe, expect, it, vi } from 'vitest'
import { fail, mockBackend, reply } from '../test/fakeBackend'
import { ApiError, describeDetail, request, toErrorInfo } from './http'

describe('request', () => {
  it('envía JSON y devuelve el cuerpo parseado', async () => {
    const { calls, fetchMock } = mockBackend({ 'POST /indicators': reply(201, { id: 7 }) })

    await expect(request('POST', '/indicators', { body: { tipo: 'ip' } })).resolves.toEqual({ id: 7 })

    expect(calls).toEqual([{ method: 'POST', path: '/indicators', body: { tipo: 'ip' } }])
    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toEqual({ 'Content-Type': 'application/json' })
  })

  it('no manda cabeceras ni cuerpo cuando no hay body', async () => {
    const { fetchMock } = mockBackend({ 'GET /health': reply(200, { status: 'ok' }) })

    await request('GET', '/health')

    const init = fetchMock.mock.calls[0][1] as RequestInit
    expect(init.headers).toBeUndefined()
    expect(init.body).toBeUndefined()
  })

  it('convierte un error HTTP en ApiError con el detail del backend', async () => {
    mockBackend({ 'POST /indicators/9/enrich': fail(404, 'Indicador no encontrado') })

    const error = await request('POST', '/indicators/9/enrich').catch((e: unknown) => e)

    expect(error).toBeInstanceOf(ApiError)
    expect(error).toMatchObject({ kind: 'http', status: 404, message: 'Indicador no encontrado' })
  })

  it('reporta un fallo de red (backend caído o 500 sin CORS)', async () => {
    mockBackend({ 'GET /health': new TypeError('Failed to fetch') })

    await expect(request('GET', '/health')).rejects.toMatchObject({ kind: 'network', status: null })
  })

  it('aborta y reporta timeout cuando el backend no responde a tiempo', async () => {
    vi.useFakeTimers()
    vi.stubGlobal(
      'fetch',
      vi.fn(
        (_url: string, init: RequestInit) =>
          new Promise((_resolve, reject) => {
            init.signal?.addEventListener('abort', () => reject(new DOMException('aborted', 'AbortError')))
          }),
      ),
    )

    const pending = request('POST', '/indicators/1/report', { timeoutMs: 2_000 }).catch((e: unknown) => e)
    await vi.advanceTimersByTimeAsync(2_000)

    expect(await pending).toMatchObject({ kind: 'timeout', message: 'El backend no respondió en 2 s.' })
  })

  it('rechaza una respuesta exitosa que no es JSON', async () => {
    vi.stubGlobal('fetch', vi.fn(async () => new Response('<html>', { status: 200 })))

    await expect(request('GET', '/health')).rejects.toMatchObject({ kind: 'http', status: 200 })
  })
})

describe('describeDetail', () => {
  it('formatea los errores de validación de FastAPI (422)', () => {
    const payload = {
      detail: [
        { loc: ['body'], msg: "Value error, 'x' no tiene formato válido de tipo 'ip'" },
        { loc: ['body', 'tipo'], msg: "Input should be 'ip', 'domain', 'hash' or 'url'" },
        { loc: 'raro' },
      ],
    }

    expect(describeDetail(payload, 422)).toBe(
      "'x' no tiene formato válido de tipo 'ip' · tipo: Input should be 'ip', 'domain', 'hash' or 'url' · Valor inválido",
    )
  })

  it.each([null, undefined, 'texto', { detail: '' }, { detail: [] }, { detail: 5 }])(
    'usa un mensaje genérico cuando no hay detail útil (%j)',
    (payload) => {
      expect(describeDetail(payload, 500)).toBe('El backend respondió con estado 500.')
    },
  )
})

describe('toErrorInfo', () => {
  it('conserva los datos de un ApiError', () => {
    expect(toErrorInfo(new ApiError('http', 'boom', 502))).toEqual({ kind: 'http', status: 502, message: 'boom' })
  })

  it('oculta los detalles de un error desconocido', () => {
    expect(toErrorInfo(new Error('interno'))).toEqual({
      kind: 'unknown',
      status: null,
      message: 'Ocurrió un error inesperado en la interfaz.',
    })
  })
})
