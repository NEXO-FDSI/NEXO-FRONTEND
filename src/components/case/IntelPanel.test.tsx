import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import type { FuenteEnriquecimiento } from '../../api/types'
import { summarizeOtx } from '../../domain/otx'
import { investigation, wannacryEnrichment } from '../../test/fixtures'
import { IntelPanel } from './IntelPanel'

import { IDLE } from '../../state/investigations'

const fuente = (f: Partial<FuenteEnriquecimiento> & Pick<FuenteEnriquecimiento, 'fuente' | 'etiqueta' | 'estado'>) => ({
  resumen: null,
  error: null,
  desde_cache: true,
  latencia_ms: null,
  ...f,
})

const sinRegistros = {
  tiene_evidencia: false,
  veredicto: 'sin_evidencia' as const,
  familias: [],
  etiquetas: [],
  detecciones: null,
  confianza: null,
  primera_vez: null,
  ultima_vez: null,
  referencia_url: null,
}

function renderIntel(fuentes: FuenteEnriquecimiento[]) {
  const inv = investigation({
    enrichment: { fuente: 'alienvault_otx', tiene_evidencia: true, resumen: summarizeOtx({}), fuentes },
  })
  render(<IntelPanel inv={inv} activity={IDLE} onRun={vi.fn()} />)
}

describe('IntelPanel', () => {
  it('evidencia solo en ThreatFox: abre esa pestaña y distingue los tres estados', async () => {
    const user = userEvent.setup()
    renderIntel([
      fuente({ fuente: 'alienvault_otx', etiqueta: 'AlienVault OTX', estado: 'sin_evidencia', resumen: sinRegistros }),
      fuente({
        fuente: 'threatfox',
        etiqueta: 'ThreatFox',
        estado: 'con_evidencia',
        resumen: {
          ...sinRegistros,
          tiene_evidencia: true,
          veredicto: 'malicioso',
          familias: ['Emotet'],
          detecciones: { registros: 1 },
          confianza: 90,
          referencias: ['https://abuse.example/1'],
        },
      }),
      fuente({ fuente: 'virustotal', etiqueta: 'VirusTotal', estado: 'error', error: 'VirusTotal respondió 500' }),
    ])

    expect(screen.getByRole('tab', { name: /Con evidencia:\s?ThreatFox/ })).toHaveAttribute('aria-selected', 'true')
    const tf = within(screen.getByRole('region', { name: 'ThreatFox' }))
    expect(tf.getByRole('status')).toHaveTextContent('Con evidencia · La fuente tiene registros de este indicador.')
    expect(tf.getByText('Emotet')).toBeInTheDocument()
    expect(tf.getByText('90/100')).toBeInTheDocument()
    expect(tf.getByRole('link', { name: 'https://abuse.example/1' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Sin evidencia:\s?AlienVault OTX/ }))
    expect(within(screen.getByRole('region', { name: 'AlienVault OTX' })).getByRole('status')).toHaveTextContent(
      'Sin evidencia · La fuente respondió y no tiene registros de este indicador.',
    )
    // Sin pulses no se pinta una tabla vacía: la sección de OTX lo dice.
    expect(screen.getByText('Ningún pulse de OTX menciona este indicador.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /No verificado:\s?VirusTotal/ }))
    const vt = within(screen.getByRole('region', { name: 'VirusTotal' }))
    expect(vt.getByRole('status')).toHaveTextContent(
      'No verificado · VirusTotal respondió 500. Esto NO significa "sin evidencia": no se pudo verificar.',
    )
    expect(vt.getByRole('status')).toHaveClass(/fallo/)
  })

  it('OTX solo con volcados agregados no se presenta como "sin registros"', () => {
    renderIntel([
      fuente({
        fuente: 'alienvault_otx',
        etiqueta: 'AlienVault OTX',
        estado: 'sin_evidencia',
        resumen: { ...sinRegistros, detecciones: { pulses: 2, pulses_masivos: 2 } },
      }),
    ])
    expect(screen.getByRole('status')).toHaveTextContent(
      'Sin evidencia · Solo aparece en 2 volcado(s) agregado(s) de más de 1.000 indicadores, que no cuentan como evidencia.',
    )
  })

  it('una fuente que no participa lo dice con su motivo', () => {
    renderIntel([
      fuente({ fuente: 'threatfox', etiqueta: 'ThreatFox', estado: 'no_soportado' }),
      fuente({ fuente: 'virustotal', etiqueta: 'VirusTotal', estado: 'omitido', error: 'dirección no pública: no se envía a terceros' }),
    ])
    expect(screen.getByRole('status')).toHaveTextContent('No participó · Esta fuente no participó (no aplica a este tipo).')
  })

  it('una caché anterior a las fuentes múltiples muestra la vista de OTX de siempre', () => {
    const inv = investigation({
      enrichment: { fuente: 'alienvault_otx', tiene_evidencia: true, resumen: summarizeOtx(wannacryEnrichment.detalle) },
    })
    render(<IntelPanel inv={inv} activity={IDLE} onRun={vi.fn()} />)
    expect(screen.queryByRole('tablist')).not.toBeInTheDocument()
    expect(screen.getByRole('table', { name: /Pulses de OTX/ })).toBeInTheDocument()
  })
})
