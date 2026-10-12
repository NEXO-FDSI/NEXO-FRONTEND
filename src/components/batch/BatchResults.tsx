import { ClipboardCheck, Crosshair, FileText, LayoutList, Link2, Sparkles, Unlink } from 'lucide-react'
import { useId } from 'react'
import type {
  BatchDetail,
  BatchReportRead,
  ConfianzaVinculo,
  CorrelacionLote,
  MiembroLote,
  ValidationRequest,
} from '../../api/types'
import { techniqueUrl } from '../../domain/attck'
import {
  CONCLUSION_LABEL,
  ESTADO_MIEMBRO_LABEL,
  ORIGEN_LABEL,
  SENAL_LABEL,
} from '../../domain/batch'
import { formatDateTime, truncateMiddle } from '../../domain/format'
import { STATUS_LABEL } from '../../domain/investigation'
import { AnalisisIAView } from '../case/AiAnalysisPanel'
import { MarkdownActions, MarkdownReport } from '../case/ReportPanel'
import { SeverityBadge } from '../case/Signals'
import { DecisionPanel, type DescripcionDecisiones } from '../case/ValidationPanel'
import { NIVEL_CONFIANZA_TONE, STATUS_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge, type Tone } from '../ui/Badge'
import { EmptyState } from '../ui/EmptyState'
import { Panel } from '../ui/Panel'
import { Tabs, type TabItem } from '../ui/Tabs'
import styles from './Batch.module.css'

export type BatchTab = 'resumen' | 'vinculos' | 'cobertura' | 'ia' | 'informe'

const CONFIANZA_VINCULO_TONE: Record<ConfianzaVinculo, Tone> = NIVEL_CONFIANZA_TONE

const INFORME_CONJUNTO: DescripcionDecisiones = {
  aceptado: 'La conclusión y los vínculos están sustentados por la evidencia.',
  rechazado: 'La evidencia no sustenta la conclusión o alguno de sus vínculos.',
}

const REGLA_SENALES =
  'Confianza alta: señales fuertes de dos orígenes distintos; media: de uno; baja: solo la misma entidad, que no basta ' +
  'para agrupar. No se consideran señal las técnicas o tácticas compartidas, las etiquetas, los nombres de pulses, ' +
  'los países ni los ASN.'

function Miembro({ miembro }: { miembro: MiembroLote | undefined }) {
  if (!miembro) return null
  return (
    <span className={styles.miembro}>
      <span className={styles.ref}>{miembro.ref}</span>
      <span className="mono" title={miembro.valor}>
        {truncateMiddle(miembro.valor, 30)}
      </span>
    </span>
  )
}

function Resumen({ correlacion }: { correlacion: CorrelacionLote }) {
  const { conclusion, agrupaciones, indicadores, cobertura } = correlacion
  const porRef = new Map(indicadores.map((m) => [m.ref, m]))
  const relacion = conclusion.nivel === 'relacion_demostrable'
  const noParticipan = indicadores.filter((m) => m.estado !== 'participa')
  const sinVerificar = cobertura.fuentes.filter((f) => f.sin_verificar.length > 0)
  return (
    <div className={styles.stack}>
      <section className={`${styles.conclusion} ${relacion ? styles.relacion : ''}`} aria-label="Conclusión del lote">
        <p className={styles.conclusionTitle}>
          {relacion ? <Link2 size={16} aria-hidden="true" /> : <Unlink size={16} aria-hidden="true" />}
          {CONCLUSION_LABEL[conclusion.nivel]}
        </p>
        <p>{conclusion.texto}</p>
        {!relacion && <p className={styles.muted}>La ausencia de relación es un resultado válido, no un error del sistema.</p>}
      </section>

      {agrupaciones.length > 0 && (
        <section aria-label="Agrupaciones">
          <h3 className={styles.subtitle}>Agrupaciones</h3>
          <ul className={styles.vinculos}>
            {agrupaciones.map((a) => (
              <li key={a.id}>
                <span className={styles.ref}>{a.id}</span>
                {a.indicadores.map((ref) => (
                  <Miembro key={ref} miembro={porRef.get(ref)} />
                ))}
                <Badge tone={CONFIANZA_VINCULO_TONE[a.confianza]}>Confianza {a.confianza}</Badge>
                <span className={styles.muted}>
                  vínculos {a.vinculos.join(', ')} · {a.tecnicas_comunes.length} técnica(s) común(es)
                </span>
              </li>
            ))}
          </ul>
        </section>
      )}

      {relacion && conclusion.aislados.length > 0 && (
        <section aria-label="Sin relación demostrable con el resto">
          <h3 className={styles.subtitle}>Sin relación demostrable con el resto</h3>
          <ul className={styles.vinculos}>
            {conclusion.aislados.map((ref) => {
              const miembro = porRef.get(ref)
              return (
                <li key={ref}>
                  <Miembro miembro={miembro} />
                  {miembro?.entidad && <Badge tone="entity">{miembro.entidad.nombre}</Badge>}
                </li>
              )
            })}
          </ul>
        </section>
      )}

      {noParticipan.length > 0 && (
        <section aria-label="No participan en vínculos">
          <h3 className={styles.subtitle}>No participan en vínculos</h3>
          <ul className={styles.vinculos}>
            {noParticipan.map((m) => (
              <li key={m.ref}>
                <Miembro miembro={m} />
                <span className={styles.muted}>{ESTADO_MIEMBRO_LABEL[m.estado]}</span>
                {m.severidad && <SeverityBadge nivel={m.severidad.nivel} />}
              </li>
            ))}
          </ul>
        </section>
      )}

      <p className={styles.muted}>
        <strong>Cobertura {cobertura.nivel}.</strong>{' '}
        {sinVerificar.length > 0
          ? `${sinVerificar.map((f) => `${f.etiqueta} no verificó ${f.sin_verificar.join(', ')}`).join('; ')} (no significa sin evidencia).`
          : 'Las fuentes respondieron para los indicadores procesados.'}
      </p>
    </div>
  )
}

