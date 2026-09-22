import { render, screen, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { describe, expect, it, vi } from 'vitest'
import App from './App'
import type { Investigation } from './domain/investigation'
import { deferred, fail, mockBackend, reply, type Reply } from './test/fakeBackend'
import {
  acceptedValidation,
  benignEnrichment,
  benignIndicator,
  benignReport,
  investigation,
  unresolvedCorrelation,
  WANNACRY_HASH,
  wannacryCorrelation,
  wannacryEnrichment,
  wannacryIndicator,
  wannacryReport,
  wannacrySnapshot,
} from './test/fixtures'

type Route = Reply | ((request: { body: unknown }) => Reply | Promise<Reply>)

const WANNACRY_ROUTES: Record<string, Route> = {
  'GET /health': reply(200, { status: 'ok' }),
  'POST /indicators': reply(201, wannacryIndicator),
  'POST /indicators/1/enrich': reply(200, wannacryEnrichment),
  'POST /indicators/1/correlate': reply(200, wannacryCorrelation),
  'POST /indicators/1/report': reply(201, wannacryReport),
  'POST /reports/1/validate': ({ body }) => reply(201, { ...acceptedValidation, ...(body as object) }),
}

function renderApp(routes: Record<string, Route> = {}, history: Investigation[] = []) {
  if (history.length > 0) window.localStorage.setItem('nexo.investigations.v1', JSON.stringify(history))
  const backend = mockBackend({ ...WANNACRY_ROUTES, ...routes })
  const user = userEvent.setup()
  render(<App />)
  return { ...backend, user }
}

const chain = () => within(screen.getByRole('region', { name: 'Cadena de evidencia' }))
const sidebar = () => within(screen.getByRole('complementary'))

async function registerIndicator(user: ReturnType<typeof userEvent.setup>, tipo: string, valor: string) {
  await user.click(screen.getByRole('radio', { name: tipo }))
  await user.clear(screen.getByLabelText('Valor'))
  await user.type(screen.getByLabelText('Valor'), valor)
  await user.click(screen.getByRole('button', { name: 'Registrar indicador' }))
}

describe('NEXO Intel', () => {
  it('lleva un IoC conocido por todo el pipeline hasta la validación del analista', async () => {
    const { user, paths, calls } = renderApp()
    expect(screen.getByText('Cómo funciona NEXO')).toBeInTheDocument()
    expect(await screen.findByText('API en línea')).toBeInTheDocument()

    await registerIndicator(user, 'Hash', WANNACRY_HASH.toUpperCase())
    await user.type(screen.getByLabelText(/Fuente/), 'x') // el formulario sigue usable tras enviar

    expect(await screen.findByText('Indicador #1 registrado.')).toBeInTheDocument()
    expect(screen.getByText(/Forma canónica/)).toBeInTheDocument()
    expect(await chain().findByText('wannacry')).toBeInTheDocument()
    expect(chain().getByText('3 técnica(s) ATT&CK')).toBeInTheDocument()
    expect(chain().getByRole('meter', { name: 'Confianza de la asociación' })).toHaveAttribute('aria-valuenow', '90')
    expect(chain().getByText(/respaldado por 2 pulse/)).toBeInTheDocument()
    await vi.waitFor(() => expect(paths()).toContain('POST /indicators/1/report'))
    expect(calls[1].body).toEqual({ tipo: 'hash', valor: WANNACRY_HASH.toUpperCase(), fuente: null })

    // Enriquecimiento: pulses, volcado agregado descartado y tags resumidos.
    await user.click(screen.getByRole('tab', { name: /Enriquecimiento/ }))
    const table = await screen.findByRole('table', { name: /Pulses de OTX/ })
    expect(within(table).getByText('WannaCry Indicators')).toBeInTheDocument()
    expect(within(table).getByText('Volcado agregado')).toBeInTheDocument()
    expect(within(table).getByText('+2 más')).toBeInTheDocument()
    expect(screen.getByText(/mostrando 2 de 50/)).toBeInTheDocument()

    // ATT&CK: técnicas agrupadas por táctica en orden de kill chain.
    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    const tactics = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(tactics).toEqual(['Lateral Movement1', 'Impact2'])
    expect(screen.getByRole('link', { name: /T1210/ })).toHaveAttribute(
      'href',
      'https://attack.mitre.org/techniques/T1210/',
    )

    // Informe en Markdown, con la tabla y enlaces aislados.
    await user.click(screen.getByRole('tab', { name: /Informe/ }))
    expect(screen.getByRole('cell', { name: 'T1486' })).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'ATT&CK' })).toHaveAttribute('rel', 'noopener noreferrer')

    // Validación humana desde el stepper.
    await user.click(screen.getByRole('button', { name: 'Validar' }))
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))
    expect(screen.getByText('Elige si aceptas o rechazas la asociación.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Aceptar/ }))
    await user.type(screen.getByLabelText(/Analista/), 'analista SOC N1')
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))

    expect(await screen.findByText('Decisión registrada: aceptado.')).toBeInTheDocument()
    expect(screen.getByText('Estado: Aceptado')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Historial de decisiones' })).getByText('analista SOC N1')).toBeInTheDocument()
    expect(calls.at(-1)).toMatchObject({ path: '/reports/1/validate', body: { decision: 'aceptado', analista: 'analista SOC N1' } })
    expect(window.localStorage.getItem('nexo.analista')).toBe('analista SOC N1')

    const kpis = within(screen.getByRole('region', { name: 'Resumen de investigaciones' }))
    expect(kpis.getByText('Validados').previousSibling).toHaveTextContent('1')
    expect(JSON.parse(window.localStorage.getItem('nexo.investigations.v1')!)[0].validations).toHaveLength(1)
  })

  it('declara "sin asociación" para un indicador benigno y no atribuye técnicas', async () => {
    const { user } = renderApp({
      'POST /indicators': reply(201, benignIndicator),
      'POST /indicators/2/enrich': reply(200, benignEnrichment),
      'POST /indicators/2/correlate': reply(200, unresolvedCorrelation),
      'POST /indicators/2/report': reply(201, benignReport),
    })

    await user.click(screen.getByRole('button', { name: 'IP benigna' }))
    expect(screen.getByLabelText('Valor')).toHaveValue('8.8.8.8')
    await user.click(screen.getByRole('button', { name: 'Registrar indicador' }))

    expect(await chain().findByText('Sin asociación')).toBeInTheDocument()
    expect(chain().getByText('No se ejecuta')).toBeInTheDocument()
    expect(screen.getByText(/La ausencia de asociación es un resultado válido/)).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /Enriquecimiento/ }))
    expect(await screen.findByText('Whitelisted IP')).toBeInTheDocument()
    expect(screen.getByText('Ningún pulse de OTX menciona este indicador.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    expect(screen.getByText('Sin técnicas atribuidas')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Validación/ }))
    expect(await screen.findByText('ninguna')).toBeInTheDocument()
  })

  it('distingue un 502 de OTX de "sin evidencia" y permite reintentar', async () => {
    let attempts = 0
    const { user, paths } = renderApp({
      'POST /indicators/1/enrich': () =>
        ++attempts === 1
          ? fail(502, 'El servicio de reputación no respondió: OTX respondió 503')
          : reply(200, wannacryEnrichment),
    })

    await registerIndicator(user, 'Hash', WANNACRY_HASH)

    const alert = await screen.findByRole('alert')
    expect(alert).toHaveTextContent('No se pudo verificar la reputación')
    expect(alert).toHaveTextContent('NO significa "sin evidencia"')
    expect(paths()).not.toContain('POST /indicators/1/correlate')

    await user.click(within(alert).getByRole('button', { name: 'Reintentar' }))
    await vi.waitFor(() => expect(screen.queryByRole('alert')).not.toBeInTheDocument())

    await user.click(screen.getByRole('button', { name: 'Análisis completo' }))
    expect(await screen.findByRole('tab', { name: /Informe/, selected: true })).toBeInTheDocument()
    expect(paths()).toContain('POST /indicators/1/report')
    expect(screen.getByRole('button', { name: 'Análisis completo' })).toBeDisabled()
  })

  it('permite ejecutar cada paso a mano, regenerar el informe y elegir su versión', async () => {
    const report = deferred<Reply>()
    let reports = 0
    const { user, paths } = renderApp({
      'POST /indicators/1/report': () =>
        ++reports === 1
          ? report.promise
          : reply(201, { ...wannacryReport, id: 3, contenido: '# Informe regenerado', nivel_confianza: 0.6 }),
    })

    await user.click(screen.getByLabelText(/Analizar automáticamente/))
    await registerIndicator(user, 'Hash', WANNACRY_HASH)
    expect(await screen.findByText('Sin enriquecimiento todavía')).toBeInTheDocument()
    expect(paths()).toEqual(['GET /health', 'POST /indicators'])

    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    expect(screen.getByRole('button', { name: 'Ejecutar correlación' })).toBeDisabled()
    expect(screen.getByText('Requiere completar antes el enriquecimiento.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Enriquecimiento/ }))
    await user.click(screen.getByRole('button', { name: 'Ejecutar enriquecimiento' }))
    expect(await screen.findByRole('table', { name: /Pulses de OTX/ })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    await user.click(screen.getByRole('button', { name: 'Ejecutar correlación' }))
    expect(await screen.findByRole('heading', { name: /Impact/ })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Informe/ }))
    await user.click(screen.getByRole('button', { name: 'Ejecutar informe' }))
    expect(await screen.findByText(/Generando informe…/)).toBeInTheDocument()
    report.resolve(reply(201, wannacryReport))
    expect(await screen.findByText('Informe #1', { exact: false })).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Regenerar' }))
    expect(await screen.findByRole('heading', { name: 'Informe regenerado' })).toBeInTheDocument()
    const version = screen.getByLabelText('Versión')
    await user.selectOptions(version, '1')
    expect(screen.getByRole('cell', { name: 'T1486' })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Validación/ }))
    expect(screen.getByText('Informe #1')).toBeInTheDocument()
  })

  it('recupera el historial guardado y la respuesta cruda desde la caché del backend', async () => {
    const saved = investigation({
      enrichment: wannacrySnapshot,
      correlation: wannacryCorrelation,
      reports: [wannacryReport],
    })
    const { user, paths } = renderApp({}, [saved])

    expect(await screen.findByRole('tab', { name: /Informe/, selected: true })).toBeInTheDocument()
    expect(sidebar().getByText('Pendiente de validación')).toBeInTheDocument()
    expect(screen.getByText('Entrada original')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Enriquecimiento/ }))
    await user.click(screen.getByText(/Respuesta cruda de OTX/))
    await user.click(screen.getByRole('button', { name: 'Recargar desde la caché del backend' }))

    expect(await screen.findByText(/"pulse_info"/)).toBeInTheDocument()
    expect(paths()).toContain('POST /indicators/1/enrich')
  })

  it('marca la investigación cuando el backend ya no la tiene y permite quitarla', async () => {
    const confirm = vi.spyOn(window, 'confirm').mockReturnValueOnce(false).mockReturnValueOnce(true)
    const { user } = renderApp({ 'POST /indicators/1/enrich': fail(404, 'Indicador no encontrado') }, [investigation()])

    await user.click(await screen.findByRole('button', { name: 'Análisis completo' }))

    expect(await screen.findByText('Este indicador ya no existe en el backend')).toBeInTheDocument()
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[1]).toHaveTextContent('El recurso ya no existe en el backend')
    expect(within(alerts[1]).queryByRole('button', { name: 'Reintentar' })).toBeNull()
    expect(sidebar().getByText('No existe en backend')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: 'Análisis completo' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Descartar aviso' }))
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    await user.click(screen.getByRole('button', { name: 'Quitar del historial' }))
    expect(screen.getByText('Este indicador ya no existe en el backend')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Quitar del historial' }))
    expect(confirm).toHaveBeenCalledTimes(2)
    expect(screen.getByText('Cómo funciona NEXO')).toBeInTheDocument()
  })

  it('reporta los errores del registro de forma accionable', async () => {
    const { user } = renderApp(
      {
        'GET /health': new TypeError('Failed to fetch'),
        'POST /indicators': ({ body }) => {
          const { valor } = body as { valor: string }
          if (valor === 'no-es-ip') return fail(422, [{ loc: ['body'], msg: "Value error, 'no-es-ip' no tiene formato válido de tipo 'ip'" }])
          if (valor === '1.1.1.1') return fail(409, 'El indicador ya existe')
          if (valor === WANNACRY_HASH) return fail(409, 'El indicador ya existe')
          return new TypeError('Failed to fetch')
        },
      },
      [investigation({ indicator: benignIndicator, entrada: '8.8.8.8' }), investigation()],
    )
    expect(await screen.findByText('API fuera de línea')).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Registrar indicador' }))
    expect(screen.getByText('Escribe el valor del indicador.')).toBeInTheDocument()
    expect(screen.getByLabelText('Valor')).toHaveAttribute('aria-invalid', 'true')

    await registerIndicator(user, 'IP', 'no-es-ip')
    expect(await screen.findByText('Datos inválidos')).toBeInTheDocument()
    expect(screen.getByText("'no-es-ip' no tiene formato válido de tipo 'ip'")).toBeInTheDocument()

    await registerIndicator(user, 'IP', '1.1.1.1')
    expect(await screen.findByText('El indicador ya existe en el backend.')).toBeInTheDocument()

    await registerIndicator(user, 'IP', '9.9.9.9')
    expect(await screen.findByText('Backend inaccesible')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Descartar aviso' }))
    expect(screen.queryByText('Backend inaccesible')).not.toBeInTheDocument()

    // 409 de un indicador que sí está en el historial local: se abre esa investigación.
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('8.8.8.8')
    await registerIndicator(user, 'Hash', WANNACRY_HASH)
    expect(await screen.findByText('Ese indicador ya estaba registrado.')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(WANNACRY_HASH)
  })

  it('filtra y selecciona investigaciones del historial', async () => {
    const scrollIntoView = vi.fn()
    Element.prototype.scrollIntoView = scrollIntoView
    vi.stubGlobal('matchMedia', vi.fn(() => ({ matches: true })))
    const resolved = investigation({ enrichment: wannacrySnapshot, correlation: wannacryCorrelation })
    const unresolved = investigation({ indicator: benignIndicator, entrada: '8.8.8.8', correlation: unresolvedCorrelation })
    const { user } = renderApp({}, [unresolved, resolved])

    expect(sidebar().getByText('Sin asociación')).toBeInTheDocument()
    const search = sidebar().getByLabelText('Buscar investigaciones')
    await user.type(search, 'WANNA')
    expect(sidebar().queryByText('8.8.8.8')).not.toBeInTheDocument()

    await user.click(sidebar().getByRole('button', { name: /wannacry/ }))
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(WANNACRY_HASH)
    expect(sidebar().getByRole('button', { name: /wannacry/ })).toHaveAttribute('aria-current', 'true')
    expect(scrollIntoView).toHaveBeenCalled()

    await user.clear(search)
    await user.type(search, 'zzz')
    expect(sidebar().getByText('Ninguna investigación coincide con “zzz”.')).toBeInTheDocument()
  })

  it('muestra el avance de un paso en la lista mientras corre', async () => {
    const enrich = deferred<Reply>()
    const { user } = renderApp({ 'POST /indicators/1/enrich': () => enrich.promise }, [investigation()])

    await user.click(await screen.findByRole('button', { name: 'Análisis completo' }))
    expect(sidebar().getByText('Procesando')).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /Analizando/ })).toBeDisabled()

    enrich.resolve(fail(500, 'Error interno del servidor'))
    expect(await screen.findByText('No se pudo enriquecer el indicador')).toBeInTheDocument()
    expect(sidebar().queryByText('Procesando')).not.toBeInTheDocument()
  })

  it('avisa si el navegador no puede guardar el historial', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    renderApp()
    expect(await screen.findByText('El historial no se está guardando')).toBeInTheDocument()
  })

  it('descarga y copia el informe en Markdown', async () => {
    const createObjectURL = vi.fn(() => 'blob:nexo')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user } = renderApp({}, [investigation({ enrichment: wannacrySnapshot, reports: [wannacryReport] })])
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()

    await user.click(await screen.findByRole('button', { name: 'Descargar .md' }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:nexo')

    await user.click(screen.getByRole('button', { name: 'Copiar informe en Markdown' }))
    expect(writeText).toHaveBeenCalledWith(wannacryReport.contenido)
  })
})
