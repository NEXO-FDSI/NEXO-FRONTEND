import { ExternalLink } from 'lucide-react'
import { useState, type ReactNode } from 'react'
import type { EstadoFuente, FuenteEnriquecimiento, ResumenFuente, Veredicto } from '../../api/types'
import { techniqueUrl } from '../../domain/attck'
import { formatDateTime } from '../../domain/format'
import { MAX_INDICADORES_PULSE } from '../../domain/otx'
import { ESTADO_FUENTE_LABEL, isFailedSource, VEREDICTO_LABEL } from '../../domain/severity'
import { Badge, type Tone } from '../ui/Badge'
import { Tabs, type TabItem } from '../ui/Tabs'
import { EnrichmentPanel } from './EnrichmentPanel'
import { SourceIcon } from './Signals'
import type { CasePanelProps } from './types'
import styles from './IntelPanel.module.css'

const OTX = 'alienvault_otx'

const VEREDICTO_TONE: Record<Veredicto, Tone> = {
  malicioso: 'danger',
  sospechoso: 'warning',
  sin_evidencia: 'neutral',
  benigno_conocido: 'success',
}

/** Barra segmentada de motores: maliciosos, sospechosos y el resto. */
function DetectionBar({ maliciosos, sospechosos, total }: Record<'maliciosos' | 'sospechosos' | 'total', number>) {
  const pct = (n: number) => `${total ? (n / total) * 100 : 0}%`
  return (
    <div className={styles.detections}>
      <p>
        <strong className="mono">
          {maliciosos}/{total}
        </strong>{' '}
        motores lo marcan malicioso{sospechosos > 0 && ` · ${sospechosos} sospechoso`}
      </p>
      <div
        className={styles.bar}
        role="img"
        aria-label={`${maliciosos} de ${total} motores maliciosos, ${sospechosos} sospechosos`}
      >
        <span className={styles.malicious} style={{ width: pct(maliciosos) }} />
        <span className={styles.suspicious} style={{ width: pct(sospechosos) }} />
      </div>
    </div>
  )
}

function Facts({ resumen }: { resumen: ResumenFuente }) {
  const d = resumen.detecciones ?? {}
  return (
    <>
      {'maliciosos' in d && <DetectionBar maliciosos={d.maliciosos} sospechosos={d.sospechosos ?? 0} total={d.total ?? 0} />}
      <dl className={styles.facts}>
        {'pulses' in d && (
          <div>
            <dt>Pulses</dt>
            <dd className="mono">
              {d.pulses}
              {d.pulses_masivos ? ` (${d.pulses_masivos} volcados masivos ignorados)` : ''}
            </dd>
          </div>
        )}
        {'registros' in d && (
          <div>
            <dt>Registros</dt>
            <dd className="mono">{d.registros}</dd>
          </div>
        )}
        {resumen.confianza !== null && (
          <div>
            <dt>Confianza de la fuente</dt>
            <dd className="mono">{resumen.confianza}/100</dd>
          </div>
        )}
        {resumen.primera_vez && (
          <div>
            <dt>Visto por primera vez</dt>
            <dd>{formatDateTime(resumen.primera_vez)}</dd>
          </div>
        )}
        {resumen.ultima_vez && (
          <div>
            <dt>Última vez</dt>
            <dd>{formatDateTime(resumen.ultima_vez)}</dd>
          </div>
        )}
      </dl>
      {resumen.familias.length > 0 && (
        <div className={styles.chips} aria-label="Familias reportadas">
          {resumen.familias.map((f) => (
            <Badge key={f} tone="entity">
              {f}
            </Badge>
          ))}
        </div>
      )}
      {resumen.etiquetas.length > 0 && (
        <div className={styles.chips} aria-label="Etiquetas">
          {resumen.etiquetas.slice(0, 6).map((t) => (
            <Badge key={t}>{t}</Badge>
          ))}
        </div>
      )}
    </>
  )
}

type Grupo = 'evidencia' | 'sinEvidencia' | 'fallo' | 'fuera'

/** Los tres estados que el analista debe distinguir de un vistazo (más "no participa"). */
function grupo(estado: EstadoFuente): Grupo {
  if (estado === 'con_evidencia') return 'evidencia'
  if (estado === 'sin_evidencia') return 'sinEvidencia'
  return isFailedSource(estado) ? 'fallo' : 'fuera'
}

const TITULO: Record<Grupo, string> = {
  evidencia: 'Con evidencia',
  sinEvidencia: 'Sin evidencia',
  fallo: 'No verificado',
  fuera: 'No participó',
}

