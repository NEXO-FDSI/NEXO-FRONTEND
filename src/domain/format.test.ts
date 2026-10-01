import { describe, expect, it } from 'vitest'
import { confidenceLevel } from './confidence'
import { detectType, formatDateTime, formatPercent, indicatorTypeLabel, truncateMiddle } from './format'

describe('formatos', () => {
  it('formatea fechas ISO y conserva valores ilegibles', () => {
    expect(formatDateTime('2026-09-22T17:51:20Z')).toMatch(/2026/)
    expect(formatDateTime('no-es-fecha')).toBe('no-es-fecha')
    expect(formatDateTime(null)).toBe('—')
  })

  it('formatea porcentajes', () => {
    expect(formatPercent(0.9)).toBe('90 %')
    expect(formatPercent(null)).toBe('—')
  })

  it('acorta por el medio solo lo que excede el máximo', () => {
    expect(truncateMiddle('corto')).toBe('corto')
    expect(truncateMiddle('abcdefghijklmnop', 9)).toBe('abcd…mnop')
  })

  it('traduce el tipo de indicador y deja pasar tipos desconocidos', () => {
    expect(indicatorTypeLabel('domain')).toBe('Dominio')
    expect(indicatorTypeLabel('email')).toBe('email')
  })
})

describe('confidenceLevel', () => {
  it.each([
    [0.9, 'alta'],
    [0.6, 'media'],
    [0.3, 'baja'],
    [0, 'nula'],
    [null, 'nula'],
    [undefined, 'nula'],
  ])('%s → %s', (value, level) => {
    expect(confidenceLevel(value)).toBe(level)
  })
})

describe('detectType', () => {
  it.each([
    ['8.8.8.8', 'ip'],
    ['2001:db8::1', 'ip'],
    ['203[.]0[.]113[.]7', 'ip'],
    ['24d004a104d4d54034dbcffc2a4b19a11f39008a575aa614ea04703480b1022c', 'hash'],
    ['D41D8CD98F00B204E9800998ECF8427E', 'hash'],
    ['5ff465afaabcbf0150d1a3ab2c2e74f3a4426467', 'hash'],
    ['ervsystem.com', 'domain'],
    ['evil[.]example[dot]com', 'domain'],
    ['hxxp://evil[.]example.com/payload', 'url'],
    ['https://a.com/x?y=1', 'url'],
  ])('%s → %s', (value, tipo) => {
    expect(detectType(value)).toBe(tipo)
  })

  it.each(['', 'no-es-ip', '999.1.1.1', 'abc123', '-malo.com', 'dominio'])('%s no se reconoce', (value) => {
    expect(detectType(value)).toBeNull()
  })
})
