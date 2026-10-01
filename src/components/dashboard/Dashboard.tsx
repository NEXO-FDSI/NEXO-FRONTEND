import { Activity, Clock, Crosshair, Radar, ShieldAlert, Sparkles } from 'lucide-react'
import { useState, type CSSProperties, type ReactNode } from 'react'
import type { NivelSeveridad } from '../../api/types'
import { formatDateTime, indicatorTypeLabel, truncateMiddle } from '../../domain/format'
import { investigationStatus, STATUS_LABEL, type Investigation } from '../../domain/investigation'
import { ESTADO_FUENTE_LABEL, isFailedSource, latestMetadatos, SEVERITY_RANK } from '../../domain/severity'
import { rutas } from '../../hooks/useRoute'
import { useStatus } from '../../hooks/useStatus'
import { useInvestigations } from '../../state/InvestigationsContext'
import { SeverityBadge } from '../case/Signals'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { STATUS_TONE } from '../tones'
import { Badge } from '../ui/Badge'
import { Panel } from '../ui/Panel'
import { Welcome } from './Welcome'
import styles from './Dashboard.module.css'

const MAX_FILAS = 8
const MAX_TACTICAS = 6

const nivelDe = (inv: Investigation): NivelSeveridad | null => latestMetadatos(inv)?.severidad.nivel ?? null
// "Sin evaluar" va entre lo indeterminado y lo bajo: falta información, no es inocuo.
const rango = (inv: Investigation) => {
  const nivel = nivelDe(inv)
  return nivel ? SEVERITY_RANK[nivel] : 3.5
}

type FiltroId = 'todas' | 'atribuidas' | 'graves' | 'pendientes'

const FILTROS: readonly { id: FiltroId; label: string; icon: ReactNode; tone: string; incluye: (inv: Investigation) => boolean }[] = [
  { id: 'todas', label: 'Investigaciones', icon: <Radar />, tone: 'var(--color-info)', incluye: () => true },
  {
    id: 'atribuidas',
    label: 'Con amenaza atribuida',
    icon: <Crosshair />,
    tone: 'var(--color-entity)',
    incluye: (inv) => Boolean(inv.correlation?.resuelto),
  },
  {
    id: 'graves',
    label: 'Críticas o altas',
    icon: <ShieldAlert />,
    tone: 'var(--sev-critica)',
    incluye: (inv) => nivelDe(inv) === 'critica' || nivelDe(inv) === 'alta',
  },
  {
    id: 'pendientes',
    label: 'Pendientes de validación',
    icon: <Clock />,
    tone: 'var(--color-warning)',
    incluye: (inv) => investigationStatus(inv) === 'pendiente',
  },
]

/** Lo que pide acción primero: más grave, luego pendiente de validación, luego lo más reciente. */
function porAtencion(a: Investigation, b: Investigation): number {
  const pendiente = (inv: Investigation) => (investigationStatus(inv) === 'pendiente' ? 0 : 1)
  return (
    rango(a) - rango(b) ||
    pendiente(a) - pendiente(b) ||
    b.indicator.timestamp_ingesta.localeCompare(a.indicator.timestamp_ingesta)
  )
}

function FuentesResumen({ inv }: { inv: Investigation }) {
  const fuentes = inv.enrichment?.fuentes ?? []
  if (!inv.enrichment) return <span className={styles.muted}>Sin enriquecer</span>
  if (fuentes.length === 0) return <span className={styles.muted}>Solo OTX</span>
  const conRegistros = fuentes.filter((f) => f.estado === 'con_evidencia').length
  const fallidas = fuentes.filter((f) => isFailedSource(f.estado))
  return (
    <span title={fuentes.map((f) => `${f.etiqueta}: ${ESTADO_FUENTE_LABEL[f.estado]}`).join(' · ')}>
      {conRegistros}/{fuentes.length} con registros
      {fallidas.length > 0 && <span className={styles.warn}> · {fallidas.length} sin respuesta</span>}
    </span>
  )
}

