/**
 * Respuestas con la forma exacta de NEXO-BACKEND, tomadas de su README (escenario 1:
 * WannaCry) y de data/test_dataset/scenarios.json (escenario 5: 8.8.8.8 benigno). Las
 * fuentes y los metadatos del informe reproducen la corrida real del 2026-09-30
 * (backend docs/evolucion/fase-04-ia-estructurada.md).
 */
import type {
  CorrelationResponse,
  EnrichmentResponse,
  FuenteEnriquecimiento,
  IndicatorRead,
  ReportMetadatos,
  ReportRead,
  StatusResponse,
  ValidationRead,
} from '../api/types'
import type { Investigation } from '../domain/investigation'
import { summarizeOtx } from '../domain/otx'

export const WANNACRY_HASH = '24d004a104d4d54034dbcffc2a4b19a11f39008a575aa614ea04703480b1022c'

export const wannacryIndicator: IndicatorRead = {
  id: 1,
  tipo: 'hash',
  valor: WANNACRY_HASH,
  fuente: 'reporte interno SOC',
  timestamp_ingesta: '2026-09-22T17:51:20.169333Z',
}

const sinResumen = {
  familias: [],
  etiquetas: [],
  detecciones: null,
  confianza: null,
  primera_vez: null,
  ultima_vez: null,
  tecnicas_attck: [],
  referencias: [],
}

export const wannacryFuentes: FuenteEnriquecimiento[] = [
  {
    fuente: 'alienvault_otx',
    etiqueta: 'AlienVault OTX',
    estado: 'con_evidencia',
    resumen: {
      ...sinResumen,
      tiene_evidencia: true,
      veredicto: 'malicioso',
      familias: ['WannaCry'],
      etiquetas: ['wannacry', 'ransomware'],
      detecciones: { pulses: 50, pulses_masivos: 1 },
      tecnicas_attck: ['T1486'],
      referencias: ['https://www.cisa.gov/news-events/alerts/2017/05/12/indicators-associated-wannacry-ransomware'],
      referencia_url: `https://otx.alienvault.com/indicator/file/${'24d004a104d4d54034dbcffc2a4b19a11f39008a575aa614ea04703480b1022c'}`,
    },
    error: null,
    desde_cache: false,
    latencia_ms: 6870,
  },
  {
    fuente: 'threatfox',
    etiqueta: 'ThreatFox',
    estado: 'sin_evidencia',
    resumen: { ...sinResumen, tiene_evidencia: false, veredicto: 'sin_evidencia', referencia_url: null },
    error: null,
    desde_cache: false,
    latencia_ms: 440,
  },
  {
    fuente: 'virustotal',
    etiqueta: 'VirusTotal',
    estado: 'con_evidencia',
    resumen: {
      ...sinResumen,
      tiene_evidencia: true,
      veredicto: 'malicioso',
      familias: ['wannacry', 'wanna', 'wannacrypt'],
      etiquetas: ['trojan', 'ransomware', 'worm'],
      detecciones: { maliciosos: 69, sospechosos: 0, total: 71 },
      primera_vez: '2017-05-12T08:57:51+00:00',
      referencia_url: 'https://www.virustotal.com/gui/file/24d004a104d4d54034dbcffc2a4b19a11f39008a575aa614ea04703480b1022c',
    },
    error: null,
    desde_cache: false,
    latencia_ms: 518,
  },
]

export const wannacryEnrichment: EnrichmentResponse = {
  indicator_id: 1,
  fuente: 'alienvault_otx',
  tiene_evidencia: true,
  cobertura: 'completa',
  fuentes: wannacryFuentes,
  detalle: {
    indicator: WANNACRY_HASH,
    type: 'sha256',
    validation: [],
    pulse_info: {
      count: 50,
      pulses: [
        {
          id: '698e93e1ab02db8c49e8c3ed',
          name: '“Broken Seal” DocuSign-themed Delivery',
          created: '2026-02-13T03:00:49.872000',
          indicator_count: 288240,
          tags: ['Zeppelin', 'Bloat-A', 'Zero-Day-Delivery', 'phishing', 'docusign', 'x509', 'imphash'],
          malware_families: [],
        },
        {
          id: '69c55a4e2b29658b9ddda9a9',
          name: 'WannaCry Indicators',
          created: '2017-05-12T20:00:00.000000',
          indicator_count: 42,
          tags: ['wannacry', 'ransomware'],
          malware_families: [{ id: 'WannaCry', display_name: 'WannaCry' }],
        },
      ],
    },
  },
}

export const WANNACRY_EVIDENCE =
  "pulse_info.pulses[].malware_families[].display_name = 'WannaCry' (respaldado por 2 pulse(s); 1 pulse(s) masivo(s) descartado(s)); VirusTotal familias = 'wannacry'"

