import { describe, expect, it, vi } from 'vitest'
import { deferred, fail, mockBackend, reply, type Reply } from '../test/fakeBackend'
import {
  acceptedValidation,
  investigation,
  WANNACRY_HASH,
  wannacryCorrelation,
  wannacryEnrichment,
  wannacryIndicator,
  wannacryReport,
  wannacrySnapshot,
} from '../test/fixtures'
import type { InvestigationsAction } from './investigations'
import { createPipelineActions } from './pipelineActions'

const PIPELINE = {
  'POST /indicators': reply(201, wannacryIndicator),
  'POST /indicators/1/enrich': reply(200, wannacryEnrichment),
  'POST /indicators/1/correlate': reply(200, wannacryCorrelation),
  'POST /indicators/1/report': reply(201, wannacryReport),
  'POST /reports/1/validate': reply(201, acceptedValidation),
}

function setup(overrides: Record<string, Reply | (() => Promise<Reply>)> = {}) {
  const backend = mockBackend({ ...PIPELINE, ...overrides })
  const dispatch = vi.fn<(action: InvestigationsAction) => void>()
  const types = () => dispatch.mock.calls.map(([action]) => action.type)
  return { ...backend, dispatch, types, actions: createPipelineActions(dispatch) }
}

describe('createPipelineActions', () => {
  it('registra el indicador y, con autoRun, encadena enriquecer → correlacionar → informar', async () => {
    const { actions, types, paths } = setup()

    const result = await actions.register({ tipo: 'hash', valor: WANNACRY_HASH, fuente: null }, { autoRun: true })
    await vi.waitFor(() => expect(types()).toContain('reportCreated'))

    expect(result).toEqual({ ok: true, indicator: wannacryIndicator })
    expect(paths()).toEqual([
      'POST /indicators',
      'POST /indicators/1/enrich',
      'POST /indicators/1/correlate',
      'POST /indicators/1/report',
    ])
    expect(types()).toEqual([
      'registered',
      'stepStarted',
      'enriched',
      'stepStarted',
      'correlated',
      'stepStarted',
      'reportCreated',
    ])
  })

  it('devuelve el error del registro sin tocar el estado', async () => {
    const { actions, dispatch } = setup({ 'POST /indicators': fail(409, 'El indicador ya existe') })

    const result = await actions.register({ tipo: 'ip', valor: '8.8.8.8' }, { autoRun: true })

    expect(result).toEqual({ ok: false, error: { kind: 'http', status: 409, message: 'El indicador ya existe' } })
    expect(dispatch).not.toHaveBeenCalled()
  })

  it('omite los pasos ya hechos y se detiene en el primer fallo', async () => {
    const { actions, types, paths } = setup({
      'POST /indicators/1/correlate': fail(400, 'Debes ejecutar /enrich'),
    })

    const ok = await actions.runAutomatic(investigation({ enrichment: wannacrySnapshot }))

    expect(ok).toBe(false)
    expect(paths()).toEqual(['POST /indicators/1/correlate'])
    expect(types()).toEqual(['stepStarted', 'stepFailed'])
  })

  it('no ejecuta nada si el pipeline automático ya está completo', async () => {
    const { actions, paths } = setup()
    const done = investigation({ enrichment: wannacrySnapshot, correlation: wannacryCorrelation, reports: [wannacryReport] })

    expect(await actions.runAutomatic(done)).toBe(true)
    expect(paths()).toEqual([])
  })

  it('impide pasos concurrentes sobre la misma investigación', async () => {
    const gate = deferred<Reply>()
    const { actions, paths } = setup({ 'POST /indicators/1/enrich': () => gate.promise })

    const first = actions.runStep(1, 'enrich')
    expect(await actions.runStep(1, 'correlate')).toBe(false)
    expect(await actions.validate(1, 1, { decision: 'aceptado' })).toBe(false)

    gate.resolve(reply(200, wannacryEnrichment))
    expect(await first).toBe(true)
    expect(paths()).toEqual(['POST /indicators/1/enrich'])
    expect(await actions.runStep(1, 'correlate')).toBe(true)
  })

  it('registra la validación del analista y reporta su fallo', async () => {
    const { actions, dispatch } = setup()

    expect(await actions.validate(1, 1, { decision: 'aceptado', analista: 'N1' })).toBe(true)
    expect(dispatch).toHaveBeenLastCalledWith({ type: 'validated', indicatorId: 1, validation: acceptedValidation })

    const failing = setup({ 'POST /reports/1/validate': fail(404, 'Informe no encontrado') })
    expect(await failing.actions.validate(1, 1, { decision: 'rechazado' })).toBe(false)
    expect(failing.dispatch).toHaveBeenLastCalledWith({
      type: 'stepFailed',
      indicatorId: 1,
      step: 'validate',
      error: { kind: 'http', status: 404, message: 'Informe no encontrado' },
    })
  })
})
