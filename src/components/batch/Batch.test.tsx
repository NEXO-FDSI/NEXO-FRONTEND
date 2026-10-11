import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { Investigation } from '../../domain/investigation'
import { fail, mockBackend, reply, type Reply } from '../../test/fakeBackend'
import {
  batchCreated,
  batchDetail,
  batchSummaries,
  benignEnrichment,
  benignIndicator,
  investigation,
  loteCorrelacion,
  statusResponse,
  unresolvedCorrelation,
  WANNACRY_HASH,
  wannacryCorrelation,
  wannacryEnrichment,
} from '../../test/fixtures'

type Route = Reply | ((request: { body: unknown; query: URLSearchParams }) => Reply | Promise<Reply>)

const BASE: Record<string, Route> = {
  'GET /health': reply(200, { status: 'ok' }),
  'GET /status': reply(200, statusResponse),
  'POST /batches': reply(201, batchCreated),
  'GET /batches/7': reply(200, batchDetail()),
  'POST /indicators/1/enrich': reply(200, wannacryEnrichment),
  'POST /indicators/1/correlate': reply(200, wannacryCorrelation),
  'POST /indicators/2/enrich': reply(200, benignEnrichment),
  'POST /indicators/2/correlate': reply(200, unresolvedCorrelation),
}

function renderApp(hash: string, routes: Record<string, Route> = {}, history: Investigation[] = []) {
  if (history.length > 0) window.localStorage.setItem('nexo.investigations.v1', JSON.stringify(history))
  window.location.hash = hash
  const backend = mockBackend({ ...BASE, ...routes })
  const user = userEvent.setup()
  render(<App />)
  return { ...backend, user }
}

const fila = (ref: string) => screen.getByRole('cell', { name: ref }).closest('tr')!

