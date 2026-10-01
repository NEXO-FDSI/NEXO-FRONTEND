import { ArrowRight, ChevronLeft, ChevronRight, FolderSearch, Search } from 'lucide-react'
import { useId, useState } from 'react'
import { formatDateTime, indicatorTypeLabel, truncateMiddle } from '../../domain/format'
import { investigationStatus, STATUS_LABEL, type Investigation } from '../../domain/investigation'
import { rutas } from '../../hooks/useRoute'
import { useInvestigations } from '../../state/InvestigationsContext'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { STATUS_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import { Spinner } from '../ui/Spinner'
import styles from './CaseList.module.css'

function matches(inv: Investigation, query: string): boolean {
  return [inv.indicator.valor, inv.entrada, inv.indicator.fuente, inv.correlation?.entity?.nombre].some(
    (field) => field?.toLowerCase().includes(query),
  )
}

const POR_PAGINA = 10

export function CaseList() {
  const { items, activityOf, persisted, sincronizacion } = useInvestigations()
  const [query, setQuery] = useState('')
  const [pagina, setPagina] = useState(1)
  const searchId = useId()
  const q = query.trim().toLowerCase()
  const filtradas = q ? items.filter((inv) => matches(inv, q)) : items
  const paginas = Math.max(1, Math.ceil(filtradas.length / POR_PAGINA))
  // Si la lista se achica (búsqueda, eliminación, sincronización) la página se ajusta sola.
  const actual = Math.min(pagina, paginas)
  const visible = filtradas.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA)

  return (
    <Panel
      title="Investigaciones"
      icon={<FolderSearch aria-hidden="true" />}
      actions={<Badge>{items.length}</Badge>}
      className={styles.panel}
    >
      {sincronizacion.estado === 'sincronizando' && (
        <p className={styles.sync} role="status">
          <Spinner size={13} />
          {sincronizacion.paginas > 1
            ? `Cargando investigaciones de la plataforma: página ${sincronizacion.pagina} de ${sincronizacion.paginas}…`
            : 'Sincronizando con el backend…'}
        </p>
      )}
      {sincronizacion.estado === 'error' && (
        <Alert tone="warning" title="No se pudo sincronizar con el backend">
          Se muestran las investigaciones guardadas en este navegador. {sincronizacion.mensaje}
        </Alert>
      )}
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
          onChange={(e) => {
            setQuery(e.target.value)
            setPagina(1)
          }}
          placeholder="Valor, entidad o fuente"
        />
      </div>

      {items.length === 0 ? (
        <p className={styles.empty}>
          Aún no hay investigaciones. <a href={rutas.analizar}>Analiza un indicador</a> para empezar.
        </p>
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
                <a className={styles.item} href={rutas.investigacion(id)}>
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
                </a>
              </li>
            )
          })}
        </ul>
      )}
      {paginas > 1 && (
        <nav className={styles.pager} aria-label="Paginación de investigaciones">
          <Button
            size="sm"
            variant="ghost"
            icon={<ChevronLeft size={14} aria-hidden="true" />}
            disabled={actual === 1}
            onClick={() => setPagina(actual - 1)}
          >
            Anterior
          </Button>
          <span className={styles.pageInfo} aria-live="polite">
            Página {actual} de {paginas} · {filtradas.length} investigaciones
          </span>
          <Button size="sm" variant="ghost" disabled={actual === paginas} onClick={() => setPagina(actual + 1)}>
            Siguiente
            <ChevronRight size={14} aria-hidden="true" />
          </Button>
        </nav>
      )}
    </Panel>
  )
}
