import { Layers, Plus } from 'lucide-react'
import { useEffect, useState } from 'react'
import type { ErrorInfo } from '../../api/http'
import type { BatchSummary } from '../../api/types'
import { CONCLUSION_LABEL } from '../../domain/batch'
import { formatDateTime } from '../../domain/format'
import { rutas } from '../../hooks/useRoute'
import { useInvestigations } from '../../state/InvestigationsContext'
import list from '../sidebar/CaseList.module.css'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Panel } from '../ui/Panel'
import { Spinner } from '../ui/Spinner'
import styles from './Batch.module.css'

export function BatchList() {
  const { listBatches } = useInvestigations()
  const [lotes, setLotes] = useState<BatchSummary[] | null>(null)
  const [error, setError] = useState<ErrorInfo | null>(null)

  // Sin caché local: los lotes viven en el backend y la lista se pide al abrirla.
  useEffect(() => {
    let active = true
    void listBatches().then((r) => {
      if (!active) return
      if (r.ok) setLotes(r.batches)
      else setError(r.error)
    })
    return () => {
      active = false
    }
  }, [listBatches])

  return (
    <Panel
      title="Lotes"
      icon={<Layers aria-hidden="true" />}
      actions={
        <a className={styles.nuevo} href={rutas.analizarLote}>
          <Plus size={14} aria-hidden="true" />
          Nuevo lote
        </a>
      }
      className={list.panel}
    >
      {error ? (
        <Alert tone="danger" title="No se pudieron cargar los lotes">
          {error.message}
        </Alert>
      ) : lotes === null ? (
        <p className={list.sync} role="status">
          <Spinner size={13} />
          Cargando lotes…
        </p>
      ) : lotes.length === 0 ? (
        <p className={list.empty}>
          Aún no hay lotes. <a href={rutas.analizarLote}>Analiza un lote</a> para correlacionar varios indicadores
          entre sí.
        </p>
      ) : (
        <ul className={list.list}>
          {lotes.map((lote) => (
            <li key={lote.id}>
              <a className={list.item} href={rutas.lote(lote.id)}>
                <span className={list.row}>
                  <span className={list.type}>
                    <Layers size={14} aria-hidden="true" />
                    Lote #{lote.id}
                  </span>
                  <span className={styles.badges}>
                    {lote.ultimo_informe ? (
                      <Badge tone={lote.ultimo_informe.conclusion === 'relacion_demostrable' ? 'info' : 'neutral'}>
                        {CONCLUSION_LABEL[lote.ultimo_informe.conclusion]}
                      </Badge>
                    ) : (
                      <Badge>Sin informe</Badge>
                    )}
                    {lote.decision && (
                      <Badge tone={lote.decision === 'aceptado' ? 'success' : 'danger'}>{lote.decision}</Badge>
                    )}
                  </span>
                </span>
                <span className={list.value}>{lote.nombre || 'Sin nombre'}</span>
                <span className={list.row}>
                  <span className={styles.muted}>
                    {lote.indicadores} indicador(es)
                    {lote.descartados > 0 && ` · ${lote.descartados} descartada(s)`}
                  </span>
                  <span className={list.date}>{formatDateTime(lote.timestamp)}</span>
                </span>
              </a>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}
