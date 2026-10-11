import { describe, expect, it, vi } from 'vitest'
import { deferred, fail, mockBackend, reply, type Reply } from '../test/fakeBackend'
import {
  acceptedValidation,
  batchCreated,
  batchDetail,
  batchSummaries,
  benignEnrichment,
  benignIndicator,
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

    expect(await actions.validate(1, 1, { decision: 'aceptado' })).toBe(true)
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

describe('lotes', () => {
  /** n miembros sin enriquecer, con el tipo dado (ids desde 1). */
  const miembros = (...tipos: string[]) =>
    tipos.map((tipo, i) => investigation({ indicator: { ...wannacryIndicator, id: i + 1, tipo } }))

  it('crea el lote, fusiona a sus miembros con su entrada original y analiza solo enrich → correlate', async () => {
    const { actions, dispatch, paths, calls } = setup({
      'POST /batches': reply(201, batchCreated),
      'GET /batches/7': reply(200, batchDetail()),
      'POST /indicators/2/enrich': reply(200, benignEnrichment),
      'POST /indicators/2/correlate': reply(200, { ...wannacryCorrelation, indicator_id: 2 }),
    })
    const payload = { nombre: 'Triage', indicadores: [{ tipo: 'hash' as const, valor: WANNACRY_HASH }, { tipo: null, valor: 'x' }] }

    const result = await actions.createBatch(payload, { autoRun: true })

    expect(result).toEqual({ ok: true, created: batchCreated })
    expect(calls[0]).toEqual({ method: 'POST', path: '/batches', body: payload })
    expect(dispatch).toHaveBeenCalledWith(
      expect.objectContaining({ type: 'loaded', entrada: '8[.]8[.]8[.]8', snapshot: expect.objectContaining({ indicator: benignIndicator }) }),
    )
    await vi.waitFor(() => expect(paths()).toContain('POST /indicators/2/correlate'))
    // Sin informe individual: el informe conjunto hace una sola llamada al LLM.
    expect(paths().filter((p) => p.endsWith('/report'))).toEqual([])
  })

  it('sin autoRun solo registra y trae el lote', async () => {
    const { actions, paths } = setup({ 'POST /batches': reply(201, batchCreated), 'GET /batches/7': reply(200, batchDetail()) })
    expect((await actions.createBatch({ nombre: null, indicadores: [] }, { autoRun: false })).ok).toBe(true)
    expect(paths()).toEqual(['POST /batches', 'GET /batches/7'])
  })

  it('devuelve el error al crear o al cargar un lote', async () => {
    const { actions, paths } = setup({ 'POST /batches': fail(422, 'Ningún indicador del lote es válido: 1: tipo no reconocido') })
    expect(await actions.createBatch({ nombre: null, indicadores: [] }, { autoRun: true })).toEqual({
      ok: false,
      error: { kind: 'http', status: 422, message: 'Ningún indicador del lote es válido: 1: tipo no reconocido' },
    })
    expect(await actions.loadBatch(99)).toEqual({ ok: false, error: { kind: 'http', status: 404, message: 'Not Found' } })
    expect(paths()).toEqual(['POST /batches', 'GET /batches/99'])
  })

  it('lista los lotes y reporta su fallo', async () => {
    expect(await setup({ 'GET /batches': reply(200, batchSummaries) }).actions.listBatches()).toEqual({ ok: true, batches: batchSummaries })
    const caido = setup({ 'GET /batches': new TypeError('Failed to fetch') })
    expect((await caido.actions.listBatches()).ok).toBe(false)
  })

  it('nunca tiene más de 3 indicadores en vuelo y procesa primero los hashes', async () => {
    const liberar = deferred<void>()
    let enVuelo = 0
    let maximo = 0
    const rutas: Record<string, () => Promise<Reply>> = {}
    for (let id = 1; id <= 5; id++) {
      rutas[`POST /indicators/${id}/enrich`] = async () => {
        maximo = Math.max(maximo, ++enVuelo)
        await liberar.promise
        enVuelo--
        return reply(200, { ...wannacryEnrichment, indicator_id: id })
      }
      rutas[`POST /indicators/${id}/correlate`] = async () => reply(200, { ...wannacryCorrelation, indicator_id: id })
    }
    const { actions, paths } = setup(rutas)

    const corrida = actions.analyzeBatch(miembros('ip', 'domain', 'hash', 'url', 'ip'))
    await vi.waitFor(() => expect(enVuelo).toBe(3))
    expect(paths()).toEqual(['POST /indicators/3/enrich', 'POST /indicators/4/enrich', 'POST /indicators/2/enrich'])

    liberar.resolve()
    await corrida
    expect(maximo).toBe(3)
    expect(paths().filter((p) => p.endsWith('/correlate'))).toHaveLength(5)
  })

  it('un fallo no detiene al resto, y los miembros listos no se vuelven a procesar', async () => {
    const { actions, dispatch, paths } = setup({
      'POST /indicators/1/enrich': fail(502, 'OTX caído'),
      'POST /indicators/2/enrich': reply(200, { ...wannacryEnrichment, indicator_id: 2 }),
      'POST /indicators/2/correlate': reply(200, { ...wannacryCorrelation, indicator_id: 2 }),
    })
    const listo = investigation({ indicator: { ...wannacryIndicator, id: 3 }, enrichment: wannacrySnapshot, correlation: wannacryCorrelation })

    await actions.analyzeBatch([...miembros('hash', 'hash'), listo])

    expect(paths()).toEqual(['POST /indicators/1/enrich', 'POST /indicators/2/enrich', 'POST /indicators/2/correlate'])
    expect(dispatch).toHaveBeenCalledWith(expect.objectContaining({ type: 'stepFailed', indicatorId: 1, step: 'enrich' }))
  })

  it('completar fuentes repite enrich → correlate solo en los miembros con fuentes sin verificar', async () => {
    const { actions, paths } = setup({
      'POST /indicators/2/enrich': reply(200, benignEnrichment),
      'POST /indicators/2/correlate': reply(200, { ...wannacryCorrelation, indicator_id: 2 }),
    })
    const completo = investigation({ enrichment: wannacrySnapshot, correlation: wannacryCorrelation })
    const conCupo = investigation({
      indicator: benignIndicator,
      enrichment: { ...wannacrySnapshot, fuentes: benignEnrichment.fuentes },
      correlation: wannacryCorrelation,
    })

    await actions.completeSources([completo, conCupo])

    expect(paths()).toEqual(['POST /indicators/2/enrich', 'POST /indicators/2/correlate'])
  })
})
