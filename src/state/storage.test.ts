import { describe, expect, it, vi } from 'vitest'
import { investigation, wannacrySnapshot } from '../test/fixtures'
import {
  isHistoryPersisted,
  loadInvestigations,
  saveInvestigations,
  subscribeHistoryPersisted,
} from './storage'

const KEY = 'nexo.investigations.v1'

describe('historial local', () => {
  it('guarda y recupera investigaciones', () => {
    const inv = investigation({ enrichment: wannacrySnapshot })

    expect(saveInvestigations([inv, investigation({ indicator: { ...inv.indicator, id: 9 } })])).toBe(true)

    const [loaded, plain] = loadInvestigations()
    expect(loaded.enrichment?.resumen).toEqual(wannacrySnapshot.resumen)
    expect(plain.enrichment).toBeNull()
  })

  it.each([
    ['vacío', null],
    ['JSON corrupto', '{no-json'],
    ['no es una lista', '{"a":1}'],
  ])('devuelve un historial vacío si está %s', (_caso, raw) => {
    if (raw !== null) window.localStorage.setItem(KEY, raw)
    expect(loadInvestigations()).toEqual([])
  })

  it('descarta entradas con forma inválida', () => {
    window.localStorage.setItem(KEY, JSON.stringify([investigation(), { indicator: { id: 'x' } }, null, 3]))
    expect(loadInvestigations()).toHaveLength(1)
  })

  it('no rompe si localStorage lanza al leer', () => {
    vi.spyOn(Storage.prototype, 'getItem').mockImplementation(() => {
      throw new Error('SecurityError')
    })
    expect(loadInvestigations()).toEqual([])
  })

  it('notifica cuando el historial deja de guardarse y cuando se recupera', () => {
    const listener = vi.fn()
    const unsubscribe = subscribeHistoryPersisted(listener)
    const setItem = vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })

    expect(saveInvestigations([investigation()])).toBe(false)
    expect(isHistoryPersisted()).toBe(false)
    expect(listener).toHaveBeenCalledTimes(1)

    setItem.mockRestore()
    expect(saveInvestigations([])).toBe(true)
    expect(isHistoryPersisted()).toBe(true)
    expect(listener).toHaveBeenCalledTimes(2)

    unsubscribe()
    saveInvestigations([])
    expect(listener).toHaveBeenCalledTimes(2)
  })
})
