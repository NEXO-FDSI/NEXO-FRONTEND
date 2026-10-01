import { ExternalLink } from 'lucide-react'
import type { FuenteEnriquecimiento, ResumenFuente, Veredicto } from '../../api/types'
import { formatDateTime } from '../../domain/format'
import { ESTADO_FUENTE_LABEL, VEREDICTO_LABEL } from '../../domain/severity'
import { Badge, type Tone } from '../ui/Badge'
import { EnrichmentPanel } from './EnrichmentPanel'
import type { CasePanelProps } from './types'
import styles from './IntelPanel.module.css'

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

function SourceCard({ fuente }: { fuente: FuenteEnriquecimiento }) {
  const { resumen } = fuente
  return (
    <section className={styles.card} aria-label={fuente.etiqueta}>
      <header className={styles.cardHeader}>
        <h3>{fuente.etiqueta}</h3>
        {resumen ? (
          <Badge tone={VEREDICTO_TONE[resumen.veredicto]}>{VEREDICTO_LABEL[resumen.veredicto]}</Badge>
        ) : (
          <Badge tone={fuente.estado === 'error' || fuente.estado === 'limite_cuota' ? 'warning' : 'neutral'}>
            {ESTADO_FUENTE_LABEL[fuente.estado]}
          </Badge>
        )}
      </header>
      {resumen && !resumen.tiene_evidencia && (
        <p className={styles.muted}>La fuente respondió y no tiene registros de este indicador.</p>
      )}
      {resumen ? (
        <Facts resumen={resumen} />
      ) : (
        <p className={styles.muted}>
          {fuente.error ?? 'Esta fuente no participó en el enriquecimiento.'}
          {(fuente.estado === 'error' || fuente.estado === 'limite_cuota') &&
            ' Esto NO significa "sin evidencia": no se pudo verificar.'}
        </p>
      )}
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

/** Una tarjeta por fuente y, debajo, el detalle de OTX (pulses y validaciones). */
export function IntelPanel(props: CasePanelProps) {
  const fuentes = props.inv.enrichment?.fuentes ?? []
  return (
    <div className={styles.panel}>
      {fuentes.length > 0 && (
        <div className={styles.cards}>
          {fuentes.map((f) => (
            <SourceCard key={f.fuente} fuente={f} />
          ))}
        </div>
      )}
      {props.inv.enrichment && fuentes.length > 0 && <h3 className={styles.subtitle}>Detalle de AlienVault OTX</h3>}
      <EnrichmentPanel {...props} />
    </div>
  )
}