const PROCEDENCIA = ['alienvault_otx', 'virustotal']

export const wannacryCorrelation: CorrelationResponse = {
  indicator_id: 1,
  resuelto: true,
  entity: { id: 1, nombre: 'wannacry', tipo: 'malware' },
  confianza: 0.9,
  evidencia: WANNACRY_EVIDENCE,
  fuentes: PROCEDENCIA,
  tecnicas: [
    { id: 'T1210', nombre: 'Exploitation of Remote Services', tactica: 'Lateral Movement', fuentes: PROCEDENCIA, reportada_por: [] },
    { id: 'T1489', nombre: 'Service Stop', tactica: 'Impact', fuentes: PROCEDENCIA, reportada_por: [] },
    { id: 'T1486', nombre: 'Data Encrypted for Impact', tactica: 'Impact', fuentes: PROCEDENCIA, reportada_por: ['alienvault_otx'] },
  ],
}

export const WANNACRY_REPORT_MD = `# Informe de indicador: ${WANNACRY_HASH}

**Tipo:** hash
**Nivel de confianza:** Alta — wannacry respaldada por 2 fuentes: AlienVault OTX y VirusTotal

## Evidencia por fuente

### Contradicciones

Ninguna detectada entre las fuentes que respondieron.

## Resolución de entidad y técnicas ATT&CK

- **Entidad asociada:** wannacry (malware)
- **Respaldada por:** AlienVault OTX, VirusTotal
- **Confianza de la asociación:** 0.9

### Técnicas documentadas

| ID | Técnica | Táctica | Procedencia |
|---|---|---|---|
| T1210 | Exploitation of Remote Services | Lateral Movement | vía entidad: AlienVault OTX, VirusTotal |
| T1486 | Data Encrypted for Impact | Impact | vía entidad: AlienVault OTX, VirusTotal; citada por AlienVault OTX |

## Análisis

El hash está asociado al malware Wannacry. Ver [ATT&CK](https://attack.mitre.org/software/S0366/).
`

export const wannacryMetadatos: ReportMetadatos = {
  severidad: {
    nivel: 'critica',
    motivos: ['asociado a wannacry con confianza 0.9', 'VirusTotal: 69 motores maliciosos, 0 sospechosos'],
  },
  confianza: { nivel: 'alta', motivos: ['wannacry respaldada por 2 fuentes: AlienVault OTX y VirusTotal'] },
  contradicciones: [],
  cobertura: 'completa',
  concordancia: [
    { fuente: 'alienvault_otx', etiqueta: 'AlienVault OTX', familias: ['WannaCry'], entidades: ['wannacry'], resultado: 'concuerda' },
    { fuente: 'threatfox', etiqueta: 'ThreatFox', familias: [], entidades: [], resultado: 'no_comparable' },
    {
      fuente: 'virustotal',
      etiqueta: 'VirusTotal',
      familias: ['wannacry', 'wanna', 'wannacrypt'],
      entidades: ['wannacry'],
      resultado: 'concuerda',
    },
  ],
  fuentes: wannacryFuentes.map(({ fuente, etiqueta, estado, resumen, error }) => ({ fuente, etiqueta, estado, resumen, error })),
  ia: {
    estado: 'generado',
    motivo: null,
    analisis: {
      resumen: 'El hash corresponde a WannaCry, un ransomware gusano con alta detección.',
      hallazgos: [
        { afirmacion: 'El indicador se asocia con confianza 0.9 a la familia WannaCry.', tipo: 'evidencia', fuentes: ['E-COR'] },
        { afirmacion: 'VirusTotal reporta 69 de 71 motores maliciosos.', tipo: 'evidencia', fuentes: ['E-VT'] },
        { afirmacion: "La etiqueta 'worm' sugiere capacidad de auto-propagación.", tipo: 'inferencia', fuentes: ['E-VT'] },
        { afirmacion: 'Podría explotar SMB para moverse lateralmente.', tipo: 'hipotesis', fuentes: ['T1210'] },
      ],
      tecnicas_destacadas: [{ id: 'T1210', motivo: 'WannaCry explota servicios remotos para moverse lateralmente.' }],
      investigacion_recomendada: ['Buscar conexiones SMB (445) salientes desde el host afectado.'],
      limitaciones: ['ThreatFox no aportó datos.'],
      informacion_faltante: ['Infraestructura de C2 asociada al hash.'],
    },
    descartes: [],
    contexto: [
      { id: 'E-COR', titulo: 'Correlación determinística de NEXO', texto: 'Entidad asociada: wannacry (malware), confianza 0.9.' },
      { id: 'E-OTX', titulo: 'AlienVault OTX', texto: 'veredicto de la fuente: malicioso; 50 pulse(s) de la comunidad lo mencionan.' },
      { id: 'E-TF', titulo: 'ThreatFox', texto: 'veredicto de la fuente: sin evidencia.' },
      { id: 'E-VT', titulo: 'VirusTotal', texto: 'veredicto de la fuente: malicioso; 69 de 71 motores lo marcan malicioso.' },
      { id: 'T1210', titulo: 'Exploitation of Remote Services (Lateral Movement)', texto: 'Adversaries may exploit remote services…' },
    ],
    prompt: 'Eres un asistente…\n<datos>\n[E-COR] …\n</datos>\n\nResponde ahora solo con el objeto JSON.',
    proveedor: 'groq',
    modelo: 'qwen/qwen3.8-27b',
    latencia_ms: 1857,
    tokens: { prompt: 2013, respuesta: 541 },
    intentos_fallidos: [],
  },
}

