import { Sparkles } from 'lucide-react'
import { useState } from 'react'
import type { RegistroIA, ReportRead } from '../../api/types'
import { HALLAZGO_LABEL } from '../../domain/severity'
import { Alert } from '../ui/Alert'
import { EmptyState } from '../ui/EmptyState'
import { StepPrompt } from './StepPrompt'
import type { CasePanelProps } from './types'
import styles from './AiAnalysisPanel.module.css'

const SIN_ANALISIS: Record<Exclude<RegistroIA['estado'], 'generado'>, string> = {
  no_llamado: 'No se consultó al modelo',
  fallido: 'El modelo no respondió',
  descartado: 'Se descartó todo lo que redactó el modelo',
}

function NoAnalysis({ ia }: { ia: RegistroIA }) {
  const estado = ia.estado === 'generado' ? 'descartado' : ia.estado
  return (
    <EmptyState icon={<Sparkles />} title={SIN_ANALISIS[estado]}>
      {ia.motivo && <p>Motivo: {ia.motivo}.</p>}
      {ia.intentos_fallidos.length > 0 && (
        <ul className={styles.plain}>
          {ia.intentos_fallidos.map((i) => (
            <li key={i.proveedor}>
              <strong>{i.proveedor}</strong> ({i.modelo}): {i.error}
            </li>
          ))}
        </ul>
      )}
      {ia.descartes.length > 0 && (
        <ul className={styles.plain}>
          {ia.descartes.map((d, n) => (
            <li key={n}>
              «{d.texto}» — {d.motivo}
            </li>
          ))}
        </ul>
      )}
      <p>El resto del informe (entidad, técnicas, severidad) no depende del modelo y sigue siendo válido.</p>
    </EmptyState>
  )
}

function List({ title, items }: { title: string; items: string[] }) {
  if (items.length === 0) return null
  return (
    <>
      <h4 className={styles.heading}>{title}</h4>
      <ul className={styles.list}>
        {items.map((item) => (
          <li key={item}>{item}</li>
        ))}
      </ul>
    </>
  )
}

interface CiteProps {
  id: string
  activo: string | null
  onToggle: (id: string) => void
}

/** Botón de cita. De nivel superior a propósito: definido dentro del panel, React lo
 * remontaría en cada render y el foco del teclado se perdería al activarlo. */
function Cite({ id, activo, onToggle }: CiteProps) {
  return (
    <button
      type="button"
      className={styles.cite}
      aria-pressed={activo === id}
      aria-label={`Ver la fuente ${id} en el contexto`}
      onClick={() => onToggle(id)}
    >
      {id}
    </button>
  )
}

interface AiAnalysisPanelProps extends CasePanelProps {
  report: ReportRead | null
}

export function AiAnalysisPanel({ report, ...props }: AiAnalysisPanelProps) {
  const [activo, setActivo] = useState<string | null>(null)

  if (!report) {
    return (
      <StepPrompt {...props} step="report" icon={<Sparkles />} title="Sin análisis todavía">
        <p>
          El análisis de IA se genera con el informe: el modelo redacta sobre la evidencia de las fuentes y el texto
          oficial de ATT&amp;CK, y cada afirmación debe citar de dónde sale.
        </p>
      </StepPrompt>
    )
  }

  const ia = report.metadatos?.ia
  if (!ia) {
    return (
      <Alert tone="info" title="Informe anterior a la trazabilidad de IA">
        Este informe se generó antes de que NEXO registrara qué se envía al modelo. Regenera el informe para ver el
        análisis estructurado con sus citas.
      </Alert>
    )
  }
  if (ia.estado !== 'generado' || !ia.analisis) return <NoAnalysis ia={ia} />

  const { analisis } = ia
  const citar = (id: string) => setActivo((actual) => (actual === id ? null : id))

  return (
    <div className={styles.panel}>
      <div className={styles.layout}>
        <section className={styles.conclusion} aria-label="Conclusión de la IA">
          <p className={styles.kicker}>
            <Sparkles size={14} aria-hidden="true" /> Redactado por IA sobre el contexto citado
          </p>
          {analisis.resumen && <p className={styles.summary}>{analisis.resumen}</p>}

          {analisis.hallazgos.length > 0 && (
            <>
              <h4 className={styles.heading}>Hallazgos</h4>
              <ul className={styles.findings}>
                {analisis.hallazgos.map((h) => (
                  <li key={h.afirmacion} className={`${styles.finding} ${styles[h.tipo]}`}>
                    <span className={styles.kind}>{HALLAZGO_LABEL[h.tipo]}</span>
                    <p>{h.afirmacion}</p>
                    {h.fuentes.length > 0 && (
                      <span className={styles.cites}>
                        {h.fuentes.map((id) => (
                          <Cite key={id} id={id} activo={activo} onToggle={citar} />
                        ))}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
            </>
          )}

          {analisis.tecnicas_destacadas.length > 0 && (
            <>
              <h4 className={styles.heading}>Técnicas destacadas</h4>
              <ul className={styles.list}>
                {analisis.tecnicas_destacadas.map((t) => (
                  <li key={t.id}>
                    <Cite id={t.id} activo={activo} onToggle={citar} /> {t.motivo}
                  </li>
                ))}
              </ul>
            </>
          )}
          <List title="Investigación recomendada" items={analisis.investigacion_recomendada} />
          <List title="Limitaciones" items={analisis.limitaciones} />
          <List title="Información faltante" items={analisis.informacion_faltante} />
        </section>

        <section className={styles.context} aria-label="Contexto enviado al modelo">
          <h4 className={styles.heading}>Contexto enviado al modelo</h4>
          <p className={styles.hint}>Es todo lo que el modelo pudo leer. Elige una cita para ver de dónde sale.</p>
          <ol className={styles.blocks}>
            {ia.contexto.map((b) => (
              <li
                key={b.id}
                className={`${styles.block} ${b.id.startsWith('E-') ? styles.evidence : styles.technique}`}
                aria-current={activo === b.id ? 'true' : undefined}
              >
                <span className={`${styles.blockId} mono`}>{b.id}</span>
                <strong>{b.titulo}</strong>
                <p>{b.texto}</p>
              </li>
            ))}
          </ol>
          {ia.prompt && (
            <details className={styles.prompt}>
              <summary>Ver el prompt exacto</summary>
              <pre>{ia.prompt}</pre>
            </details>
          )}
        </section>
      </div>

      <footer className={styles.meta}>
        <span>
          <strong>{ia.proveedor}</strong> · <span className="mono">{ia.modelo}</span>
        </span>
        <span className="mono">{ia.latencia_ms} ms</span>
        {ia.tokens && (
          <span className="mono">
            {ia.tokens.prompt ?? '?'} + {ia.tokens.respuesta ?? '?'} tokens
          </span>
        )}
        {ia.intentos_fallidos.length > 0 && (
          <span className={styles.fallback}>
            Respaldo: {ia.intentos_fallidos.map((i) => i.proveedor).join(', ')} no respondió
          </span>
        )}
        <span>
          {ia.descartes.length === 0
            ? '0 afirmaciones descartadas'
            : `${ia.descartes.length} afirmación(es) descartada(s) por citar fuera del contexto`}
        </span>
      </footer>
      <p className={styles.disclaimer}>
        Las citas garantizan de dónde sale cada afirmación, no que sea correcta. Verifícala antes de aceptar el informe.
      </p>
    </div>
  )
}
