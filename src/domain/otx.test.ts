import { describe, expect, it } from 'vitest'
import { benignEnrichment, wannacryEnrichment } from '../test/fixtures'
import { summarizeOtx } from './otx'

describe('summarizeOtx', () => {
  it('resume pulses y marca los volcados agregados que la correlación descarta', () => {
    const summary = summarizeOtx(wannacryEnrichment.detalle)

    expect(summary.tipo).toBe('sha256')
    expect(summary.pulseCount).toBe(50)
    expect(summary.pulses).toHaveLength(2)
    expect(summary.pulses[0]).toMatchObject({ indicatorCount: 288240, masivo: true, malwareFamilies: [] })
    expect(summary.pulses[1]).toMatchObject({
      name: 'WannaCry Indicators',
      indicatorCount: 42,
      masivo: false,
      malwareFamilies: ['WannaCry'],
      tags: ['wannacry', 'ransomware'],
    })
  })

  it('expone las validaciones de OTX (whitelist, falso positivo)', () => {
    expect(summarizeOtx(benignEnrichment.detalle).validations).toEqual([
      { source: 'false_positive', name: 'Known False Positive', message: 'Known False Positive' },
      { source: 'whitelist', name: 'Whitelisted IP', message: 'contained in whitelisted prefix' },
    ])
  })

  it.each([null, undefined, 'texto', [], 42])('tolera una respuesta sin forma de objeto (%j)', (detalle) => {
    expect(summarizeOtx(detalle)).toEqual({ tipo: null, pulseCount: 0, pulses: [], validations: [] })
  })

  it('rellena valores por defecto ante campos ausentes o de otro tipo', () => {
    const summary = summarizeOtx({
      type: '',
      validation: [null],
      pulse_info: {
        count: 'muchos',
        pulses: [null, { tags: ['ok', '', 3], malware_families: ['Emotet', { display_name: null }, { display_name: 'Lazarus' }] }],
      },
    })

    expect(summary.pulseCount).toBe(0)
    expect(summary.validations).toEqual([{ source: 'otx', name: 'Validación OTX', message: '' }])
    expect(summary.pulses[0]).toEqual({
      id: 'pulse-0',
      name: '(pulse sin nombre)',
      created: null,
      indicatorCount: null,
      tags: [],
      malwareFamilies: [],
      masivo: false,
    })
    expect(summary.pulses[1]).toMatchObject({ tags: ['ok'], malwareFamilies: ['Emotet', 'Lazarus'] })
  })
})
