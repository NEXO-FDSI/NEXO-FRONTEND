import { Braces, RefreshCw, ShieldQuestion } from 'lucide-react'
import { formatDateTime } from '../../domain/format'
import { MAX_INDICADORES_PULSE, type OtxPulse } from '../../domain/otx'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { StepPrompt } from './StepPrompt'
import type { CasePanelProps } from './types'
import styles from './EnrichmentPanel.module.css'

const VISIBLE_TAGS = 5

function TagList({ tags }: { tags: string[] }) {
  if (tags.length === 0) return <span className={styles.none}>—</span>
  const hidden = tags.length - VISIBLE_TAGS
  return (
    <span className={styles.chips}>
      {tags.slice(0, VISIBLE_TAGS).map((tag, i) => (
        <Badge key={`${tag}-${i}`} title={tag}>
          {tag}
        </Badge>
      ))}
      {hidden > 0 && (
        <span className={styles.more} title={tags.slice(VISIBLE_TAGS).join(', ')}>
          +{hidden} más
        </span>
      )}
    </span>
  )
}

function PulseRow({ pulse }: { pulse: OtxPulse }) {
  return (
    <tr>
      <td>
        <span className={styles.pulseName}>{pulse.name}</span>
        <span className={styles.sub}>{formatDateTime(pulse.created)}</span>
      </td>
      <td className={styles.count}>
        <span className="mono">{pulse.indicatorCount?.toLocaleString('es-CO') ?? '—'}</span>
        {pulse.masivo && (
          <Badge tone="warning" title={`Más de ${MAX_INDICADORES_PULSE.toLocaleString('es-CO')} indicadores: la correlación lo descarta`}>
            Volcado agregado
          </Badge>
        )}
      </td>
      <td>
        {pulse.malwareFamilies.length > 0 ? (
          <span className={styles.chips}>
            {pulse.malwareFamilies.map((family, i) => (
              <Badge key={`${family}-${i}`} tone="entity">
                {family}
              </Badge>
            ))}
          </span>
        ) : (
          <span className={styles.none}>—</span>
        )}
      </td>
      <td>
        <TagList tags={pulse.tags} />
      </td>
    </tr>
  )
}

export function EnrichmentPanel({ inv, activity, onRun }: CasePanelProps) {
  const enrichment = inv.enrichment
  if (!enrichment) {
    return (
      <StepPrompt
        step="enrich"
        inv={inv}
        activity={activity}
        onRun={onRun}
        icon={<ShieldQuestion />}
        title="Sin enriquecimiento todavía"
      >
        <p>Consulta la reputación del indicador en AlienVault OTX. La respuesta queda en caché en el backend.</p>
      </StepPrompt>
    )
  }

  const { resumen, detalle } = enrichment
  return (
    <div className={styles.panel}>
      <dl className={styles.stats}>
        <div>
          <dt>Evidencia</dt>
          <dd>
            <Badge tone={enrichment.tiene_evidencia ? 'accent' : 'neutral'}>
              {enrichment.tiene_evidencia ? 'Sí, mencionado en OTX' : 'Sin menciones en OTX'}
            </Badge>
          </dd>
        </div>
        <div>
          <dt>Pulses que lo mencionan</dt>
          <dd className="mono">{resumen.pulseCount}</dd>
        </div>
        <div>
          <dt>Tipo en OTX</dt>
          <dd className="mono">{resumen.tipo ?? '—'}</dd>
        </div>
        <div>
          <dt>Fuente</dt>
          <dd className="mono">{enrichment.fuente}</dd>
        </div>
      </dl>

      {resumen.validations.length > 0 && (
        <Alert tone="info" title="Validaciones de OTX sobre este indicador">
          <ul className={styles.validations}>
            {resumen.validations.map((v, i) => (
              <li key={`${v.source}-${i}`}>
                <strong>{v.name}</strong>
                {v.message && ` — ${v.message}`} <span className={styles.sub}>({v.source})</span>
              </li>
            ))}
          </ul>
        </Alert>
      )}

      {resumen.pulses.length > 0 ? (
        <div className={styles.tableWrap}>
          <table className={styles.table}>
            <caption>
              Pulses de OTX
              {resumen.pulseCount > resumen.pulses.length &&
                ` · mostrando ${resumen.pulses.length} de ${resumen.pulseCount}`}
            </caption>
            <thead>
              <tr>
                <th scope="col">Pulse</th>
                <th scope="col">Indicadores</th>
                <th scope="col">Familias de malware</th>
                <th scope="col">Tags</th>
              </tr>
            </thead>
            <tbody>
              {resumen.pulses.map((pulse) => (
                <PulseRow key={pulse.id} pulse={pulse} />
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className={styles.none}>Ningún pulse de OTX menciona este indicador.</p>
      )}

      <details className={styles.raw}>
        <summary>
          <Braces size={15} aria-hidden="true" /> Respuesta cruda de OTX (JSON)
        </summary>
        {detalle ? (
          <pre className={styles.json}>{JSON.stringify(detalle, null, 2)}</pre>
        ) : (
          <div className={styles.rawMissing}>
            <p>La respuesta cruda no se guarda en el navegador para no llenar el almacenamiento local.</p>
            <Button
              size="sm"
              icon={<RefreshCw size={14} aria-hidden="true" />}
              loading={activity.running === 'enrich'}
              disabled={activity.running !== null || inv.missing}
              onClick={() => onRun('enrich')}
            >
              Recargar desde la caché del backend
            </Button>
          </div>
        )}
      </details>
    </div>
  )
}
