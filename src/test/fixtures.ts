/**
 * Respuestas con la forma exacta de NEXO-BACKEND, tomadas de su README (escenario 1:
 * WannaCry) y de data/test_dataset/scenarios.json (escenario 5: 8.8.8.8 benigno).
 */
import type {
  CorrelationResponse,
  EnrichmentResponse,
  IndicatorRead,
  ReportRead,
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

export const wannacryEnrichment: EnrichmentResponse = {
  indicator_id: 1,
  fuente: 'alienvault_otx',
  tiene_evidencia: true,
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
  "pulse_info.pulses[].malware_families[].display_name = 'WannaCry' (respaldado por 2 pulse(s); 1 pulse(s) masivo(s) descartado(s))"

export const wannacryCorrelation: CorrelationResponse = {
  indicator_id: 1,
  resuelto: true,
  entity: { id: 1, nombre: 'wannacry', tipo: 'malware' },
  confianza: 0.9,
  evidencia: WANNACRY_EVIDENCE,
  tecnicas: [
    { id: 'T1210', nombre: 'Exploitation of Remote Services', tactica: 'Lateral Movement' },
    { id: 'T1489', nombre: 'Service Stop', tactica: 'Impact' },
    { id: 'T1486', nombre: 'Data Encrypted for Impact', tactica: 'Impact' },
  ],
}

export const WANNACRY_REPORT_MD = `# Informe de indicador: ${WANNACRY_HASH}

**Tipo:** hash
**Nivel de confianza:** 0.9

## Resolución de entidad y técnicas ATT&CK

- **Entidad asociada:** wannacry (malware)
- **Confianza de la asociación:** 0.9

### Técnicas documentadas

| ID | Técnica | Táctica |
|---|---|---|
| T1210 | Exploitation of Remote Services | Lateral Movement |
| T1486 | Data Encrypted for Impact | Impact |

## Análisis

El hash está asociado al malware Wannacry. Ver [ATT&CK](https://attack.mitre.org/software/S0366/).

## Estado de validación

Pendiente de revisión humana.
`

export const wannacryReport: ReportRead = {
  id: 1,
  indicator_id: 1,
  contenido: WANNACRY_REPORT_MD,
  nivel_confianza: 0.9,
  timestamp: '2026-09-22T17:51:39.361866Z',
}

export const acceptedValidation: ValidationRead = {
  id: 1,
  report_id: 1,
  decision: 'aceptado',
  analista: 'analista SOC N1',
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
}