function statusText(fuente: FuenteEnriquecimiento): string {
  switch (grupo(fuente.estado)) {
    case 'evidencia':
      return 'La fuente tiene registros de este indicador.'
    case 'sinEvidencia': {
      const masivos = fuente.resumen?.detecciones?.pulses_masivos ?? 0
      return masivos > 0
        ? `Solo aparece en ${masivos} volcado(s) agregado(s) de más de ${MAX_INDICADORES_PULSE.toLocaleString('es-CO')} indicadores, que no cuentan como evidencia.`
        : 'La fuente respondió y no tiene registros de este indicador.'
    }
    case 'fallo':
      return `${fuente.error ?? ESTADO_FUENTE_LABEL[fuente.estado]}. Esto NO significa "sin evidencia": no se pudo verificar.`
    default:
      return fuente.error ?? `Esta fuente no participó (${ESTADO_FUENTE_LABEL[fuente.estado]}).`
  }
}

function SourceStatus({ fuente }: { fuente: FuenteEnriquecimiento }) {
  const g = grupo(fuente.estado)
  return (
    <div className={`${styles.status} ${styles[g]}`} role="status">
      <SourceIcon estado={fuente.estado} />
      <p>
        <strong>{TITULO[g]}</strong> · {statusText(fuente)}
      </p>
    </div>
  )
}

function Techniques({ ids }: { ids: string[] }) {
  return (
    <div className={styles.section}>
      <h4>Técnicas ATT&amp;CK que cita la fuente</h4>
      <div className={styles.chips}>
        {ids.map((id) => (
          <a key={id} className="mono" href={techniqueUrl(id)} target="_blank" rel="noopener noreferrer">
            {id}
          </a>
        ))}
      </div>
    </div>
  )
}

function References({ urls }: { urls: string[] }) {
  return (
    <div className={styles.section}>
      <h4>Referencias</h4>
      <ul className={styles.references}>
        {urls.map((url) => (
          <li key={url}>
            <a href={url} target="_blank" rel="noopener noreferrer nofollow">
              {url}
            </a>
          </li>
        ))}
      </ul>
    </div>
  )
}

/** Detalle normalizado de una fuente: estado, hechos, familias, técnicas y referencias. */
function SourceDetail({ fuente, children }: { fuente: FuenteEnriquecimiento; children?: ReactNode }) {
  const { resumen } = fuente
  return (
    <section className={styles.card} aria-label={fuente.etiqueta}>
      <header className={styles.cardHeader}>
        <h3>{fuente.etiqueta}</h3>
        {resumen ? (
          <Badge tone={VEREDICTO_TONE[resumen.veredicto]}>{VEREDICTO_LABEL[resumen.veredicto]}</Badge>
        ) : (
          <Badge tone={grupo(fuente.estado) === 'fallo' ? 'warning' : 'neutral'}>{ESTADO_FUENTE_LABEL[fuente.estado]}</Badge>
        )}
      </header>
      <SourceStatus fuente={fuente} />
      {resumen && <Facts resumen={resumen} />}
      {!!resumen?.tecnicas_attck?.length && <Techniques ids={resumen.tecnicas_attck} />}
      {!!resumen?.referencias?.length && <References urls={resumen.referencias} />}
      {children}
      <footer className={styles.cardFooter}>
        <span>{fuente.desde_cache ? 'Desde caché' : fuente.latencia_ms !== null ? `${fuente.latencia_ms} ms` : '—'}</span>
        {resumen?.referencia_url && (
          <a href={resumen.referencia_url} target="_blank" rel="noopener noreferrer">
            Abrir en {fuente.etiqueta} <ExternalLink size={12} aria-hidden="true" />
          </a>
        )}
      </footer>
    </section>
  )
}

/** Una pestaña por fuente (OTX, ThreatFox, VirusTotal) con su evidencia normalizada. */
export function IntelPanel(props: CasePanelProps) {
  const fuentes = props.inv.enrichment?.fuentes ?? []
  const [elegida, setElegida] = useState<string | null>(null)
  // Sin enriquecimiento (o caché anterior a la Fase 2, sin `fuentes`): la vista de OTX de siempre.
  if (fuentes.length === 0) return <EnrichmentPanel {...props} />

  const activa = elegida ?? (fuentes.find((f) => f.estado === 'con_evidencia') ?? fuentes[0]).fuente
  const items: TabItem<string>[] = fuentes.map((f) => ({
    id: f.fuente,
    label: f.etiqueta,
    icon: (
      <span className={`${styles.tabIcon} ${styles[grupo(f.estado)]}`}>
        <SourceIcon estado={f.estado} />
        <span className="sr-only">{TITULO[grupo(f.estado)]}: </span>
      </span>
    ),
    content: (
      <SourceDetail fuente={f}>
        {f.fuente === OTX && f.resumen && (
          <div className={styles.section}>
            <h4>Pulses de la comunidad</h4>
            <EnrichmentPanel {...props} />
          </div>
        )}
      </SourceDetail>
    ),
  }))
  return (
    <div className={styles.panel}>
      <Tabs label="Fuentes de inteligencia" items={items} value={activa} onChange={setElegida} />
    </div>
  )
}
