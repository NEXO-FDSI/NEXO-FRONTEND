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
  statusResponse,
  unresolvedCorrelation,
  WANNACRY_HASH,
  wannacryCorrelation,
  wannacryEnrichment,
  wannacryIndicator,
  wannacryReport,
  wannacrySnapshot,
} from './test/fixtures'

type Route = Reply | ((request: { body: unknown; query: URLSearchParams }) => Reply | Promise<Reply>)

/** Snapshot mínimo de GET /indicators/{id}: la fusión es monotónica, así que no pisa lo local. */
const soloIndicador = (indicator: typeof wannacryIndicator) =>
  reply(200, { indicator, enrichment: null, correlation: null, reports: [], validations: [] })

const WANNACRY_ROUTES: Record<string, Route> = {
  'GET /health': reply(200, { status: 'ok' }),
  'GET /indicators/1': soloIndicador(wannacryIndicator),
  'GET /indicators/2': soloIndicador(benignIndicator),
  'GET /status': reply(200, statusResponse),
  'POST /indicators': reply(201, wannacryIndicator),
  'POST /indicators/1/enrich': reply(200, wannacryEnrichment),
  'POST /indicators/1/correlate': reply(200, wannacryCorrelation),
  'POST /indicators/1/report': reply(201, wannacryReport),
  'POST /reports/1/validate': ({ body }) => reply(201, { ...acceptedValidation, ...(body as object) }),
}

function renderApp(routes: Record<string, Route> = {}, history: Investigation[] = [], hash = '') {
  if (history.length > 0) window.localStorage.setItem('nexo.investigations.v1', JSON.stringify(history))
  window.location.hash = hash
  const backend = mockBackend({ ...WANNACRY_ROUTES, ...routes })
  const user = userEvent.setup()
  render(<App />)
  return { ...backend, user }
}

type User = ReturnType<typeof userEvent.setup>

const chain = () => within(screen.getByRole('region', { name: 'Cadena de evidencia' }))
const nav = () => within(screen.getByRole('navigation', { name: 'Navegación principal' }))
const list = () => within(screen.getByRole('region', { name: 'Investigaciones' }))

async function openAnalyze(user: User) {
  await user.click(screen.getByRole('link', { name: 'Analizar indicador' }))
  await screen.findByRole('region', { name: 'Analizar indicador' })
}

