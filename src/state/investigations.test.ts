import { describe, expect, it } from 'vitest'
import {
  acceptedValidation,
  benignIndicator,
  investigation,
  WANNACRY_HASH,
  wannacryCorrelation,
  wannacryEnrichment,
  wannacryIndicator,
  wannacryReport,
} from '../test/fixtures'
import { IDLE, initialState, investigationsReducer, type InvestigationsState } from './investigations'

const error = { kind: 'http' as const, status: 502, message: 'OTX caído' }

function withTwo(): InvestigationsState {
  return initialState([investigation({ indicator: benignIndicator, entrada: '8.8.8.8' }), investigation()])
}

describe('investigationsReducer', () => {
  it('registra un indicador al principio, sin duplicarlo', () => {
    const state = investigationsReducer(withTwo(), {
      type: 'registered',
      indicator: wannacryIndicator,
      entrada: WANNACRY_HASH,
    })

    expect(state.items.map((inv) => inv.indicator.id)).toEqual([1, 2])
    expect(state.items[0].entrada).toBe(WANNACRY_HASH)
    expect(state.activity[1]).toEqual(IDLE)
  })

  it('quita una investigación y su actividad', () => {
    const started = investigationsReducer(withTwo(), { type: 'stepStarted', indicatorId: 2, step: 'enrich' })
    const removed = investigationsReducer(started, { type: 'removed', indicatorId: 2 })
    expect(removed.items.map((inv) => inv.indicator.id)).toEqual([1])
    expect(removed.activity[2]).toBeUndefined()
  })

  it('marca el paso en curso y lo libera al fallar, guardando el error', () => {
    const started = investigationsReducer(withTwo(), { type: 'stepStarted', indicatorId: 1, step: 'enrich' })
    expect(started.activity[1]).toEqual({ running: 'enrich', failure: null })

    const failed = investigationsReducer(started, { type: 'stepFailed', indicatorId: 1, step: 'enrich', error })
    expect(failed.activity[1]).toEqual({ running: null, failure: { step: 'enrich', error } })
    expect(failed.items.find((i) => i.indicator.id === 1)?.missing).toBe(false)

    expect(investigationsReducer(failed, { type: 'failureDismissed', indicatorId: 1 }).activity[1]).toEqual(IDLE)
  })

  it('un 404 marca la investigación como inexistente en el backend', () => {
    const state = investigationsReducer(withTwo(), {
      type: 'stepFailed',
      indicatorId: 1,
      step: 'correlate',
      error: { ...error, status: 404 },
    })
    expect(state.items.map((i) => i.missing)).toEqual([false, true])
  })

  it('guarda cada resultado y libera el paso en la misma transición', () => {
    let state = investigationsReducer(withTwo(), { type: 'stepStarted', indicatorId: 1, step: 'enrich' })
    state = investigationsReducer(state, { type: 'enriched', response: wannacryEnrichment })
    state = investigationsReducer(state, { type: 'correlated', response: wannacryCorrelation })
    state = investigationsReducer(state, { type: 'reportCreated', report: wannacryReport })
    state = investigationsReducer(state, { type: 'validated', indicatorId: 1, validation: acceptedValidation })

    const inv = state.items.find((i) => i.indicator.id === 1)!
    expect(inv.enrichment).toMatchObject({ tiene_evidencia: true, detalle: wannacryEnrichment.detalle })
    expect(inv.enrichment?.resumen.pulseCount).toBe(50)
    expect(inv.correlation).toBe(wannacryCorrelation)
    expect(inv.reports).toEqual([wannacryReport])
    expect(inv.validations).toEqual([acceptedValidation])
    expect(state.activity[1]).toEqual(IDLE)
    expect(state.items.find((i) => i.indicator.id === 2)?.enrichment).toBeNull()
  })
})
