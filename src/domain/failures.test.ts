import { describe, expect, it } from 'vitest'
import type { ErrorInfo } from '../api/http'
import { describeFailure } from './failures'

const http = (status: number, message = 'detalle del backend'): ErrorInfo => ({ kind: 'http', status, message })

describe('describeFailure', () => {
  it('explica que un fallo de red puede ser un 500 sin cabeceras CORS', () => {
    const { title, hint } = describeFailure('enrich', { kind: 'network', status: null, message: '' })
    expect(title).toBe('Backend inaccesible')
    expect(hint).toMatch(/CORS/)
  })

  it('recuerda que un informe lento puede haberse guardado igual', () => {
    const timeout: ErrorInfo = { kind: 'timeout', status: null, message: 'El backend no respondió en 30 s.' }
    expect(describeFailure('report', timeout).hint).toMatch(/LLM/)
    expect(describeFailure('correlate', timeout)).toEqual({
      title: 'Tiempo de espera agotado al correlacionar con ATT&CK',
      hint: 'El backend no respondió en 30 s.',
    })
  })

  it('nunca presenta un 502 como "sin evidencia"', () => {
    const { title, hint } = describeFailure('enrich', http(502, 'El servicio de reputación no respondió'))
    expect(title).toBe('No se pudo verificar la reputación')
    expect(hint).toMatch(/NO significa "sin evidencia"/)
  })

  it.each([
    [404, 'El recurso ya no existe en el backend'],
    [400, 'Falta un paso previo'],
    [422, 'Datos inválidos'],
    [500, 'No se pudo registrar la validación'],
  ])('traduce el estado %i', (status, title) => {
    expect(describeFailure('validate', http(status)).title).toBe(title)
  })
})