export const wannacryReport: ReportRead = {
  id: 1,
  indicator_id: 1,
  contenido: WANNACRY_REPORT_MD,
  nivel_confianza: 0.9,
  timestamp: '2026-09-22T17:51:39.361866Z',
  metadatos: wannacryMetadatos,
}

export const acceptedValidation: ValidationRead = {
  id: 1,
  report_id: 1,
  decision: 'aceptado',
  analista: null, // sin login aún: el backend no recibe analista
  timestamp: '2026-09-22T17:51:39.380001Z',
}

export const benignIndicator: IndicatorRead = {
  id: 2,
  tipo: 'ip',
  valor: '8.8.8.8',
  fuente: null,
  timestamp_ingesta: '2026-09-22T18:00:00Z',
}

export const benignEnrichment: EnrichmentResponse = {
  indicator_id: 2,
  fuente: 'alienvault_otx',
  tiene_evidencia: false,
  cobertura: 'parcial',
  fuentes: [
    {
      fuente: 'alienvault_otx',
      etiqueta: 'AlienVault OTX',
      estado: 'sin_evidencia',
      resumen: { ...sinResumen, tiene_evidencia: false, veredicto: 'benigno_conocido', detecciones: { pulses: 0, pulses_masivos: 0 }, referencia_url: null },
      error: null,
      desde_cache: false,
      latencia_ms: 480,
    },
    { fuente: 'threatfox', etiqueta: 'ThreatFox', estado: 'no_configurado', resumen: null, error: null, desde_cache: false, latencia_ms: null },
    { fuente: 'virustotal', etiqueta: 'VirusTotal', estado: 'limite_cuota', resumen: null, error: 'VirusTotal alcanzó su límite de consultas (429)', desde_cache: false, latencia_ms: null },
  ],
  detalle: {
    indicator: '8.8.8.8',
    type: 'IPv4',
    validation: [
      { source: 'false_positive', message: 'Known False Positive', name: 'Known False Positive' },
      { source: 'whitelist', message: 'contained in whitelisted prefix', name: 'Whitelisted IP' },
    ],
    pulse_info: { count: 0, pulses: [] },
  },
}

export const unresolvedCorrelation: CorrelationResponse = {
  indicator_id: 2,
  resuelto: false,
  entity: null,
  confianza: null,
  evidencia: null,
  tecnicas: [],
}

export const benignReport: ReportRead = {
  id: 2,
  indicator_id: 2,
  contenido: '# Informe de indicador: 8.8.8.8\n\n> **Sin evidencia suficiente**',
  nivel_confianza: 0,
  timestamp: '2026-09-22T18:00:05Z',
}

/** Investigación ya persistida, para arrancar la app con historial. */
export function investigation(overrides: Partial<Investigation> = {}): Investigation {
  return {
    indicator: wannacryIndicator,
    entrada: WANNACRY_HASH.toUpperCase(),
    enrichment: null,
    correlation: null,
    reports: [],
    validations: [],
    missing: false,
    ...overrides,
  }
}

export const wannacrySnapshot = {
  fuente: wannacryEnrichment.fuente,
  tiene_evidencia: true,
  resumen: summarizeOtx(wannacryEnrichment.detalle),
  fuentes: wannacryFuentes,
}

export const statusResponse: StatusResponse = {
  fuentes: [
    { fuente: 'alienvault_otx', etiqueta: 'AlienVault OTX', configurada: true },
    { fuente: 'threatfox', etiqueta: 'ThreatFox', configurada: true },
    { fuente: 'virustotal', etiqueta: 'VirusTotal', configurada: false },
  ],
  ia: { proveedor: 'groq', modelo: 'qwen/qwen3.8-27b' },
}
