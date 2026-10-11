import { ChevronRight, Layers, Link2, Play, RefreshCw } from 'lucide-react'
import { useEffect, useState, type ReactNode } from 'react'
import type { BatchDetail, ConfianzaVinculo } from '../../api/types'
import type { ErrorInfo } from '../../api/http'
import {
  CONCLUSION_LABEL,
  estadoPaso,
  fuentesFallidas,
  INGESTA_LABEL,
  miembroListo,
  PASOS_LOTE,
  SENAL_LABEL,
  type EstadoPaso,
} from '../../domain/batch'
import { describeFailure } from '../../domain/failures'
import { formatDateTime, truncateMiddle } from '../../domain/format'
import type { Investigation } from '../../domain/investigation'
import { ESTADO_FUENTE_LABEL, sourceName } from '../../domain/severity'
import { rutas } from '../../hooks/useRoute'
import { useInvestigations } from '../../state/InvestigationsContext'
import app from '../../App.module.css'
import { SourceIcon } from '../case/Signals'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { NIVEL_CONFIANZA_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge, type Tone } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EmptyState } from '../ui/EmptyState'
import { Panel } from '../ui/Panel'
import { Spinner } from '../ui/Spinner'
import styles from './Batch.module.css'

const PASO: Record<EstadoPaso, { texto: string; tono: Tone; icono?: ReactNode }> = {
  pendiente: { texto: 'Pendiente', tono: 'neutral' },
  en_curso: { texto: 'En curso', tono: 'accent', icono: <Spinner size={11} /> },
  hecho: { texto: 'Hecho', tono: 'success' },
  fallido: { texto: 'Falló', tono: 'danger' },
}

const CONFIANZA_VINCULO_TONE: Record<ConfianzaVinculo, Tone> = NIVEL_CONFIANZA_TONE

