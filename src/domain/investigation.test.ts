import { describe, expect, it } from 'vitest'
import {
  acceptedValidation,
  investigation,
  WANNACRY_HASH,
  wannacryCorrelation,
  wannacryReport,
  wannacrySnapshot,
} from '../test/fixtures'
import {
  canRunStep,
  currentDecision,
  findByInput,
  investigationStatus,
  isAutomaticStep,
  isStepDone,
  validationsFor,
} from './investigation'

const enriched = investigation({ enrichment: wannacrySnapshot })
const reported = investigation({ enrichment: wannacrySnapshot, correlation: wannacryCorrelation, reports: [wannacryReport] })

describe('pasos del pipeline', () => {
  it('solo habilita un paso cuando el backend ya tiene el que exige', () => {
    const fresh = investigation()
    expect(canRunStep(fresh, 'ingest')).toBe(true)
    expect(canRunStep(fresh, 'enrich')).toBe(true)
    expect(canRunStep(fresh, 'correlate')).toBe(false)
    expect(canRunStep(fresh, 'report')).toBe(false)
    expect(canRunStep(enriched, 'correlate')).toBe(true)
    expect(canRunStep(enriched, 'report')).toBe(true)
    expect(canRunStep(enriched, 'validate')).toBe(false)
    expect(canRunStep(reported, 'validate')).toBe(true)
  })

  it('da por hecha la validación solo con una decisión sobre el último informe', () => {
    expect(isStepDone(investigation(), 'ingest')).toBe(true)
    expect(isStepDone(reported, 'validate')).toBe(false)
    expect(isStepDone({ ...reported, validations: [acceptedValidation] }, 'validate')).toBe(true)
    expect(isStepDone({ ...investigation(), validations: [acceptedValidation] }, 'validate')).toBe(false)
  })

  it('distingue los pasos automáticos de los que requieren al analista', () => {
    expect(isAutomaticStep('report')).toBe(true)
    expect(isAutomaticStep('validate')).toBe(false)
    expect(isAutomaticStep('ingest')).toBe(false)
  })
})

describe('estado de la investigación', () => {
  it('avanza con cada resultado del backend', () => {
    expect(investigationStatus(investigation())).toBe('registrado')
    expect(investigationStatus(enriched)).toBe('enriquecido')
    expect(investigationStatus({ ...enriched, correlation: wannacryCorrelation })).toBe('correlacionado')
    expect(investigationStatus(reported)).toBe('pendiente')
    expect(investigationStatus({ ...reported, validations: [acceptedValidation] })).toBe('aceptado')
  })

  it('toma la decisión más reciente e ignora decisiones desconocidas', () => {
    const rejected = { ...acceptedValidation, id: 2, decision: 'rechazado' }
    const withHistory = { ...reported, validations: [acceptedValidation, rejected] }

    expect(validationsFor(withHistory, 1).map((v) => v.id)).toEqual([2, 1])
    expect(currentDecision(withHistory, 1)).toBe('rechazado')
    expect(currentDecision({ ...reported, validations: [{ ...acceptedValidation, decision: 'quizá' }] }, 1)).toBeNull()
  })
})

describe('findByInput', () => {
  it('encuentra la investigación por lo que escribió el analista o por el valor canónico', () => {
    const items = [investigation()]
    expect(findByInput(items, 'hash', WANNACRY_HASH.toUpperCase())).toBe(items[0])
    expect(findByInput(items, 'hash', WANNACRY_HASH)).toBe(items[0])
    expect(findByInput(items, 'hash', ` ${WANNACRY_HASH}`)).toBeUndefined()
    expect(findByInput(items, 'domain', WANNACRY_HASH)).toBeUndefined()
  })

  it('distingue mayúsculas solo en URLs', () => {
    const url = investigation({
      indicator: { ...investigation().indicator, tipo: 'url', valor: 'http://evil.com/Payload' },
      entrada: 'hxxp://evil[.]com/Payload',
    })
    expect(findByInput([url], 'url', 'http://evil.com/Payload')).toBe(url)
    expect(findByInput([url], 'url', 'http://evil.com/payload')).toBeUndefined()
  })
})