function AttentionTable({ items }: { items: Investigation[] }) {
  if (items.length === 0) return <p className={styles.muted}>Ninguna investigación en esta categoría.</p>
  return (
    <div className={styles.tableWrap}>
      <table className={styles.table}>
        <caption className="sr-only">Investigaciones ordenadas por severidad y validación pendiente</caption>
        <thead>
          <tr>
            <th scope="col">Severidad</th>
            <th scope="col">Indicador</th>
            <th scope="col">Entidad</th>
            <th scope="col">Estado</th>
            <th scope="col">Fuentes</th>
            <th scope="col">Registrado</th>
          </tr>
        </thead>
        <tbody>
          {items.map((inv) => {
            const { id, tipo, valor } = inv.indicator
            const status = investigationStatus(inv)
            return (
              <tr key={id}>
                <td>
                  <SeverityBadge nivel={nivelDe(inv)} />
                </td>
                <td>
                  <a className={styles.ioc} href={rutas.investigacion(id)} title={valor}>
                    <IndicatorTypeIcon tipo={tipo} size={14} />
                    <span className="sr-only">{indicatorTypeLabel(tipo)}: </span>
                    <span className="mono">{truncateMiddle(valor, 36)}</span>
                  </a>
                </td>
                <td className={styles.entity}>
                  {inv.correlation?.entity?.nombre ?? (inv.correlation ? <span className={styles.muted}>Sin asociación</span> : '—')}
                </td>
                <td>
                  <Badge tone={inv.missing ? 'danger' : STATUS_TONE[status]}>
                    {inv.missing ? 'No existe en backend' : STATUS_LABEL[status]}
                  </Badge>
                </td>
                <td className={styles.small}>
                  <FuentesResumen inv={inv} />
                </td>
                <td className={styles.small}>{formatDateTime(inv.indicator.timestamp_ingesta)}</td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}

/** Fuentes configuradas y proveedor de IA activo, tal como los informa GET /status. */
function SourcesHealth() {
  const status = useStatus()

  return (
    <Panel title="Fuentes y modelo" icon={<Activity aria-hidden="true" />}>
      {!status ? (
        <p className={styles.muted}>No se pudo consultar la configuración del backend (GET /status).</p>
      ) : (
        <ul className={styles.health}>
          {status.fuentes.map((f) => (
            <li key={f.fuente}>
              <span className={styles.healthName}>{f.etiqueta}</span>
              <Badge tone={f.configurada ? 'success' : 'neutral'}>{f.configurada ? 'Configurada' : 'Sin clave'}</Badge>
            </li>
          ))}
          <li>
            <span className={styles.healthName}>
              <Sparkles size={14} aria-hidden="true" className={styles.ai} /> IA
            </span>
            <span className="mono">
              {status.ia.proveedor} · {status.ia.modelo}
            </span>
          </li>
        </ul>
      )}
    </Panel>
  )
}

/** En cuántas investigaciones aparece cada táctica: muestra solapamiento entre casos. */
function TopTactics({ items }: { items: Investigation[] }) {
  const conteo = new Map<string, number>()
  for (const inv of items) {
    for (const tactica of new Set(inv.correlation?.tecnicas.map((t) => t.tactica))) {
      conteo.set(tactica, (conteo.get(tactica) ?? 0) + 1)
    }
  }
  const top = [...conteo.entries()].toSorted((a, b) => b[1] - a[1] || a[0].localeCompare(b[0])).slice(0, MAX_TACTICAS)
  const maximo = top[0]?.[1] ?? 0

  return (
    <Panel title="Tácticas ATT&CK más frecuentes" icon={<Crosshair aria-hidden="true" />}>
      {top.length === 0 ? (
        <p className={styles.muted}>Aún no hay técnicas atribuidas.</p>
      ) : (
        <ul className={styles.bars}>
          {top.map(([tactica, n]) => (
            <li key={tactica}>
              <span className={styles.barLabel}>{tactica}</span>
              <span className={styles.barTrack} aria-hidden="true">
                <span className={styles.barFill} style={{ width: `${(n / maximo) * 100}%` }} />
              </span>
              <span className={`${styles.barValue} mono`}>
                {n}
                <span className="sr-only"> investigación(es)</span>
              </span>
            </li>
          ))}
        </ul>
      )}
    </Panel>
  )
}

export function Dashboard() {
  const { items } = useInvestigations()
  const [filtro, setFiltro] = useState<FiltroId>('todas')
  const activo = FILTROS.find((f) => f.id === filtro) ?? FILTROS[0]
  const visibles = items.filter(activo.incluye).toSorted(porAtencion)

  return (
    <>
      <section aria-label="Resumen de investigaciones">
        <ul className={styles.kpis}>
          {FILTROS.map((f) => (
            <li key={f.id}>
              <button
                type="button"
                className={styles.kpi}
                style={{ '--tone': f.tone } as CSSProperties}
                aria-pressed={filtro === f.id}
                onClick={() => setFiltro(f.id)}
              >
                <span className={styles.kpiIcon} aria-hidden="true">
                  {f.icon}
                </span>
                <span className={styles.kpiValue}>{items.filter(f.incluye).length}</span>
                <span className={styles.kpiLabel}>{f.label}</span>
              </button>
            </li>
          ))}
        </ul>
      </section>

      {items.length === 0 ? (
        <Welcome />
      ) : (
        <div className={styles.grid}>
          <Panel
            title="Requieren atención"
            icon={<ShieldAlert aria-hidden="true" />}
            actions={
              visibles.length > MAX_FILAS && (
                <a className={styles.more} href={rutas.investigaciones}>
                  Ver las {visibles.length}
                </a>
              )
            }
          >
            <AttentionTable items={visibles.slice(0, MAX_FILAS)} />
          </Panel>
          <div className={styles.side}>
            <SourcesHealth />
            <TopTactics items={items} />
          </div>
        </div>
      )}
    </>
  )
}