export function BatchPage({ id }: { id: number }) {
  const { items, activityOf, loadBatch, analyzeBatch, completeSources, runAutomatic } = useInvestigations()
  const [detalle, setDetalle] = useState<BatchDetail | null>(null)
  const [error, setError] = useState<ErrorInfo | null>(null)

  const miembros = (detalle?.items ?? [])
    .map((item) => items.find((inv) => inv.indicator.id === item.indicator_id))
    .filter((inv): inv is Investigation => inv !== undefined)
  const corriendo = miembros.some((inv) => activityOf(inv.indicator.id).running !== null)

  // Se carga al abrir y se recarga cada vez que termina una tanda: la correlación entre los
  // indicadores la calcula el backend sobre lo persistido.
  useEffect(() => {
    if (corriendo) return
    let active = true
    void loadBatch(id).then((r) => {
      if (!active) return
      if (r.ok) {
        setDetalle(r.detail)
        setError(null)
      } else {
        setError(r.error)
      }
    })
    return () => {
      active = false
    }
  }, [id, corriendo, loadBatch])

  if (!detalle) {
    if (!error) return <EmptyState icon={<Spinner size={20} />} title={`Cargando el lote #${id} desde el backend…`} />
    return (
      <EmptyState
        icon={<Layers />}
        title={error.status === 404 ? `El lote #${id} no existe en el backend` : 'No se pudo cargar el lote'}
      >
        <p>
          {error.status === 404 ? 'Puede que la base de datos se haya reiniciado.' : error.message}{' '}
          <a href={rutas.lotes}>Ver lotes</a>
        </p>
      </EmptyState>
    )
  }

  const { batch, correlacion } = detalle
  const ref = new Map(correlacion.indicadores.map((m) => [m.indicator_id, m.ref]))
  const pendientes = miembros.filter((inv) => !miembroListo(inv))
  const conFallas = miembros.filter((inv) => fuentesFallidas(inv).length > 0)
  const fallidos = miembros.filter((inv) => activityOf(inv.indicator.id).failure !== null).length
  const descartados = detalle.items.filter((item) => item.indicator_id === null)
  const sinVerificar = new Map<string, string[]>()
  for (const inv of conFallas) {
    for (const f of fuentesFallidas(inv)) {
      sinVerificar.set(f.etiqueta, [...(sinVerificar.get(f.etiqueta) ?? []), ref.get(inv.indicator.id) ?? `#${inv.indicator.id}`])
    }
  }

  return (
    <>
      <nav aria-label="Ruta de navegación" className={app.breadcrumb}>
        <a href={rutas.lotes}>Lotes</a>
        <ChevronRight size={14} aria-hidden="true" />
        <span aria-current="page">{batch.nombre || `Lote #${batch.id}`}</span>
      </nav>

      <Panel
        title={batch.nombre || `Lote #${batch.id}`}
        icon={<Layers aria-hidden="true" />}
        actions={
          <Button
            variant="primary"
            size="sm"
            icon={<Play size={14} aria-hidden="true" />}
            loading={corriendo}
            disabled={pendientes.length === 0}
            onClick={() => void analyzeBatch(pendientes)}
          >
            {corriendo ? 'Analizando…' : `Analizar pendientes (${pendientes.length})`}
          </Button>
        }
      >
        <div className={styles.stack}>
          <p className={styles.meta}>
            #{batch.id} · {miembros.length} indicador(es)
            {descartados.length > 0 && ` · ${descartados.length} entrada(s) descartada(s)`} · creado{' '}
            {formatDateTime(batch.timestamp)}
          </p>

          <div className={styles.progress}>
            <progress value={miembros.length - pendientes.length} max={miembros.length || 1} aria-label="Avance del lote" />
            <span aria-live="polite">
              {miembros.length - pendientes.length} de {miembros.length} procesados
              {fallidos > 0 && ` · ${fallidos} con fallo`}
            </span>
          </div>

          {error && (
            <Alert tone="warning" title="No se pudo actualizar el lote">
              {error.message}
            </Alert>
          )}

          {sinVerificar.size > 0 && (
            <Alert
              tone="info"
              title="Fuentes sin verificar"
              actions={
                <Button
                  size="sm"
                  icon={<RefreshCw size={14} aria-hidden="true" />}
                  disabled={corriendo}
                  onClick={() => void completeSources(conFallas)}
                >
                  Completar fuentes ({conFallas.length})
                </Button>
              }
            >
              {[...sinVerificar].map(([etiqueta, refs]) => `${etiqueta}: ${refs.join(', ')}`).join(' · ')}. Sin
              verificar no significa sin evidencia; VirusTotal admite 4 consultas por minuto, así que conviene esperar
              un minuto antes de completar.
            </Alert>
          )}

          <div className={styles.tableWrap}>
            <table className={styles.table}>
              <caption className="sr-only">Indicadores del lote</caption>
              <thead>
                <tr>
                  <th scope="col">Ref</th>
                  <th scope="col">Indicador</th>
                  <th scope="col">Enriquecimiento</th>
                  <th scope="col">Correlación</th>
                  <th scope="col">Fuentes</th>
                  <th scope="col">Entidad</th>
                  <th scope="col">
                    <span className="sr-only">Acciones</span>
                  </th>
                </tr>
              </thead>
              <tbody>
                {miembros.map((inv) => {
                  const { id: indicadorId, tipo, valor } = inv.indicator
                  const actividad = activityOf(indicadorId)
                  const fallo = actividad.failure
                  return (
                    <tr key={indicadorId}>
                      <td className={styles.ref}>{ref.get(indicadorId) ?? '—'}</td>
                      <td>
                        <a className={`${styles.indicador} mono`} href={rutas.investigacion(indicadorId)} title={valor}>
                          <IndicatorTypeIcon tipo={tipo} size={14} />
                          {truncateMiddle(valor, 36)}
                        </a>
                      </td>
                      {PASOS_LOTE.map((paso) => {
                        const estado = PASO[estadoPaso(inv, actividad, paso)]
                        return (
                          <td key={paso}>
                            <Badge tone={estado.tono} icon={estado.icono}>
                              {estado.texto}
                            </Badge>
                          </td>
                        )
                      })}
                      <td>
                        <ul className={styles.fuentes} aria-label="Fuentes">
                          {(inv.enrichment?.fuentes ?? []).map((f) => (
                            <li key={f.fuente} title={ESTADO_FUENTE_LABEL[f.estado]}>
                              <SourceIcon estado={f.estado} />
                              {sourceName(f.fuente)}
                              <span className="sr-only">: {ESTADO_FUENTE_LABEL[f.estado]}</span>
                            </li>
                          ))}
                        </ul>
                      </td>
                      <td>
                        {inv.correlation?.entity ? (
                          <Badge tone="entity">{inv.correlation.entity.nombre}</Badge>
                        ) : inv.correlation ? (
                          <span className={styles.muted}>Sin asociación</span>
                        ) : (
                          '—'
                        )}
                      </td>
                      <td>
                        {fallo && (
                          <div className={styles.fallo}>
                            <span>{describeFailure(fallo.step, fallo.error).title}</span>
                            <Button size="sm" disabled={actividad.running !== null} onClick={() => void runAutomatic(inv, PASOS_LOTE)}>
                              Reintentar
                            </Button>
                          </div>
                        )}
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          </div>

          {descartados.length > 0 && (
            <section aria-label="Entradas descartadas">
              <h3 className={styles.subtitle}>Entradas descartadas</h3>
              <ul className={styles.descartes}>
                {descartados.map((item) => (
                  <li key={item.posicion}>
                    <span className="mono">{truncateMiddle(item.entrada, 48)}</span>
                    <Badge tone={item.ingesta === 'invalido' ? 'warning' : 'neutral'}>{INGESTA_LABEL[item.ingesta]}</Badge>
                    {item.motivo && <span className={styles.muted}>{item.motivo}</span>}
                  </li>
                ))}
              </ul>
            </section>
          )}
        </div>
      </Panel>

      <Panel title="Vínculos entre indicadores" icon={<Link2 aria-hidden="true" />} actions={<Badge>{correlacion.vinculos.length}</Badge>}>
        <div className={styles.stack}>
          <p>
            <Badge tone={correlacion.conclusion.nivel === 'relacion_demostrable' ? 'info' : 'neutral'}>
              {CONCLUSION_LABEL[correlacion.conclusion.nivel]}
            </Badge>{' '}
            {correlacion.conclusion.texto}
          </p>
          {correlacion.vinculos.length > 0 && (
            <ul className={styles.vinculos}>
              {correlacion.vinculos.map((v) => (
                <li key={v.id}>
                  <span className={styles.ref}>{v.id}</span>
                  <span>
                    {v.a} – {v.b}
                  </span>
                  <span className={styles.muted}>{v.senales.map((s) => SENAL_LABEL[s.tipo]).join(' + ')}</span>
                  <Badge tone={CONFIANZA_VINCULO_TONE[v.confianza]}>Confianza {v.confianza}</Badge>
                </li>
              ))}
            </ul>
          )}
          <p className={styles.muted}>
            Calculados por NEXO con reglas fijas a partir de lo ya persistido; se actualizan al terminar el análisis.
            Compartir técnicas o tácticas no cuenta como vínculo.
          </p>
        </div>
      </Panel>
    </>
  )
}
