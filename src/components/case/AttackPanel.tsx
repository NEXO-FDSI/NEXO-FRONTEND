import { Crosshair, ExternalLink } from 'lucide-react'
import type { AnalisisIA, Technique } from '../../api/types'
import { groupByTactic, techniqueUrl } from '../../domain/attck'
import { sourceName } from '../../domain/severity'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { StepPrompt } from './StepPrompt'
import type { CasePanelProps } from './types'
import styles from './AttackPanel.module.css'

interface AttackPanelProps extends CasePanelProps {
  /** Técnicas que el análisis de IA señaló como relevantes, con su motivo. */
  destacadas?: AnalisisIA['tecnicas_destacadas']
}

const nombres = (fuentes: readonly string[]) => fuentes.map(sourceName).join(', ')

/** "Vía OTX, ThreatFox · citada por OTX": de qué fuentes sale la técnica. */
function provenance({ fuentes = [], reportada_por = [] }: Technique): string | null {
  if (fuentes.length === 0) return null
  return `Vía ${nombres(fuentes)}${reportada_por.length > 0 ? ` · citada por ${nombres(reportada_por)}` : ''}`
}

export function AttackPanel({ inv, activity, onRun, destacadas = [] }: AttackPanelProps) {
  const correlation = inv.correlation
  const motivoIA = new Map(destacadas.map((t) => [t.id, t.motivo]))
  if (!correlation) {
    return (
      <StepPrompt
        step="correlate"
        inv={inv}
        activity={activity}
        onRun={onRun}
        icon={<Crosshair />}
        title="Sin correlación todavía"
      >
        <p>
          Resuelve la entidad (malware, grupo, herramienta o campaña) combinando la evidencia de OTX,
          ThreatFox y VirusTotal y, solo si la encuentra, recupera sus técnicas MITRE ATT&amp;CK.
        </p>
      </StepPrompt>
    )
  }

  if (!correlation.resuelto || !correlation.entity) {
    return (
      <Alert tone="info" title="Sin técnicas atribuidas">
        La etapa (a) no resolvió ninguna entidad, así que la etapa (b) —recuperación de técnicas— no se
        ejecutó. NEXO nunca fuerza una técnica ATT&amp;CK sin sustento.
      </Alert>
    )
  }

  const groups = groupByTactic(correlation.tecnicas)
  return (
    <div className={styles.panel}>
      <p className={styles.summary}>
        <strong>{correlation.tecnicas.length}</strong> técnica(s) documentadas para{' '}
        <strong className={styles.entity}>{correlation.entity.nombre}</strong> en{' '}
        <strong>{groups.length}</strong> táctica(s). Fuente: MITRE ATT&amp;CK STIX, relación “uses”.
        {!!correlation.fuentes?.length && (
          <>
            {' '}
            Entidad respaldada por <strong>{nombres(correlation.fuentes)}</strong>.
          </>
        )}
        {motivoIA.size > 0 && (
          <>
            {' '}
            La IA destacó <strong>{motivoIA.size}</strong> como relevante(s) para este indicador.
          </>
        )}
      </p>
      {groups.length === 0 ? (
        <p className={styles.summary}>ATT&amp;CK no documenta técnicas para esta entidad.</p>
      ) : (
        <div className={styles.matrix}>
          {groups.map((group) => (
            <section key={group.tactica} className={styles.tactic} aria-label={`Táctica ${group.tactica}`}>
              <h3 className={styles.tacticName}>
                {group.tactica}
                <span className={styles.count}>{group.tecnicas.length}</span>
              </h3>
              <ul className={styles.techniques}>
                {group.tecnicas.map((tecnica) => (
                  <li key={tecnica.id}>
                    <a
                      className={styles.technique}
                      href={techniqueUrl(tecnica.id)}
                      target="_blank"
                      rel="noopener noreferrer"
                    >
                      <span className={`${styles.id} mono`}>{tecnica.id}</span>
                      <span className={styles.name}>
                        {tecnica.nombre}
                        {provenance(tecnica) && <span className={styles.sources}>{provenance(tecnica)}</span>}
                      </span>
                      {motivoIA.has(tecnica.id) && (
                        <Badge tone="ai" title={motivoIA.get(tecnica.id)}>
                          IA
                          <span className="sr-only">: destacada por el análisis. {motivoIA.get(tecnica.id)}</span>
                        </Badge>
                      )}
                      <ExternalLink size={13} aria-hidden="true" className={styles.external} />
                      <span className="sr-only">(abre attack.mitre.org en una pestaña nueva)</span>
                    </a>
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}
    </div>
  )
}
