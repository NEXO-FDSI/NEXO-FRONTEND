import { ChevronRight, Crosshair, Layers, Waypoints } from 'lucide-react'
import type { ReactNode } from 'react'
import { groupByTactic } from '../../domain/attck'
import { indicatorTypeLabel, truncateMiddle } from '../../domain/format'
import type { Investigation } from '../../domain/investigation'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { ConfidenceMeter } from '../ui/ConfidenceMeter'
import { Panel } from '../ui/Panel'
import styles from './EvidenceChain.module.css'

type NodeState = 'active' | 'empty' | 'pending'

interface ChainNodeProps {
  caption: string
  icon: ReactNode
  state: NodeState
  children: ReactNode
  detail?: ReactNode
}

function ChainNode({ caption, icon, state, children, detail }: ChainNodeProps) {
  return (
    <li className={`${styles.node} ${styles[state]}`}>
      <span className={styles.caption}>
        {icon}
        {caption}
      </span>
      <span className={styles.main}>{children}</span>
      {detail && <span className={styles.detail}>{detail}</span>}
    </li>
  )
}

/**
 * La cadena indicador → entidad → técnicas, que es la razón de ser de la interfaz.
 * Refleja el corte del backend: si la etapa (a) no resuelve, la (b) no se ejecuta.
 */
export function EvidenceChain({ inv }: { inv: Investigation }) {
  const { tipo, valor } = inv.indicator
  const correlation = inv.correlation
  const entity = correlation?.entity ?? null
  const tacticCount = groupByTactic(correlation?.tecnicas ?? []).length

  return (
    <Panel title="Cadena de evidencia" icon={<Waypoints aria-hidden="true" />}>
      <ol className={styles.chain}>
        <ChainNode caption="Indicador" icon={<IndicatorTypeIcon tipo={tipo} size={14} />} state="active" detail={indicatorTypeLabel(tipo)}>
          <span className="mono" title={valor}>
            {truncateMiddle(valor, 30)}
          </span>
        </ChainNode>
        <li className={styles.link} aria-hidden="true">
          <ChevronRight />
        </li>
        <ChainNode
          caption="Entidad · etapa (a)"
          icon={<Crosshair size={14} aria-hidden="true" />}
          state={!correlation ? 'pending' : entity ? 'active' : 'empty'}
          detail={entity?.tipo}
        >
          {!correlation ? 'Pendiente de correlación' : entity ? entity.nombre : 'Sin asociación'}
        </ChainNode>
        <li className={styles.link} aria-hidden="true">
          <ChevronRight />
        </li>
        <ChainNode
          caption="Técnicas · etapa (b)"
          icon={<Layers size={14} aria-hidden="true" />}
          state={!correlation ? 'pending' : entity ? 'active' : 'empty'}
          detail={entity ? `${tacticCount} táctica(s)` : undefined}
        >
          {!correlation
            ? 'Pendiente de correlación'
            : entity
              ? `${correlation.tecnicas.length} técnica(s) ATT&CK`
              : 'No se ejecuta'}
        </ChainNode>
      </ol>

      {correlation?.resuelto && (
        <div className={styles.evidence}>
          <ConfidenceMeter value={correlation.confianza} />
          <div>
            <p className={styles.evidenceLabel}>Evidencia de la asociación</p>
            <code className={styles.evidenceText}>{correlation.evidencia}</code>
          </div>
        </div>
      )}
      {correlation && !correlation.resuelto && (
        <p className={styles.note}>
          Sin evidencia suficiente para asociar el indicador a una entidad conocida, así que no se
          atribuye ninguna técnica. La ausencia de asociación es un resultado válido, no un error.
        </p>
      )}
    </Panel>
  )
}
