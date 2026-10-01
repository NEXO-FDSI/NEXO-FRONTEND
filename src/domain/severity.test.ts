import { describe, expect, it } from 'vitest'
import type { FuenteEnriquecimiento } from '../api/types'
import { investigation, wannacryFuentes, wannacryMetadatos, wannacryReport } from '../test/fixtures'
import { latestMetadatos, sourceCoverage } from './severity'

const fuente = (estado: FuenteEnriquecimiento['estado'], etiqueta: string = estado): FuenteEnriquecimiento => ({
  fuente: etiqueta,
  etiqueta,
  estado,
  resumen: null,
  error: null,
  desde_cache: false,
  latencia_ms: null,
})

describe('sourceCoverage', () => {
  it('cuenta solo las fuentes que debían responder', () => {
    const cobertura = sourceCoverage([
      fuente('con_evidencia'),
      fuente('sin_evidencia'),
      fuente('limite_cuota', 'VirusTotal'),
      fuente('no_configurado'),
      fuente('no_soportado'),
    ])
    expect(cobertura.consultadas).toBe(3)
    expect(cobertura.conDatos).toBe(2)
    expect(cobertura.fallidas.map((f) => f.etiqueta)).toEqual(['VirusTotal'])
  })

  it('sin fallos la cobertura es completa', () => {
    expect(sourceCoverage(wannacryFuentes)).toEqual({ consultadas: 3, conDatos: 3, fallidas: [] })
    expect(sourceCoverage([fuente('omitido'), fuente('omitido')]).consultadas).toBe(0)
  })
})

describe('latestMetadatos', () => {
  it('lee los del informe más reciente y tolera informes previos a la Fase 4', () => {
    expect(latestMetadatos(investigation())).toBeNull()
    expect(latestMetadatos(investigation({ reports: [wannacryReport] }))).toBe(wannacryMetadatos)
    const antiguo = { ...wannacryReport, id: 2, metadatos: undefined }
    expect(latestMetadatos(investigation({ reports: [wannacryReport, antiguo] }))).toBeNull()
  })
})
