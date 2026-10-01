import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { ReportMetadatos } from '../../api/types'
import { investigation, wannacryMetadatos, wannacryReport } from '../../test/fixtures'
import { SummaryPanel } from './SummaryPanel'

describe('SummaryPanel', () => {
  it('hace visible una contradicción entre fuentes (caso real: DLL de SolarWinds atribuida a BlackCat)', () => {
    const metadatos: ReportMetadatos = {
      ...wannacryMetadatos,
      severidad: { nivel: 'alta', motivos: ['asociado a blackcat con confianza 0.6'] },
      concordancia: [
        { fuente: 'virustotal', etiqueta: 'VirusTotal', familias: ['sunburst'], entidades: ['sunburst'], resultado: 'discrepa' },
        { fuente: 'threatfox', etiqueta: 'ThreatFox', familias: ['Emotet'], entidades: ['emotet'], resultado: 'sugiere' },
        { fuente: 'x', etiqueta: 'Otra', familias: [], entidades: [], resultado: 'no_comparable' },
      ],
      ia: { ...wannacryMetadatos.ia, analisis: null, estado: 'fallido' },
    }
    const inv = investigation({ reports: [{ ...wannacryReport, metadatos }] })
    render(<SummaryPanel inv={inv} onOpenAnalysis={vi.fn()} />)

    expect(screen.getByText('VirusTotal contradice la asociación: sus familias apuntan a sunburst.')).toBeInTheDocument()
    expect(screen.getByText('ThreatFox sugiere emotet, entidad que NEXO no resolvió.')).toBeInTheDocument()
    expect(screen.queryByText(/Otra/)).not.toBeInTheDocument()
    // Sin análisis de IA no se muestra un resumen vacío.
    expect(screen.queryByRole('region', { name: 'Resumen de la IA' })).not.toBeInTheDocument()
  })

  it('muestra el nivel de confianza y las contradicciones sin repetirlas como concordancia', () => {
    const metadatos: ReportMetadatos = {
      ...wannacryMetadatos,
      confianza: { nivel: 'baja', motivos: ['VirusTotal: 0 de 70 motores lo detectan, pero AlienVault OTX lo reporta(n)'] },
      contradicciones: [
        {
          tipo: 'vt_limpio',
          fuentes: ['virustotal', 'alienvault_otx'],
          detalle: 'VirusTotal: 0 de 70 motores lo detectan, pero AlienVault OTX lo reporta(n)',
        },
        {
          tipo: 'entidad_distinta',
          fuentes: ['threatfox'],
          detalle: 'ThreatFox reporta familias que ATT&CK asocia a emotet, no a la entidad asociada',
        },
      ],
      concordancia: [
        { fuente: 'threatfox', etiqueta: 'ThreatFox', familias: ['Emotet'], entidades: ['emotet'], resultado: 'discrepa' },
      ],
    }
    render(<SummaryPanel inv={investigation({ reports: [{ ...wannacryReport, metadatos }] })} onOpenAnalysis={vi.fn()} />)

    expect(screen.getByRole('region', { name: 'Nivel de confianza' })).toHaveTextContent('Confianza baja')
    const contradicciones = screen.getByRole('region', { name: 'Contradicciones entre fuentes' })
    expect(contradicciones).toHaveTextContent('VirusTotal: 0 de 70 motores lo detectan')
    expect(contradicciones).toHaveTextContent('ThreatFox reporta familias que ATT&CK asocia a emotet')
    expect(screen.queryByRole('region', { name: 'Concordancia entre fuentes' })).not.toBeInTheDocument()
  })

  it('sin informe explica que la severidad no la decide la IA', () => {
    render(<SummaryPanel inv={investigation()} onOpenAnalysis={vi.fn()} />)
    expect(screen.getByText('Sin evaluar')).toBeInTheDocument()
    expect(screen.getByText(/la IA no decide la severidad/)).toBeInTheDocument()
    expect(screen.queryByRole('region', { name: 'Concordancia entre fuentes' })).not.toBeInTheDocument()
  })
})