describe('Lotes', () => {
  it('crea un lote desde el bloque pegado, analiza cada miembro y deja completar las fuentes', async () => {
    const { user, calls, paths } = renderApp('#/analizar/lote', {}, [investigation()])

    await user.click(screen.getByLabelText('Indicadores (uno por línea)'))
    await user.paste(`${WANNACRY_HASH.toUpperCase()}\n8[.]8[.]8[.]8\n8.8.8.8\nno-es-un-ioc`)

    const preview = within(screen.getByRole('region', { name: 'Vista previa del lote' }))
    expect(preview.getByText(/4 línea\(s\)/)).toHaveTextContent(
      '4 línea(s) → 2 indicador(es) · 1 duplicado(s) · 1 no reconocida(s)',
    )
    expect(preview.getByText('Ya en NEXO (#1): se reutiliza')).toBeInTheDocument()
    expect(preview.getByText('Nuevo')).toBeInTheDocument()
    expect(preview.getByText('Duplicado de la línea 2')).toBeInTheDocument()
    expect(preview.getByText('No reconocido: quedará registrado como inválido')).toBeInTheDocument()

    await user.type(screen.getByLabelText(/Nombre del lote/), 'Triage de prueba')
    await user.click(screen.getByRole('button', { name: 'Crear lote y analizar' }))

    // Se envía todo, también lo no reconocido: el backend deja constancia de cada línea.
    expect(calls.find((c) => c.path === '/batches')?.body).toEqual({
      nombre: 'Triage de prueba',
      indicadores: [
        { tipo: 'hash', valor: WANNACRY_HASH.toUpperCase() },
        { tipo: 'ip', valor: '8[.]8[.]8[.]8' },
        { tipo: 'ip', valor: '8.8.8.8' },
        { tipo: null, valor: 'no-es-un-ioc' },
      ],
    })
    await vi.waitFor(() => expect(window.location.hash).toBe('#/lotes/7'))
    expect(await screen.findByRole('heading', { name: 'Triage de prueba' })).toBeInTheDocument()

    // Cada miembro pasa por enrich → correlate, sin informe individual.
    expect(await screen.findByText('2 de 2 procesados')).toBeInTheDocument()
    expect(paths().filter((p) => p.endsWith('/report'))).toEqual([])
    expect(within(fila('I1')).getByText('wannacry')).toBeInTheDocument()
    expect(within(fila('I2')).getByText('Sin asociación')).toBeInTheDocument()
    expect(within(fila('I1')).getAllByText('Hecho')).toHaveLength(2)
    expect(within(fila('I2')).getByRole('link', { name: /8\.8\.8\.8/ })).toHaveAttribute('href', '#/investigaciones/2')
    // La correlación del lote se vuelve a pedir al terminar la tanda.
    expect(paths().filter((p) => p === 'GET /batches/7').length).toBeGreaterThanOrEqual(2)

    // Lo descartado queda a la vista con su motivo.
    const descartes = within(screen.getByRole('region', { name: 'Entradas descartadas' }))
    expect(descartes.getByText('no-es-un-ioc')).toBeInTheDocument()
    expect(descartes.getByText('tipo no reconocido')).toBeInTheDocument()
    expect(screen.getByText(loteCorrelacion.conclusion.texto)).toBeInTheDocument()

    // VirusTotal sin cupo para 8.8.8.8: se declara y se puede completar.
    const aviso = screen.getByText('Fuentes sin verificar').closest('[role="status"]')!
    expect(aviso).toHaveTextContent('VirusTotal: I2')
    const antes = paths().length
    await user.click(within(aviso as HTMLElement).getByRole('button', { name: 'Completar fuentes (1)' }))
    await vi.waitFor(() =>
      expect(paths().slice(antes)).toEqual(expect.arrayContaining(['POST /indicators/2/enrich', 'POST /indicators/2/correlate'])),
    )
    expect(paths().slice(antes)).not.toContain('POST /indicators/1/enrich')
  })

  it('un fallo en un miembro deja "Reintentar" en su fila sin detener al resto', async () => {
    let intentos = 0
    let cargas = 0
    const { user } = renderApp(
      '#/lotes/7',
      {
        'POST /indicators/1/enrich': () => (++intentos === 1 ? fail(502, 'OTX no respondió') : reply(200, wannacryEnrichment)),
        // El lote se actualiza al terminar cada tanda; si esa recarga falla, se avisa sin perder lo mostrado.
        'GET /batches/7': () => (++cargas === 1 ? reply(200, batchDetail()) : new TypeError('Failed to fetch')),
      },
      [investigation(), investigation({ indicator: benignIndicator, entrada: '8.8.8.8' })],
    )

    await user.click(await screen.findByRole('button', { name: 'Analizar pendientes (2)' }))
    expect(await within(fila('I1')).findByText('No se pudo verificar la reputación')).toBeInTheDocument()
    expect(within(fila('I1')).getByText('Falló')).toBeInTheDocument()
    expect(within(fila('I2')).getAllByText('Hecho')).toHaveLength(2)
    expect(screen.getByText('1 de 2 procesados · 1 con fallo')).toBeInTheDocument()
    expect(await screen.findByText('No se pudo actualizar el lote')).toBeInTheDocument()

    await user.click(within(fila('I1')).getByRole('button', { name: 'Reintentar' }))
    expect(await screen.findByText('2 de 2 procesados')).toBeInTheDocument()
    expect(within(fila('I1')).queryByText('Falló')).not.toBeInTheDocument()
  })

  it('muestra los vínculos que calculó el backend', async () => {
    renderApp('#/lotes/7', {
      'GET /batches/7': reply(200, batchDetail({
        correlacion: {
          ...loteCorrelacion,
          vinculos: [{
            id: 'V1', a: 'I1', b: 'I2', confianza: 'media',
            senales: [
              { tipo: 'pulse_compartido', fuerza: 'fuerte', origen: 'alienvault_otx', detalle: '4 pulse(s)…', pulses: [] },
              { tipo: 'misma_entidad', fuerza: 'contextual', origen: 'correlacion_nexo', detalle: 'ambos…', entity_id: 1 },
            ],
          }],
          conclusion: { ...loteCorrelacion.conclusion, nivel: 'relacion_demostrable', texto: 'Relación demostrable entre I1 y I2 (A1, confianza media).' },
        },
      })),
    })

    const vinculos = within(await screen.findByRole('region', { name: 'Vínculos entre indicadores' }))
    expect(vinculos.getByText('Relación demostrable')).toBeInTheDocument()
    const v1 = vinculos.getByText('V1').closest('li')!
    expect(v1).toHaveTextContent('I1 – I2')
    expect(v1).toHaveTextContent('Pulse compartido + Misma entidad')
    expect(v1).toHaveTextContent('Confianza media')
  })

  it('pide entre 2 y 20 líneas y ofrece ejemplos de los escenarios oficiales', async () => {
    const { user } = renderApp('#/analizar/lote')
    const crear = screen.getByRole('button', { name: 'Crear lote y analizar' })
    expect(crear).toBeDisabled()

    await user.click(screen.getByLabelText('Indicadores (uno por línea)'))
    await user.paste('8.8.8.8')
    expect(screen.getByText('Un lote necesita al menos dos líneas')).toBeInTheDocument()
    expect(crear).toBeDisabled()

    await user.paste(Array.from({ length: 20 }, (_, i) => `\n10.0.0.${i}`).join(''))
    expect(screen.getByText('Máximo 20 líneas por lote')).toBeInTheDocument()
    expect(crear).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Escenario 4 · SUNBURST' }))
    expect(screen.getByLabelText('Indicadores (uno por línea)')).toHaveValue('2c4a910a1299cdae2a4e55988a2f102e\nervsystem[.]com')
    expect(crear).toBeEnabled()
  })

  it('muestra el error del backend al crear el lote', async () => {
    const { user } = renderApp('#/analizar/lote', {
      'POST /batches': fail(422, 'Ningún indicador del lote es válido: 1: tipo no reconocido'),
    })
    await user.click(screen.getByRole('button', { name: 'Escenario 3 · tres amenazas' }))
    await user.click(screen.getByRole('button', { name: 'Crear lote y analizar' }))

    const alerta = await screen.findByText('No se pudo crear el lote')
    expect(alerta.closest('[role="alert"]')).toHaveTextContent('Ningún indicador del lote es válido')
    expect(window.location.hash).toBe('#/analizar/lote')
  })

  it('alterna entre analizar un indicador y un lote', async () => {
    const { user } = renderApp('#/analizar')
    const modos = within(screen.getByRole('navigation', { name: 'Modo de análisis' }))
    expect(modos.getByRole('link', { name: 'Un indicador' })).toHaveAttribute('aria-current', 'page')

    await user.click(modos.getByRole('link', { name: 'Lote de indicadores' }))
    expect(await screen.findByRole('region', { name: 'Analizar lote' })).toBeInTheDocument()
    expect(window.location.hash).toBe('#/analizar/lote')
  })

  it('lista los lotes con su último informe y su decisión', async () => {
    renderApp('#/lotes', { 'GET /batches': reply(200, batchSummaries) })
    const nav = within(screen.getByRole('navigation', { name: 'Navegación principal' }))
    expect(nav.getByRole('link', { name: 'Lotes' })).toHaveAttribute('aria-current', 'page')

    const [primero, segundo] = await screen.findAllByRole('link', { name: /Lote #/ })
    expect(primero).toHaveAttribute('href', '#/lotes/7')
    expect(primero).toHaveTextContent('Triage de prueba')
    expect(primero).toHaveTextContent('Relación demostrable')
    expect(primero).toHaveTextContent('aceptado')
    expect(primero).toHaveTextContent('2 indicador(es) · 1 descartada(s)')
    expect(segundo).toHaveTextContent('Sin nombre')
    expect(segundo).toHaveTextContent('Sin informe')
  })

  it.each([
    ['vacía', reply(200, []), /Aún no hay lotes/],
    ['caída', new TypeError('Failed to fetch'), 'No se pudieron cargar los lotes'],
  ])('avisa si la lista de lotes está %s', async (_caso, respuesta, texto) => {
    renderApp('#/lotes', { 'GET /batches': respuesta })
    expect(await screen.findByText(texto)).toBeInTheDocument()
  })

  it.each([
    ['no existe', fail(404, 'Lote no encontrado'), 'El lote #9 no existe en el backend'],
    ['no responde', new TypeError('Failed to fetch'), 'No se pudo cargar el lote'],
  ])('informa si el lote %s', async (_caso, respuesta, texto) => {
    renderApp('#/lotes/9', { 'GET /batches/9': respuesta })
    expect(await screen.findByText(texto)).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver lotes' })).toHaveAttribute('href', '#/lotes')
  })
})