function Vinculos({ correlacion }: { correlacion: CorrelacionLote }) {
  const porRef = new Map(correlacion.indicadores.map((m) => [m.ref, m]))
  return (
    <div className={styles.stack}>
      {correlacion.vinculos.length === 0 ? (
        <EmptyState icon={<Unlink />} title="Ningún par de indicadores comparte evidencia" />
      ) : (
        correlacion.vinculos.map((v) => (
          <article key={v.id} className={styles.card} aria-label={`Vínculo ${v.id}`}>
            <header className={styles.cardHeader}>
              <span className={styles.ref}>{v.id}</span>
              <Miembro miembro={porRef.get(v.a)} />
              <Link2 size={14} aria-hidden="true" />
              <Miembro miembro={porRef.get(v.b)} />
              <Badge tone={CONFIANZA_VINCULO_TONE[v.confianza]}>Confianza {v.confianza}</Badge>
            </header>
            <ul className={styles.senales}>
              {v.senales.map((s) => (
                <li key={s.tipo}>
                  <p className={styles.senal}>
                    <strong>{SENAL_LABEL[s.tipo]}</strong>
                    <Badge tone={s.fuerza === 'fuerte' ? 'info' : 'neutral'}>{s.fuerza}</Badge>
                    <span className={styles.muted}>{ORIGEN_LABEL[s.origen]}</span>
                  </p>
                  <p>{s.detalle}</p>
                  {s.pulses && s.pulses.length > 0 && (
                    <ul className={styles.pulses}>
                      {s.pulses.map((pulse) => (
                        <li key={pulse.id}>
                          {/* El nombre es texto libre de terceros: se muestra como texto, nunca como HTML. */}
                          <a
                            href={`https://otx.alienvault.com/pulse/${encodeURIComponent(pulse.id)}`}
                            target="_blank"
                            rel="noopener noreferrer nofollow"
                          >
                            {pulse.nombre || pulse.id}
                          </a>
                          {pulse.indicadores !== null && <span className={styles.muted}> · {pulse.indicadores} IoC</span>}
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </article>
        ))
      )}
      <p className={styles.muted}>{REGLA_SENALES}</p>
    </div>
  )
}

function Cobertura({ correlacion }: { correlacion: CorrelacionLote }) {
  if (correlacion.cadena_ataque.length === 0) {
    return (
      <EmptyState icon={<Crosshair />} title="Sin técnicas que mostrar">
        <p>Ningún indicador del lote tiene entidad atribuida, así que no hay técnicas documentadas.</p>
      </EmptyState>
    )
  }
  return (
    <div className={styles.stack}>
      <Alert tone="info" title="Técnicas documentadas, no comportamiento observado">
        Son las que MITRE ATT&amp;CK documenta para las entidades del lote. Que dos entidades compartan una técnica no
        prueba relación entre sus indicadores. Las de borde punteado están documentadas para varias entidades.
      </Alert>
      {correlacion.agrupaciones.length > 0 && (
        <p className={styles.muted}>
          {correlacion.agrupaciones.map((a) => `${a.id}: ${a.tecnicas_comunes.length} técnica(s) común(es)`).join(' · ')}
        </p>
      )}
      {correlacion.cadena_ataque.map((grupo) => (
        <section key={grupo.tactica} aria-label={grupo.tactica}>
          <h3 className={styles.subtitle}>
            {grupo.tactica} <Badge>{grupo.tecnicas.length}</Badge>
          </h3>
          <ul className={styles.tecnicas}>
            {grupo.tecnicas.map((t) => (
              <li
                key={t.id}
                className={t.varias_entidades ? styles.varias : undefined}
                title={`Documentada para ${t.entidades.join(', ')}`}
              >
                <a className="mono" href={techniqueUrl(t.id)} target="_blank" rel="noopener noreferrer">
                  {t.id}
                </a>
                <span>{t.nombre}</span>
                <span className={styles.ref}>{t.indicadores.join(' ')}</span>
              </li>
            ))}
          </ul>
        </section>
      ))}
    </div>
  )
}

interface BatchResultsProps {
  detalle: BatchDetail
  /** La versión elegida del informe; null = todavía no hay informe conjunto. */
  informe: BatchReportRead | null
  tab: BatchTab
  onTab: (tab: BatchTab) => void
  onSelectInforme: (reportId: number) => void
  validando: boolean
  onValidate: (reportId: number, request: ValidationRequest) => Promise<boolean>
}

export function BatchResults({ detalle, informe, tab, onTab, onSelectInforme, validando, onValidate }: BatchResultsProps) {
  const versionId = useId()
  // Con informe, todo se muestra tal como quedó congelado en esa versión (lo que se valida);
  // sin informe, la correlación calculada al vuelo.
  const correlacion = informe?.metadatos?.correlacion ?? detalle.correlacion
  const historial = informe
    ? detalle.validaciones.filter((v) => v.batch_report_id === informe.id).toReversed()
    : []
  const vigente = historial[0]?.decision
  const decision = vigente === 'aceptado' || vigente === 'rechazado' ? vigente : 'pendiente'

  const sinInforme = (
    <EmptyState icon={<FileText />} title="Sin informe conjunto todavía">
      <p>
        Genera el informe conjunto desde la cabecera del lote: congela la correlación, redacta el análisis con una sola
        llamada al modelo y queda listo para validar.
      </p>
    </EmptyState>
  )

  const tabs: TabItem<BatchTab>[] = [
    { id: 'resumen', label: 'Resumen', icon: <LayoutList aria-hidden="true" />, content: <Resumen correlacion={correlacion} /> },
    {
      id: 'vinculos',
      label: 'Vínculos',
      icon: <Link2 aria-hidden="true" />,
      count: correlacion.vinculos.length,
      content: <Vinculos correlacion={correlacion} />,
    },
    { id: 'cobertura', label: 'Cobertura ATT&CK', icon: <Crosshair aria-hidden="true" />, content: <Cobertura correlacion={correlacion} /> },
    {
      id: 'ia',
      label: 'Análisis IA',
      icon: <Sparkles aria-hidden="true" />,
      content: informe?.metadatos ? <AnalisisIAView key={informe.id} ia={informe.metadatos.ia} /> : sinInforme,
    },
    {
      id: 'informe',
      label: 'Informe y validación',
      icon: <ClipboardCheck aria-hidden="true" />,
      count: detalle.informes.length || undefined,
      content: informe ? (
        <div className={styles.stack}>
          <div className={styles.toolbar}>
            <span className={styles.badgesWrap}>
              <Badge tone={informe.conclusion === 'relacion_demostrable' ? 'info' : 'neutral'}>
                {CONCLUSION_LABEL[informe.conclusion]}
              </Badge>
              <Badge tone={STATUS_TONE[decision]}>{STATUS_LABEL[decision]}</Badge>
            </span>
            <MarkdownActions contenido={informe.contenido} archivo={`nexo-informe-lote-${detalle.batch.id}-${informe.id}.md`} />
          </div>
          <MarkdownReport contenido={informe.contenido} />
          <DecisionPanel
            key={informe.id}
            titulo={`Informe conjunto #${informe.id}`}
            resumen={
              <>
                Conclusión propuesta: <strong>{CONCLUSION_LABEL[informe.conclusion]}</strong>
                {correlacion.agrupaciones.length > 0 &&
                  ` · ${correlacion.agrupaciones.map((a) => `${a.id}: ${a.indicadores.join(', ')}`).join('; ')}`}
              </>
            }
            objeto="el informe conjunto"
            opciones={INFORME_CONJUNTO}
            historial={historial}
            ocupado={validando}
            onValidate={(request) => onValidate(informe.id, request)}
          />
        </div>
      ) : (
        sinInforme
      ),
    },
  ]

  return (
    <Panel
      title="Resultados del lote"
      icon={<Link2 aria-hidden="true" />}
      actions={
        detalle.informes.length > 1 && informe ? (
          <label className={styles.version} htmlFor={versionId}>
            <span>Versión</span>
            <select id={versionId} value={informe.id} onChange={(e) => onSelectInforme(Number(e.target.value))}>
              {detalle.informes.toReversed().map((r) => (
                <option key={r.id} value={r.id}>
                  Informe conjunto #{r.id} · {formatDateTime(r.timestamp)}
                </option>
              ))}
            </select>
          </label>
        ) : informe ? (
          <span className={styles.muted}>
            Informe conjunto #{informe.id} · {formatDateTime(informe.timestamp)}
          </span>
        ) : (
          <Badge>Vista previa</Badge>
        )
      }
    >
      {!informe && (
        <p className={`${styles.muted} ${styles.previa}`}>
          Calculado al vuelo por NEXO con reglas fijas: genera el informe conjunto para congelarlo, redactar el análisis
          y validarlo.
        </p>
      )}
      <Tabs label="Resultados del lote" items={tabs} value={tab} onChange={onTab} />
    </Panel>
  )
}
