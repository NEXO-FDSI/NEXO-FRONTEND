import { describe, expect, it } from 'vitest'
import { confidenceLevel } from './confidence'
import { formatDateTime, formatPercent, indicatorTypeLabel, truncateMiddle } from './format'

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