async function registerIndicator(user: User, tipo: string, valor: string) {
  if (!screen.queryByRole('region', { name: 'Analizar indicador' })) await openAnalyze(user)
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
    expect(await screen.findByText(/IA: groq/)).toHaveTextContent('IA: groq · qwen/qwen3.8-27b')

    await registerIndicator(user, 'Hash', WANNACRY_HASH.toUpperCase())

    // Al registrar se abre la investigación, con su ruta enlazable.
    expect(await chain().findByText('wannacry')).toBeInTheDocument()
    expect(window.location.hash).toBe('#/investigaciones/1')
    expect(screen.getByRole('navigation', { name: 'Ruta de navegación' })).toHaveTextContent('Investigaciones')
    expect(screen.getByText('Entrada original')).toBeInTheDocument()
    expect(chain().getByText('3 técnica(s) ATT&CK')).toBeInTheDocument()
    expect(chain().getByRole('meter', { name: 'Confianza de la asociación' })).toHaveAttribute('aria-valuenow', '90')
    expect(chain().getByText(/respaldado por 2 pulse/)).toBeInTheDocument()
    await vi.waitFor(() => expect(paths()).toContain('POST /indicators/1/report'))
    expect(calls.find((c) => c.method === 'POST' && c.path === '/indicators')?.body).toEqual({
      tipo: 'hash',
      valor: WANNACRY_HASH.toUpperCase(),
      fuente: null,
    })

    // Cabecera: severidad y estado de cada fuente.
    // En la cabecera del caso y en el resumen.
    expect(await screen.findAllByText('Crítica')).toHaveLength(2)
    const chips = within(screen.getByRole('list', { name: 'Estado de las fuentes' }))
    expect(chips.getByText('VirusTotal').parentElement).toHaveTextContent('VirusTotalcon registros')
    expect(chips.getByText('ThreatFox').parentElement).toHaveTextContent('ThreatFoxsin registros')

    // Resumen: motivos de la severidad, concordancia entre fuentes y resumen de la IA.
    const resumen = within(screen.getByRole('tabpanel'))
    expect(resumen.getByText('VirusTotal: 69 motores maliciosos, 0 sospechosos')).toBeInTheDocument()
    expect(resumen.getByText('VirusTotal concuerda: sus familias apuntan a wannacry.')).toBeInTheDocument()
    expect(resumen.getByRole('region', { name: 'Resumen de la IA' })).toHaveTextContent('ransomware gusano')
    expect(resumen.getByRole('region', { name: 'Nivel de confianza' })).toHaveTextContent(
      'Confianza altawannacry respaldada por 2 fuentes: AlienVault OTX y VirusTotal',
    )
    expect(resumen.queryByRole('region', { name: 'Contradicciones entre fuentes' })).not.toBeInTheDocument()

    // Análisis IA: cada cita resalta su bloque en el contexto enviado al modelo.
    await user.click(resumen.getByRole('button', { name: 'Ver análisis y trazabilidad' }))
    expect(screen.getByRole('tab', { name: /Análisis IA/, selected: true })).toBeInTheDocument()
    const contexto = within(screen.getByRole('region', { name: 'Contexto enviado al modelo' }))
    const bloqueVT = contexto.getByText('E-VT').closest('li')!
    expect(bloqueVT).not.toHaveAttribute('aria-current')
    const [citaVT] = screen.getAllByRole('button', { name: 'Ver la fuente E-VT en el contexto' })
    await user.click(citaVT)
    expect(citaVT).toHaveAttribute('aria-pressed', 'true')
    expect(bloqueVT).toHaveAttribute('aria-current', 'true')
    await user.click(citaVT)
    expect(bloqueVT).not.toHaveAttribute('aria-current')
    expect(screen.getByText('Hipótesis')).toBeInTheDocument()
    expect(within(screen.getByRole('tabpanel')).getByText('qwen/qwen3.8-27b')).toBeInTheDocument()
    expect(screen.getByText('2013 + 541 tokens')).toBeInTheDocument()
    expect(screen.getByText('0 afirmaciones descartadas')).toBeInTheDocument()
    expect(screen.getByText('Ver el prompt exacto')).toBeInTheDocument()

    // Inteligencia: una pestaña por fuente; se abre la primera con evidencia (OTX, con sus pulses).
    await user.click(screen.getByRole('tab', { name: /Inteligencia/ }))
    expect(screen.getByRole('tab', { name: /Con evidencia.*AlienVault OTX/ })).toHaveAttribute('aria-selected', 'true')
    expect(within(screen.getByRole('region', { name: 'AlienVault OTX' })).getByText(/1 volcados masivos ignorados/)).toBeInTheDocument()
    const table = await screen.findByRole('table', { name: /Pulses de OTX/ })
    expect(within(table).getByText('WannaCry Indicators')).toBeInTheDocument()
    expect(within(table).queryByText('Volcado agregado')).not.toBeInTheDocument()
    expect(within(table).getByText('+2 más')).toBeInTheDocument()
    expect(screen.getByText(/mostrando 2 de 50/)).toBeInTheDocument()
    expect(screen.queryByText(/Respuesta cruda de OTX/)).not.toBeInTheDocument()
    // Evidencia normalizada de OTX: técnicas que cita y referencias (solo http/https).
    expect(screen.getByRole('link', { name: 'T1486' })).toHaveAttribute('href', 'https://attack.mitre.org/techniques/T1486/')
    expect(screen.getByRole('link', { name: /cisa\.gov/ })).toHaveAttribute('rel', 'noopener noreferrer nofollow')
    await user.click(screen.getByRole('tab', { name: /VirusTotal/ }))
    expect(within(screen.getByRole('region', { name: 'VirusTotal' })).getByRole('img')).toHaveAccessibleName(
      '69 de 71 motores maliciosos, 0 sospechosos',
    )
    await user.click(screen.getByRole('tab', { name: /Sin evidencia.*ThreatFox/ }))
    expect(within(screen.getByRole('region', { name: 'ThreatFox' })).getByText(/no tiene registros de este indicador/)).toBeInTheDocument()

    // ATT&CK: técnicas agrupadas por táctica en orden de kill chain.
    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    const tactics = screen.getAllByRole('heading', { level: 3 }).map((h) => h.textContent)
    expect(tactics).toEqual(['Lateral Movement1', 'Impact2'])
    expect(screen.getByRole('link', { name: /T1210/ })).toHaveAttribute(
      'href',
      'https://attack.mitre.org/techniques/T1210/',
    )
    // La IA destacó T1210: se marca con su motivo, sin cambiar la lista determinística.
    expect(screen.getByRole('link', { name: /T1210/ })).toHaveTextContent('destacada por el análisis')
    expect(screen.getByRole('link', { name: /T1486/ })).not.toHaveTextContent('IA')
    // Procedencia: de qué fuentes sale cada técnica.
    expect(screen.getByText(/Entidad respaldada por/)).toHaveTextContent('Entidad respaldada por OTX, VirusTotal.')
    expect(screen.getByRole('link', { name: /T1486/ })).toHaveTextContent('Vía OTX, VirusTotal · citada por OTX')
    expect(screen.getByRole('link', { name: /T1210/ })).toHaveTextContent('Vía OTX, VirusTotal')

    // Informe en Markdown, con la tabla y enlaces aislados.
    await user.click(screen.getByRole('tab', { name: /Informe/ }))
    expect(screen.getByRole('cell', { name: 'T1486' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'vía entidad: AlienVault OTX, VirusTotal; citada por AlienVault OTX' })).toBeInTheDocument()
    expect(screen.getByText('Confianza alta')).toHaveAttribute('title', 'wannacry respaldada por 2 fuentes: AlienVault OTX y VirusTotal')
    expect(screen.getByRole('link', { name: 'ATT&CK' })).toHaveAttribute('rel', 'noopener noreferrer')

    // Validación humana desde el stepper.
    await user.click(screen.getByRole('button', { name: 'Validar' }))
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))
    expect(screen.getByText('Elige si aceptas o rechazas la asociación.')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: /Aceptar/ }))
    expect(screen.queryByRole('textbox', { name: /Analista/ })).not.toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Registrar decisión' }))

    expect(await screen.findByText('Decisión registrada: aceptado.')).toBeInTheDocument()
    expect(screen.getByText('Estado: Aceptado')).toBeInTheDocument()
    expect(within(screen.getByRole('region', { name: 'Historial de decisiones' })).getByText('Analista no identificado')).toBeInTheDocument()
    expect(calls.at(-1)).toEqual({ method: 'POST', path: '/reports/1/validate', body: { decision: 'aceptado' } })

    await user.click(nav().getByRole('link', { name: /Panel/ }))
    const kpis = within(await screen.findByRole('region', { name: 'Resumen de investigaciones' }))
    expect(kpis.getByText('Críticas o altas').previousSibling).toHaveTextContent('1')
    expect(kpis.getByText('Pendientes de validación').previousSibling).toHaveTextContent('0')
    // Fuentes y modelo: solo cada fuente con su configuración y el proveedor de IA activo.
    expect(screen.getByText('groq · qwen/qwen3.8-27b')).toBeInTheDocument()
    expect(screen.queryByText(/Último|Sin consultas|espaldo|último análisis/)).not.toBeInTheDocument()
    expect(JSON.parse(window.localStorage.getItem('nexo.investigations.v1')!)[0].validations).toHaveLength(1)
    // Las fuentes del enriquecimiento se guardan; la respuesta de OTX no.
    const [guardada] = JSON.parse(window.localStorage.getItem('nexo.investigations.v1')!)
    expect(guardada.enrichment.fuentes.map((f: { estado: string }) => f.estado)).toEqual([
      'con_evidencia',
      'sin_evidencia',
      'con_evidencia',
    ])
    expect(guardada.enrichment.detalle).toBeUndefined()
  })

  it('declara "sin asociación" para un indicador benigno y no atribuye técnicas', async () => {
    const { user, paths } = renderApp({
      'POST /indicators': reply(201, benignIndicator),
      'POST /indicators/2/enrich': reply(200, benignEnrichment),
      'POST /indicators/2/correlate': reply(200, unresolvedCorrelation),
      'POST /indicators/2/report': reply(201, benignReport),
    })

    await openAnalyze(user)
    await user.click(screen.getByRole('button', { name: 'IP benigna' }))
    expect(screen.getByLabelText('Valor')).toHaveValue('8.8.8.8')
    await user.click(screen.getByRole('button', { name: 'Registrar indicador' }))

    expect(await chain().findByText('Sin asociación')).toBeInTheDocument()
    expect(chain().getByText('No se ejecuta')).toBeInTheDocument()
    expect(screen.getByText(/La ausencia de asociación es un resultado válido/)).toBeInTheDocument()
    // Cobertura parcial: VirusTotal alcanzó su cuota; ThreatFox no configurada no cuenta.
    expect(screen.getByText('Enriquecido con 1 de 2 fuentes')).toBeInTheDocument()
    expect(screen.getByText(/VirusTotal \(límite de cuota\)/)).toBeInTheDocument()
    // Reintentar solo vuelve a pedir /enrich: el backend reutiliza la caché de lo que respondió.
    const enrichCalls = () => paths().filter((p) => p === 'POST /indicators/2/enrich').length
    expect(enrichCalls()).toBe(1)
    await user.click(screen.getByRole('button', { name: 'Reintentar fuentes' }))
    await vi.waitFor(() => expect(enrichCalls()).toBe(2))

    await user.click(screen.getByRole('tab', { name: /Inteligencia/ }))
    expect(await screen.findByText('Whitelisted IP')).toBeInTheDocument()
    expect(screen.getByText('Ningún pulse de OTX menciona este indicador.')).toBeInTheDocument()
    await user.click(screen.getByRole('tab', { name: /No verificado.*VirusTotal/ }))
    expect(within(screen.getByRole('region', { name: 'VirusTotal' })).getByText(/NO significa "sin evidencia"/)).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    expect(screen.getByText('Sin técnicas atribuidas')).toBeInTheDocument()

    // Informe sin metadatos (anterior a la Fase 4): se explica en vez de romperse.
    await user.click(screen.getByRole('tab', { name: /Análisis IA/ }))
    expect(screen.getByText('Informe anterior a la trazabilidad de IA')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Informe y validación/ }))
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
    expect(await screen.findByRole('tab', { name: /Resumen/, selected: true })).toBeInTheDocument()
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

    await openAnalyze(user)
    await user.click(screen.getByLabelText(/Analizar automáticamente/))
    await registerIndicator(user, 'Hash', WANNACRY_HASH)
    await user.click(await screen.findByRole('tab', { name: /Inteligencia/ }))
    expect(await screen.findByText('Sin enriquecimiento todavía')).toBeInTheDocument()
    expect(paths().filter((p) => p.startsWith('POST'))).toEqual(['POST /indicators'])

    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    expect(screen.getByRole('button', { name: 'Ejecutar correlación' })).toBeDisabled()
    expect(screen.getByText('Requiere completar antes el enriquecimiento.')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Análisis IA/ }))
    expect(screen.getByText('Sin análisis todavía')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Inteligencia/ }))
    await user.click(screen.getByRole('button', { name: 'Ejecutar enriquecimiento' }))
    expect(await screen.findByRole('table', { name: /Pulses de OTX/ })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /MITRE ATT&CK/ }))
    await user.click(screen.getByRole('button', { name: 'Ejecutar correlación' }))
    expect(await screen.findByRole('heading', { name: /Impact/ })).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Informe/ }))
    await user.click(screen.getByRole('button', { name: 'Ejecutar informe' }))
    expect(await screen.findByText(/Generando informe…/)).toBeInTheDocument()
    report.resolve(reply(201, wannacryReport))
    expect(await screen.findByText(/^Informe #1 ·/)).toBeInTheDocument()

    await user.click(screen.getByRole('button', { name: 'Regenerar' }))
    expect(await screen.findByRole('heading', { name: 'Informe regenerado' })).toBeInTheDocument()
    const version = screen.getByLabelText('Versión')
    await user.selectOptions(version, '1')
    expect(screen.getByRole('cell', { name: 'T1486' })).toBeInTheDocument()
    expect(screen.getByRole('cell', { name: 'vía entidad: AlienVault OTX, VirusTotal; citada por AlienVault OTX' })).toBeInTheDocument()
    expect(screen.getByText('Confianza alta')).toHaveAttribute('title', 'wannacry respaldada por 2 fuentes: AlienVault OTX y VirusTotal')

    expect(screen.getByText('Informe #1')).toBeInTheDocument() // panel de validación, misma pestaña
  })

  it('recupera el historial guardado y muestra OTX sin la respuesta cruda', async () => {
    const saved = investigation({
      enrichment: wannacrySnapshot,
      correlation: wannacryCorrelation,
      reports: [wannacryReport],
    })
    const { user, paths } = renderApp({}, [saved], '#/investigaciones')

    expect(list().getByText('Pendiente de validación')).toBeInTheDocument()
    await user.click(list().getByRole('link', { name: /wannacry/ }))
    expect(await screen.findByRole('tab', { name: /Resumen/, selected: true })).toBeInTheDocument()
    expect(screen.getByText('Entrada original')).toBeInTheDocument()

    await user.click(screen.getByRole('tab', { name: /Inteligencia/ }))
    expect(await screen.findByRole('table', { name: /Pulses de OTX/ })).toBeInTheDocument()
    expect(screen.queryByText(/Respuesta cruda de OTX|"pulse_info"/)).not.toBeInTheDocument()
    expect(paths()).not.toContain('POST /indicators/1/enrich')
  })

  it('marca la investigación cuando el backend ya no la tiene', async () => {
    const { user } = renderApp(
      { 'POST /indicators/1/enrich': fail(404, 'Indicador no encontrado') },
      [investigation()],
      '#/investigaciones/1',
    )

    await user.click(await screen.findByRole('button', { name: 'Análisis completo' }))

    expect(await screen.findByText('Este indicador ya no existe en el backend')).toBeInTheDocument()
    const alerts = screen.getAllByRole('alert')
    expect(alerts).toHaveLength(2)
    expect(alerts[1]).toHaveTextContent('El recurso ya no existe en el backend')
    expect(within(alerts[1]).queryByRole('button', { name: 'Reintentar' })).toBeNull()
    expect(screen.getByRole('button', { name: 'Análisis completo' })).toBeDisabled()

    await user.click(screen.getByRole('button', { name: 'Descartar aviso' }))
    expect(screen.getAllByRole('alert')).toHaveLength(1)

    await user.click(nav().getByRole('link', { name: /Investigaciones/ }))
    expect(await list().findByText('No existe en backend')).toBeInTheDocument()
  })

  it('reporta los errores del registro de forma accionable', async () => {
    const { user } = renderApp(
      {
        'GET /health': new TypeError('Failed to fetch'),
        'GET /status': new TypeError('Failed to fetch'),
        'POST /indicators': ({ body }) => {
          const { valor } = body as { valor: string }
          if (valor === 'no-es-ip') return fail(422, [{ loc: ['body'], msg: "Value error, 'no-es-ip' no tiene formato válido de tipo 'ip'" }])
          if (valor === '1.1.1.1') return fail(409, 'El indicador ya existe')
          if (valor === WANNACRY_HASH) return fail(409, 'El indicador ya existe')
          return new TypeError('Failed to fetch')
        },
      },
      [investigation({ indicator: benignIndicator, entrada: '8.8.8.8' }), investigation()],
      '#/analizar',
    )
    expect(await screen.findByText('API fuera de línea')).toBeInTheDocument()
    // Sin /status no se muestra el proveedor de IA (no se inventa).
    expect(screen.queryByText(/IA:/)).not.toBeInTheDocument()

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
    await registerIndicator(user, 'Hash', WANNACRY_HASH)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(WANNACRY_HASH)
    expect(window.location.hash).toBe('#/investigaciones/1')
  })

  it('detecta el tipo del indicador al pegarlo', async () => {
    const { user } = renderApp({}, [], '#/analizar')
    await user.click(screen.getByLabelText('Valor'))
    await user.paste('hxxp://evil[.]example.com/payload')
    expect(screen.getByRole('radio', { name: 'URL' })).toBeChecked()
    await user.clear(screen.getByLabelText('Valor'))
    await user.paste(WANNACRY_HASH)
    expect(screen.getByRole('radio', { name: 'Hash' })).toBeChecked()
    // Lo que no se reconoce no cambia la elección del analista.
    await user.click(screen.getByRole('radio', { name: 'Dominio' }))
    await user.clear(screen.getByLabelText('Valor'))
    await user.paste('algo raro')
    expect(screen.getByRole('radio', { name: 'Dominio' })).toBeChecked()
  })

  it('filtra la lista de investigaciones y abre la elegida', async () => {
    const resolved = investigation({ enrichment: wannacrySnapshot, correlation: wannacryCorrelation })
    const unresolved = investigation({ indicator: benignIndicator, entrada: '8.8.8.8', correlation: unresolvedCorrelation })
    const { user } = renderApp({}, [unresolved, resolved], '#/investigaciones')

    expect(nav().getByRole('link', { name: /Investigaciones/ })).toHaveAttribute('aria-current', 'page')
    expect(list().getByText('Sin asociación')).toBeInTheDocument()
    const search = list().getByLabelText('Buscar investigaciones')
    await user.type(search, 'WANNA')
    expect(list().queryByText('8.8.8.8')).not.toBeInTheDocument()

    await user.click(list().getByRole('link', { name: /wannacry/ }))
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(WANNACRY_HASH)
    // El detalle sigue marcando "Investigaciones" en la navegación.
    expect(nav().getByRole('link', { name: /Investigaciones/ })).toHaveAttribute('aria-current', 'page')

    await user.click(nav().getByRole('link', { name: /Investigaciones/ }))
    const search2 = await list().findByLabelText('Buscar investigaciones')
    await user.type(search2, 'zzz')
    expect(list().getByText('Ninguna investigación coincide con “zzz”.')).toBeInTheDocument()
  })

  it('si la investigación de la URL no está en el navegador la busca en el backend', async () => {
    renderApp({}, [], '#/investigaciones/99') // GET /indicators/99 no declarado → 404
    expect(await screen.findByText('La investigación #99 no existe en el backend')).toBeInTheDocument()
    expect(screen.getByRole('link', { name: 'Ver investigaciones' })).toHaveAttribute('href', '#/investigaciones')
  })

  it('muestra todas las investigaciones de la plataforma y depura lo que ya no existe', async () => {
    const snapshot = {
      indicator: wannacryIndicator,
      enrichment: wannacryEnrichment,
      correlation: wannacryCorrelation,
      reports: [wannacryReport],
      validations: [acceptedValidation],
    }
    const { user, paths } = renderApp(
      {
        'POST /indicators': fail(409, 'El indicador ya existe'),
        // La plataforma tiene solo el #2 (OTX recortado en el listado). La búsqueda por valor
        // encuentra el #1, registrado en otra sesión después de sincronizar.
        'GET /investigations': ({ query }) =>
          reply(200, {
            items:
              query.get('page') === '1'
                ? [{ indicator: benignIndicator, enrichment: benignEnrichment,
                     correlation: unresolvedCorrelation, reports: [], validations: [] }]
                : [],
            page: Number(query.get('page')),
            size: 10,
            total: 1,
            pages: 1,
          }),
        'GET /indicators': reply(200, [wannacryIndicator]),
        'GET /indicators/1': reply(200, snapshot),
      },
      [investigation()], // #1 en caché, pero el backend ya no lo lista: se depura
      '#/investigaciones',
    )

    // Una sola lista con lo que hay en la plataforma: el #2 llegó en la página, el #1 se depuró.
    expect(await list().findByText('8.8.8.8')).toBeInTheDocument()
    await vi.waitFor(() => expect(list().queryByText(/Hash · #1/)).not.toBeInTheDocument())
    expect(list().getByText('Sin asociación')).toBeInTheDocument()
    expect(paths()).toContain('GET /investigations')
    // Del OTX recortado se guarda solo el resumen que usa la interfaz.
    const [guardada] = JSON.parse(window.localStorage.getItem('nexo.investigations.v1')!)
    expect(guardada.enrichment.resumen.validations).toHaveLength(2)
    expect(screen.queryByRole('region', { name: 'Registradas desde otros navegadores' })).not.toBeInTheDocument()

    // 409 de un indicador que no está en caché: se busca por valor y se abre reconstruido.
    await registerIndicator(user, 'Hash', WANNACRY_HASH)
    expect(await screen.findByRole('heading', { level: 1 })).toHaveTextContent(WANNACRY_HASH)
    expect(window.location.hash).toBe('#/investigaciones/1')
    await user.click(await screen.findByRole('tab', { name: /Informe y validación/ }))
    expect(screen.getByText('Estado: Aceptado')).toBeInTheDocument()
  })

  it('avisa si no puede sincronizar y muestra lo que hay en caché', async () => {
    renderApp({ 'GET /investigations': new TypeError('Failed to fetch') }, [investigation()], '#/investigaciones')
    expect(await screen.findByText('No se pudo sincronizar con el backend')).toBeInTheDocument()
    expect(list().getByText(/Hash · #1/)).toBeInTheDocument()
  })

  it('pagina la lista de investigaciones de a 10', async () => {
    const muchas = Array.from({ length: 12 }, (_, i) =>
      investigation({ indicator: { ...benignIndicator, id: 100 + i, valor: `10.0.0.${i}` }, entrada: `10.0.0.${i}` }),
    )
    const { user } = renderApp({}, muchas, '#/investigaciones')
    const paginador = within(screen.getByRole('navigation', { name: 'Paginación de investigaciones' }))
    expect(paginador.getByText('Página 1 de 2 · 12 investigaciones')).toBeInTheDocument()
    expect(list().getAllByRole('link')).toHaveLength(10)
    expect(paginador.getByRole('button', { name: /Anterior/ })).toBeDisabled()

    await user.click(paginador.getByRole('button', { name: /Siguiente/ }))
    expect(paginador.getByText('Página 2 de 2 · 12 investigaciones')).toBeInTheDocument()
    expect(list().getAllByRole('link')).toHaveLength(2)
    expect(paginador.getByRole('button', { name: /Siguiente/ })).toBeDisabled()

    // Buscar vuelve a la primera página y el paginador desaparece si todo cabe en una.
    await user.type(list().getByLabelText('Buscar investigaciones'), '10.0.0.1')
    expect(screen.queryByRole('navigation', { name: 'Paginación de investigaciones' })).not.toBeInTheDocument()
    expect(list().getAllByRole('link')).toHaveLength(3) // 10.0.0.1, .10 y .11
  })

  it('elimina el indicador del backend tras confirmar, y avisa si falla', async () => {
    let intentos = 0
    const { user, paths } = renderApp(
      {
        'DELETE /indicators/1': () =>
          ++intentos === 1
            ? fail(500, 'Error interno del servidor')
            : reply(200, { indicator_id: 1, valor: WANNACRY_HASH, eliminados: { indicators: 1, reports: 1 } }),
      },
      [investigation({ reports: [wannacryReport] })],
      '#/investigaciones/1',
    )

    // El diálogo detalla qué se borra; el foco arranca en Cancelar (lo seguro).
    const abrir = await screen.findByRole('button', { name: 'Eliminar' })
    await user.click(abrir)
    const dialogo = within(screen.getByRole('alertdialog', { name: '¿Eliminar este indicador?' }))
    expect(dialogo.getByText(/1 versión\(es\) del informe/)).toBeInTheDocument()
    expect(dialogo.getByText(/se pierde ese historial de auditoría/)).toBeInTheDocument()
    expect(dialogo.getByText('Esta acción no se puede deshacer.')).toBeInTheDocument()
    expect(dialogo.getByRole('button', { name: 'Cancelar' })).toHaveFocus()

    // El foco no sale del diálogo y Esc cancela sin tocar el backend; el foco vuelve al botón.
    await user.tab()
    expect(dialogo.getByRole('button', { name: 'Eliminar definitivamente' })).toHaveFocus()
    await user.tab()
    expect(dialogo.getByRole('button', { name: 'Cancelar' })).toHaveFocus()
    await user.tab({ shift: true })
    expect(dialogo.getByRole('button', { name: 'Eliminar definitivamente' })).toHaveFocus()
    await user.keyboard('{Escape}')
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument()
    expect(abrir).toHaveFocus()
    expect(paths()).not.toContain('DELETE /indicators/1')

    // Un fallo se informa dentro del diálogo, que sigue abierto; el caso sigue ahí.
    await user.click(abrir)
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }))
    expect(await within(screen.getByRole('alertdialog')).findByText('No se pudo eliminar el indicador')).toBeInTheDocument()
    expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(WANNACRY_HASH)

    // Reintentar desde el mismo diálogo: elimina, vuelve a la lista y vacía el historial.
    await user.click(screen.getByRole('button', { name: 'Eliminar definitivamente' }))
    expect(await screen.findByText(/Aún no hay investigaciones/)).toBeInTheDocument()
    expect(window.location.hash).toBe('#/investigaciones')
    expect(JSON.parse(window.localStorage.getItem('nexo.investigations.v1')!)).toEqual([])
  })

  it('informa si el backend no responde al cargar una investigación', async () => {
    renderApp({ 'GET /indicators/7': new TypeError('Failed to fetch') }, [], '#/investigaciones/7')
    expect(await screen.findByText('No se pudo cargar la investigación')).toBeInTheDocument()
  })

  it('muestra el avance de un paso en la lista mientras corre', async () => {
    const enrich = deferred<Reply>()
    const { user } = renderApp({ 'POST /indicators/1/enrich': () => enrich.promise }, [investigation()], '#/investigaciones/1')

    await user.click(await screen.findByRole('button', { name: 'Análisis completo' }))
    expect(screen.getByRole('button', { name: /Analizando/ })).toBeDisabled()
    await user.click(nav().getByRole('link', { name: /Investigaciones/ }))
    expect(await list().findByText('Procesando')).toBeInTheDocument()

    enrich.resolve(fail(500, 'Error interno del servidor'))
    await vi.waitFor(() => expect(list().queryByText('Procesando')).not.toBeInTheDocument())
    await user.click(list().getByRole('link', { name: /Hash/ }))
    expect(await screen.findByText('No se pudo enriquecer el indicador')).toBeInTheDocument()
  })

  it('avisa si el navegador no puede guardar el historial', async () => {
    vi.spyOn(Storage.prototype, 'setItem').mockImplementation(() => {
      throw new DOMException('quota', 'QuotaExceededError')
    })
    renderApp({}, [], '#/investigaciones')
    expect(await screen.findByText('El historial no se está guardando')).toBeInTheDocument()
  })

  it('descarga y copia el informe en Markdown', async () => {
    const createObjectURL = vi.fn(() => 'blob:nexo')
    const revokeObjectURL = vi.fn()
    vi.stubGlobal('URL', Object.assign(URL, { createObjectURL, revokeObjectURL }))
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {})
    const { user } = renderApp({}, [investigation({ enrichment: wannacrySnapshot, reports: [wannacryReport] })], '#/investigaciones/1')
    const writeText = vi.spyOn(navigator.clipboard, 'writeText').mockResolvedValue()

    await user.click(await screen.findByRole('tab', { name: /Informe y validación/ }))
    await user.click(screen.getByRole('button', { name: 'Descargar .md' }))
    expect(createObjectURL).toHaveBeenCalledWith(expect.any(Blob))
    expect(click).toHaveBeenCalled()
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:nexo')

    await user.click(screen.getByRole('button', { name: 'Copiar informe en Markdown' }))
    expect(writeText).toHaveBeenCalledWith(wannacryReport.contenido)
  })

  it('alterna el tema y lo recuerda', async () => {
    const { user } = renderApp()
    await vi.waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    await user.click(screen.getByRole('button', { name: 'Cambiar a tema claro' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(window.localStorage.getItem('nexo.tema')).toBe('light')
    await user.click(screen.getByRole('button', { name: 'Cambiar a tema oscuro' }))
    expect(document.documentElement.dataset.theme).toBe('dark')
  })

  it('el enlace de salto enfoca el contenido sin cambiar de vista', async () => {
    const { user } = renderApp({}, [], '#/investigaciones')
    await user.click(screen.getByRole('link', { name: 'Saltar al contenido' }))
    expect(screen.getByRole('main')).toHaveFocus()
    expect(window.location.hash).toBe('#/investigaciones')
  })
})
