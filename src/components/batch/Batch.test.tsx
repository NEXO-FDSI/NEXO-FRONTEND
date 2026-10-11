import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from '../../App'
import type { Investigation } from '../../domain/investigation'
import { deferred, fail, mockBackend, reply, type Reply } from '../../test/fakeBackend'
import {
  batchCreated,
  batchDetail,
  batchSummaries,
  benignEnrichment,
  benignIndicator,
  investigation,
  loteCorrelacion,
  loteCorrelacionRelacion,
  loteReport,
  statusResponse,
  unresolvedCorrelation,
  WANNACRY_HASH,
  wannacryCorrelation,
  wannacryEnrichment,
  wannacrySnapshot,
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

/** WannaCry y 8.8.8.8 ya enriquecidos y correlacionados: nada pendiente en el lote. */
const PROCESADOS: Investigation[] = [
  investigation({ enrichment: wannacrySnapshot, correlation: wannacryCorrelation }),
  investigation({
    indicator: benignIndicator,
    entrada: '8.8.8.8',
    enrichment: { ...wannacrySnapshot, tiene_evidencia: false, fuentes: benignEnrichment.fuentes },
    correlation: unresolvedCorrelation,
  }),
]

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

    expect(await screen.findByRole('button', { name: 'Generar informe conjunto' })).toBeDisabled()
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

  it('genera el informe conjunto, lo muestra por pestañas y registra decisiones con historial', async () => {
    let validaciones = 0
    const { user, calls } = renderApp(
      '#/lotes/7',
      {
        'POST /batches/7/report': reply(201, loteReport),
        'POST /batch-reports/4/validate': ({ body }) =>
          reply(201, { id: ++validaciones, batch_report_id: 4, analista: null, timestamp: `2026-10-10T14:2${validaciones}:00Z`, ...(body as object) }),
      },
      PROCESADOS,
    )
    const resultados = () => within(screen.getByRole('region', { name: 'Resultados del lote' }))

    // Sin informe: la correlación al vuelo, como vista previa. La abstención no es un error.
    const conclusion = await screen.findByRole('region', { name: 'Conclusión del lote' })
    expect(resultados().getByText('Vista previa')).toBeInTheDocument()
    expect(conclusion).toHaveTextContent(loteCorrelacion.conclusion.texto)
    expect(conclusion).toHaveTextContent('La ausencia de relación es un resultado válido')
    expect(conclusion).not.toHaveClass('relacion')
    await user.click(screen.getByRole('tab', { name: /Vínculos/ }))
    expect(screen.getByText('Ningún par de indicadores comparte evidencia')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Cobertura ATT&CK/ }))
    expect(screen.getByText('Sin técnicas que mostrar')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Análisis IA/ }))
    expect(screen.getByText('Sin informe conjunto todavía')).toBeInTheDocument()

    // Generar: una versión nueva que congela la correlación y abre el informe.
    await user.click(screen.getByRole('button', { name: 'Generar informe conjunto' }))
    expect(await screen.findByRole('tab', { name: /Informe y validación/, selected: true })).toBeInTheDocument()
    expect(calls.at(-1)).toEqual({ method: 'POST', path: '/batches/7/report', body: undefined })
    const informe = screen.getByRole('article')
    expect(within(informe).getByRole('heading', { name: 'Informe conjunto — lote #7: Triage de prueba' })).toBeInTheDocument()
    // Los valores van como código: nunca un enlace a infraestructura maliciosa.
    expect(within(informe).getByText('http://evil.example/x').tagName).toBe('CODE')
    expect(within(informe).queryByRole('link')).not.toBeInTheDocument()
    expect(resultados().getByText(/^Informe conjunto #4 · /)).toBeInTheDocument()

    // Resumen, vínculos y cobertura ahora son los de esa versión.
    await user.click(screen.getByRole('tab', { name: /Resumen/ }))
    expect(screen.getByRole('region', { name: 'Conclusión del lote' })).toHaveClass('relacion')
    expect(within(screen.getByRole('region', { name: 'Agrupaciones' })).getByText('A1').closest('li')).toHaveTextContent(
      'vínculos V1 · 2 técnica(s) común(es)',
    )
    await user.click(screen.getByRole('tab', { name: /Vínculos/ }))
    const v1 = within(screen.getByRole('article', { name: 'Vínculo V1' }))
    expect(v1.getByText('Pulse compartido').closest('li')).toHaveTextContent('Pulse compartidofuerteAlienVault OTX')
    expect(v1.getByText('Misma entidad').closest('li')).toHaveTextContent('Misma entidadcontextualCorrelación de NEXO')
    expect(v1.getByRole('link', { name: 'WannaCry IOCs' })).toHaveAttribute(
      'href',
      'https://otx.alienvault.com/pulse/5fd6df943558e0b56eaf3da8',
    )
    expect(v1.getByRole('link', { name: 'WannaCry IOCs' })).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    expect(screen.getByText(/No se consideran señal las técnicas o tácticas compartidas/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Cobertura ATT&CK/ }))
    expect(screen.getByText('Técnicas documentadas, no comportamiento observado')).toBeInTheDocument()
    const t1486 = screen.getByRole('link', { name: 'T1486' })
    expect(t1486).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1486/')
    expect(t1486.closest('li')).toHaveClass('varias')
    expect(t1486.closest('li')).toHaveAttribute('title', 'Documentada para wannacry, emotet')
    expect(screen.getByRole('link', { name: 'T1210' }).closest('li')).not.toHaveClass('varias')

    // Análisis IA con citas a los bloques del lote.
    await user.click(screen.getByRole('tab', { name: /Análisis IA/ }))
    expect(screen.getByText(/Técnicas del lote: primero las documentadas para varias entidades/)).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Ver la fuente E-V1 en el contexto' }))
    expect(screen.getByText('E-V1', { selector: 'span' }).closest('li')).toHaveAttribute('aria-current', 'true')

    // Validación con historial: aceptar y luego rechazar deja dos filas.
    await user.click(screen.getByRole('tab', { name: /Informe y validación/ }))
    expect(screen.getByText(/Conclusión propuesta:/)).toHaveTextContent('Conclusión propuesta: Relación demostrable · A1: I1, I2')
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))
    expect(screen.getByText('Elige si aceptas o rechazas el informe conjunto.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Aceptar/ }))
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))
    expect(await screen.findByText('Decisión registrada: aceptado.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Rechazar/ }))
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))
    expect(await screen.findByText('Estado: Rechazado')).toBeInTheDocument()
    const historial = within(screen.getByRole('region', { name: 'Historial de decisiones' })).getAllByRole('listitem')
    expect(historial.map((li) => li.firstChild?.textContent)).toEqual(['rechazado', 'aceptado'])
    expect(calls.at(-1)).toEqual({ method: 'POST', path: '/batch-reports/4/validate', body: { decision: 'rechazado' } })
  })

  it('cada informe es una versión nueva y pendiente; la anterior conserva su decisión', async () => {
    const { user } = renderApp(
      '#/lotes/7',
      {
        'GET /batches/7': reply(200, batchDetail({
          informes: [loteReport],
          validaciones: [{ id: 1, batch_report_id: 4, decision: 'aceptado', analista: null, timestamp: '2026-10-10T14:21:00Z' }],
        })),
        'POST /batches/7/report': reply(201, {
          ...loteReport, id: 5, conclusion: 'sin_relacion_demostrable', contenido: '# Informe conjunto v5',
          metadatos: { ...loteReport.metadatos!, correlacion: loteCorrelacion },
        }),
        'POST /batch-reports/5/validate': fail(404, 'Informe del lote no encontrado'),
      },
      PROCESADOS,
    )

    await user.click(await screen.findByRole('tab', { name: /Informe y validación/ }))
    expect(screen.getByText('Estado: Aceptado')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Generar informe conjunto' }))
    expect(await screen.findByRole('heading', { name: 'Informe conjunto v5' })).toBeInTheDocument()
    expect(screen.getByText('Estado: Pendiente de validación')).toBeInTheDocument()

    // Un fallo al validar se avisa y no entra al historial.
    await user.click(screen.getByRole('radio', { name: /Rechazar/ }))
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))
    expect(await screen.findByText('No se pudo registrar la decisión')).toBeInTheDocument()
    expect(screen.getByText('Sin decisiones registradas para este informe.')).toBeInTheDocument()

    await user.selectOptions(screen.getByLabelText('Versión'), '4')
    expect(screen.getByRole('heading', { name: 'Informe conjunto — lote #7: Triage de prueba' })).toBeInTheDocument()
    expect(screen.getByText('Estado: Aceptado')).toBeInTheDocument()
  })

  it('en una relación demostrable lista también a los que no se relacionan con el resto', async () => {
    const i3 = { ...loteCorrelacionRelacion.indicadores[0], ref: 'I3', indicator_id: 3, valor: 'googledrive.network',
      entidad: { id: 2, nombre: 'lazarus group', tipo: 'grupo' } }
    renderApp('#/lotes/7', {
      'GET /batches/7': reply(200, batchDetail({
        correlacion: {
          ...loteCorrelacionRelacion,
          indicadores: [...loteCorrelacionRelacion.indicadores, i3],
          conclusion: { ...loteCorrelacionRelacion.conclusion, aislados: ['I3'] },
        },
      })),
    }, PROCESADOS)

    const aislados = within(await screen.findByRole('region', { name: 'Sin relación demostrable con el resto' }))
    expect(aislados.getByText('I3').closest('li')).toHaveTextContent('I3googledrive.networklazarus group')
  })

  it('pide confirmar si quedan indicadores pendientes, muestra la espera y avisa si falla', async () => {
    const gate = deferred<Reply>()
    const { user, paths } = renderApp(
      '#/lotes/7',
      { 'POST /batches/7/report': () => gate.promise },
      [investigation({ enrichment: wannacrySnapshot }), PROCESADOS[1]],
    )

    await user.click(await screen.findByRole('button', { name: 'Generar informe conjunto' }))
    const dialogo = within(screen.getByRole('alertdialog'))
    expect(dialogo.getByText(/1 indicador\(es\) sin procesar/)).toBeInTheDocument()
    await user.click(dialogo.getByRole('button', { name: 'Cancelar' }))
    expect(paths()).not.toContain('POST /batches/7/report')

    await user.click(screen.getByRole('button', { name: 'Generar informe conjunto' }))
    await user.click(within(screen.getByRole('alertdialog')).getByRole('button', { name: 'Generar igual' }))
    expect(await screen.findByText(/Generando informe conjunto…/)).toBeInTheDocument()

    gate.resolve(fail(400, 'Ejecuta /enrich en al menos un indicador del lote antes de generar el informe conjunto'))
    const alerta = await screen.findByText('No se pudo generar el informe conjunto')
    expect(alerta.closest('[role="alert"]')).toHaveTextContent('Ejecuta /enrich en al menos un indicador')
    expect(screen.queryByText(/Generando informe conjunto…/)).not.toBeInTheDocument()
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
