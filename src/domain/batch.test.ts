import { describe, expect, it } from 'vitest'
import { benignEnrichment, benignIndicator, investigation, wannacryCorrelation, wannacrySnapshot } from '../test/fixtures'
import { estadoPaso, fuentesFallidas, miembroListo, ordenDeProceso, parseBlock } from './batch'

describe('parseBlock', () => {
  it('detecta tipos mezclados y ofuscados, uno por línea, e ignora las vacías', () => {
    const lineas = parseBlock(
      '  hxxps://evil[.]example/Pago  \n\n203[.]0[.]113[.]7\r\nD41D8CD98F00B204E9800998ECF8427E\nevil[dot]example\n',
    )
    expect(lineas.map(({ posicion, tipo }) => [posicion, tipo])).toEqual([
      [1, 'url'],
      [2, 'ip'],
      [3, 'hash'],
      [4, 'domain'],
    ])
    expect(lineas[0].entrada).toBe('hxxps://evil[.]example/Pago') // se envía tal como se pegó
  })

  it('marca los duplicados por su valor sin ofuscar, sin distinguir mayúsculas salvo en el path de una URL', () => {
    const lineas = parseBlock(
      'ervsystem[.]com\nERVSYSTEM.COM\nhttp://a.example/X\nhttp://a.example/x\nhxxp://a[.]example/X',
    )
    expect(lineas.map((l) => l.duplicadoDe)).toEqual([null, 1, null, null, 3])
  })

  it('deja las líneas no reconocidas sin tipo (el backend las registrará como inválidas)', () => {
    expect(parseBlock('no-es-un-ioc\n999.1.1.1\nno-es-un-ioc')).toEqual([
      { posicion: 1, entrada: 'no-es-un-ioc', tipo: null, duplicadoDe: null },
      { posicion: 2, entrada: '999.1.1.1', tipo: null, duplicadoDe: null },
      { posicion: 3, entrada: 'no-es-un-ioc', tipo: null, duplicadoDe: null },
    ])
  })
})

const de = (tipo: string, id: number) => investigation({ indicator: { ...benignIndicator, id, tipo } })

describe('ordenDeProceso', () => {
  it('procesa primero los hashes (el cupo de VirusTotal rinde más en ellos), sin perder el orden del resto', () => {
    const orden = ordenDeProceso([de('ip', 1), de('domain', 2), de('hash', 3), de('url', 4), de('ip', 5), de('otro', 6)])
    expect(orden.map((inv) => inv.indicator.id)).toEqual([3, 4, 2, 1, 5, 6])
  })
})

describe('estado de un miembro', () => {
  const idle = { running: null, failure: null }

  it('distingue pendiente, en curso, hecho y fallido', () => {
    const enriquecido = investigation({ enrichment: wannacrySnapshot })
    expect(estadoPaso(enriquecido, idle, 'enrich')).toBe('hecho')
    expect(estadoPaso(enriquecido, idle, 'correlate')).toBe('pendiente')
    expect(estadoPaso(enriquecido, { running: 'correlate', failure: null }, 'correlate')).toBe('en_curso')
    expect(estadoPaso(enriquecido, { running: null, failure: { step: 'correlate' } }, 'correlate')).toBe('fallido')
  })

  it('un miembro está listo con enriquecimiento y correlación (no necesita informe individual)', () => {
    expect(miembroListo(investigation({ enrichment: wannacrySnapshot }))).toBe(false)
    expect(miembroListo(investigation({ enrichment: wannacrySnapshot, correlation: wannacryCorrelation }))).toBe(true)
  })

  it('lista las fuentes que no se pudieron verificar', () => {
    const benigno = investigation({ enrichment: { ...wannacrySnapshot, fuentes: benignEnrichment.fuentes } })
    expect(fuentesFallidas(benigno).map((f) => [f.etiqueta, f.estado])).toEqual([['VirusTotal', 'limite_cuota']])
    expect(fuentesFallidas(investigation())).toEqual([])
  })
})
