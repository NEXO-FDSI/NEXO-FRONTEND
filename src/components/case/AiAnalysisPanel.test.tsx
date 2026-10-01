import { render, screen } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import type { RegistroIA } from '../../api/types'
import { IDLE } from '../../state/investigations'
import { investigation, wannacryMetadatos, wannacryReport } from '../../test/fixtures'
import { AiAnalysisPanel } from './AiAnalysisPanel'

function renderIA(ia: Partial<RegistroIA>) {
  const report = { ...wannacryReport, metadatos: { ...wannacryMetadatos, ia: { ...wannacryMetadatos.ia, ...ia } } }
  render(<AiAnalysisPanel inv={investigation({ reports: [report] })} activity={IDLE} onRun={vi.fn()} report={report} />)
}

describe('AiAnalysisPanel', () => {
  it('explica por diseño cuando no se consultó al modelo', () => {
    renderIA({ estado: 'no_llamado', analisis: null, motivo: 'sin entidad resuelta: por diseño no se consulta al modelo' })
    expect(screen.getByText('No se consultó al modelo')).toBeInTheDocument()
    expect(screen.getByText('Motivo: sin entidad resuelta: por diseño no se consulta al modelo.')).toBeInTheDocument()
    expect(screen.getByText(/sigue siendo válido/)).toBeInTheDocument()
  })

  it('lista los intentos cuando ningún proveedor respondió', () => {
    renderIA({
      estado: 'fallido',
      analisis: null,
      motivo: 'ningún proveedor de IA respondió',
      intentos_fallidos: [
        { proveedor: 'groq', modelo: 'qwen/qwen3.8-27b', error: '429 rate limit' },
        { proveedor: 'ollama', modelo: 'qwen3:8b', error: 'Connection error.' },
      ],
    })
    expect(screen.getByText('El modelo no respondió')).toBeInTheDocument()
    expect(screen.getByText('groq').parentElement).toHaveTextContent('groq (qwen/qwen3.8-27b): 429 rate limit')
    expect(screen.getByText('ollama').parentElement).toHaveTextContent('Connection error.')
  })

  it('muestra qué se descartó cuando todo citaba fuera del contexto', () => {
    renderIA({
      estado: 'descartado',
      analisis: null,
      motivo: 'todo lo que redactó el modelo citaba fuera del contexto',
      descartes: [{ seccion: 'resumen', texto: 'Usa T1486.', motivo: 'menciona técnicas fuera del contexto: T1486' }],
    })
    expect(screen.getByText('Se descartó todo lo que redactó el modelo')).toBeInTheDocument()
    expect(screen.getByText(/«Usa T1486\.» — menciona técnicas fuera del contexto/)).toBeInTheDocument()
  })

  it('declara el respaldo y los descartes en el pie del análisis', () => {
    renderIA({
      proveedor: 'ollama',
      modelo: 'qwen3:8b',
      tokens: null,
      intentos_fallidos: [{ proveedor: 'groq', modelo: 'qwen/qwen3.8-27b', error: '429' }],
      descartes: [{ seccion: 'hallazgos', texto: 'x', motivo: 'cita fuentes inexistentes: E-X' }],
    })
    expect(screen.getByText('Respaldo: groq no respondió')).toBeInTheDocument()
    expect(screen.getByText('1 afirmación(es) descartada(s) por citar fuera del contexto')).toBeInTheDocument()
    expect(screen.queryByText(/tokens/)).not.toBeInTheDocument()
    expect(screen.getByText(/no que sea correcta/)).toBeInTheDocument()
  })

  it('dice cómo se eligieron las técnicas y muestra la similitud de cada una', () => {
    renderIA({
      seleccion: {
        metodo: 'semantica',
        consulta: 'Indicator of compromise: file hash linked to wannacry.',
        motivo: null,
        puntajes: { T1210: 0.7123 },
      },
    })
    expect(screen.getByText(/ordenadas por afinidad semántica/)).toBeInTheDocument()
    expect(screen.getByText('similitud 0.71')).toBeInTheDocument()
  })

  it('sin embeddings explica que se repartieron por táctica', () => {
    renderIA({
      seleccion: { metodo: 'por_tactica', consulta: 'x', motivo: 'no se obtuvo el embedding de la consulta', puntajes: {} },
    })
    expect(
      screen.getByText('Técnicas de la entidad repartidas por táctica: no se obtuvo el embedding de la consulta.'),
    ).toBeInTheDocument()
    expect(screen.queryByText(/similitud/)).not.toBeInTheDocument()
  })
})
