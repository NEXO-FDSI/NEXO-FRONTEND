import { ArrowRight, FolderSearch, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { formatDateTime, indicatorTypeLabel, truncateMiddle } from '../../domain/format'
import { investigationStatus, STATUS_LABEL, type Investigation } from '../../domain/investigation'
import { useInvestigations } from '../../state/InvestigationsContext'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { STATUS_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Panel } from '../ui/Panel'
import { Spinner } from '../ui/Spinner'
import styles from './CaseList.module.css'

function matches(inv: Investigation, query: string): boolean {
  return [inv.indicator.valor, inv.entrada, inv.indicator.fuente, inv.correlation?.entity?.nombre].some(
    (field) => field?.toLowerCase().includes(query),
  )
}

/** En pantallas angostas el detalle queda debajo de la lista: se lleva al analista hasta él. */
function revealDetail() {
  if (window.matchMedia?.('(max-width: 960px)').matches) {
    document.getElementById('case-detail')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
  }
}

export function CaseList() {
  const { items, selected, select, activityOf, persisted } = useInvestigations()
  const [query, setQuery] = useState('')
  const searchId = useId()
  const q = query.trim().toLowerCase()
  const visible = q ? items.filter((inv) => matches(inv, q)) : items

  return (
    <Panel
      title="Investigaciones"
      icon={<FolderSearch aria-hidden="true" />}
      actions={<Badge>{items.length}</Badge>}
      className={styles.panel}
    >
      {!persisted && (
        <Alert tone="warning" title="El historial no se está guardando">
          El navegador rechazó el almacenamiento local; los resultados se perderán al recargar.
        </Alert>
      )}

      <div className={styles.search}>
        <Search size={16} aria-hidden="true" />
        <label htmlFor={searchId} className="sr-only">
          Buscar investigaciones
        </label>
        <input
          id={searchId}
          type="search"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          placeholder="Valor, entidad o fuente"
        />
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>Aún no hay investigaciones. Registra un indicador para empezar.</p>
      ) : visible.length === 0 ? (
        <p className={styles.empty}>Ninguna investigación coincide con “{query.trim()}”.</p>
      ) : (
        <ul className={styles.list}>
          {visible.map((inv) => {
            const { id, tipo, valor } = inv.indicator
            const status = investigationStatus(inv)
            const running = activityOf(id).running
            const entity = inv.correlation?.entity
            return (
              <li key={id}>
                <button
                  type="button"
                  className={styles.item}
                  aria-current={selected?.indicator.id === id ? 'true' : undefined}
                  onClick={() => {
                    select(id)
                    revealDetail()
                  }}
                >
                  <span className={styles.row}>
                    <span className={styles.type}>
                      <IndicatorTypeIcon tipo={tipo} size={14} />
                      {indicatorTypeLabel(tipo)} · #{id}
                    </span>
                    {running ? (
                      <Badge tone="accent" icon={<Spinner size={11} />}>
                        Procesando
                      </Badge>
                    ) : (
                      <Badge tone={inv.missing ? 'danger' : STATUS_TONE[status]}>
                        {inv.missing ? 'No existe en backend' : STATUS_LABEL[status]}
                      </Badge>
                    )}
                  </span>
                  <span className={`${styles.value} mono`} title={valor}>
                    {truncateMiddle(valor, 34)}
                  </span>
                  <span className={styles.row}>
                    <span className={styles.entity}>
                      {entity ? (
                        <>
                          <ArrowRight size={13} aria-hidden="true" />
                          {entity.nombre}
                        </>
                      ) : inv.correlation ? (
                        'Sin asociación'
                      ) : null}
                    </span>
                    <span className={styles.date}>{formatDateTime(inv.indicator.timestamp_ingesta)}</span>
                  </span>
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </Panel>
  )
}
