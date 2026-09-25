import { Crosshair, ExternalLink } from 'lucide-react'
import { groupByTactic, techniqueUrl } from '../../domain/attck'
import { Alert } from '../ui/Alert'
import { StepPrompt } from './StepPrompt'
import type { CasePanelProps } from './types'
import styles from './AttackPanel.module.css'

export function AttackPanel({ inv, activity, onRun }: CasePanelProps) {
  const correlation = inv.correlation
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
          Resuelve la entidad (malware, grupo, herramienta o campaña) a partir de la evidencia de OTX
          y, solo si la encuentra, recupera sus técnicas MITRE ATT&amp;CK.
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
                      <span className={styles.name}>{tecnica.nombre}</span>
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
