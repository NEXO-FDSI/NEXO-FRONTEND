import { Download, FileText } from 'lucide-react'
import { useId } from 'react'
import Markdown, { type Components } from 'react-markdown'
import remarkGfm from 'remark-gfm'
import type { ReportRead } from '../../api/types'
import { confidenceLevel } from '../../domain/confidence'
import { formatDateTime, formatPercent } from '../../domain/format'
import { currentDecision, STATUS_LABEL } from '../../domain/investigation'
import { useElapsedSeconds } from '../../hooks/useElapsedSeconds'
import { CONFIDENCE_TONE, STATUS_TONE } from '../tones'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CopyButton } from '../ui/CopyButton'
import { Spinner } from '../ui/Spinner'
import { StepPrompt } from './StepPrompt'
import type { CasePanelProps } from './types'
import styles from './ReportPanel.module.css'

// El contenido mezcla texto del LLM y de pulses de terceros: react-markdown no
// interpreta HTML crudo y sanea las URLs; los enlaces además salen en pestaña aislada.
const MARKDOWN_COMPONENTS: Components = {
  a: ({ node: _node, ...props }) => <a {...props} target="_blank" rel="noopener noreferrer" />,
  table: ({ node: _node, ...props }) => (
    <div className={styles.tableWrap}>
      <table {...props} />
    </div>
  ),
}

function downloadMarkdown(report: ReportRead) {
  const url = URL.createObjectURL(new Blob([report.contenido], { type: 'text/markdown;charset=utf-8' }))
  const link = document.createElement('a')
  link.href = url
  link.download = `nexo-informe-${report.id}.md`
  link.click()
  URL.revokeObjectURL(url)
}

function ReportProgress({ seconds }: { seconds: number }) {
  return (
    <div className={styles.progress} role="status">
      <Spinner size={18} />
      <div>
        <p className={styles.progressTitle}>Generando informe… {seconds} s</p>
        <p className={styles.progressText}>
          El análisis narrativo (LLM + RAG) puede tardar hasta ~60 s. Si el modelo no responde, el
          informe se genera igual sin ese apartado.
        </p>
      </div>
    </div>
  )
}

interface ReportPanelProps extends CasePanelProps {
  report: ReportRead | null
  onSelectReport: (reportId: number) => void
}

export function ReportPanel({ inv, activity, onRun, report, onSelectReport }: ReportPanelProps) {
  const running = activity.running === 'report'
  const seconds = useElapsedSeconds(running)
  const versionId = useId()

  if (!report) {
    return running ? (
      <ReportProgress seconds={seconds} />
    ) : (
      <StepPrompt step="report" inv={inv} activity={activity} onRun={onRun} icon={<FileText />} title="Sin informe todavía">
        <p>
          Redacta el informe auditable: enriquecimiento, entidad, técnicas ATT&amp;CK y un análisis
          narrativo basado solo en el texto oficial de esas técnicas.
        </p>
      </StepPrompt>
    )
  }

  const decision = currentDecision(inv, report.id)
  return (
    <div className={styles.panel}>
      {running && <ReportProgress seconds={seconds} />}

      <div className={styles.toolbar}>
        <div className={styles.meta}>
          {inv.reports.length > 1 ? (
            <label className={styles.version} htmlFor={versionId}>
              <span>Versión</span>
              <select id={versionId} value={report.id} onChange={(e) => onSelectReport(Number(e.target.value))}>
                {inv.reports.toReversed().map((r) => (
                  <option key={r.id} value={r.id}>
                    Informe #{r.id} · {formatDateTime(r.timestamp)}
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <span className={styles.title}>
              Informe #{report.id} · {formatDateTime(report.timestamp)}
            </span>
          )}
          <Badge tone={CONFIDENCE_TONE[confidenceLevel(report.nivel_confianza)]}>
            Confianza {formatPercent(report.nivel_confianza)}
          </Badge>
          <Badge tone={STATUS_TONE[decision ?? 'pendiente']}>{STATUS_LABEL[decision ?? 'pendiente']}</Badge>
        </div>
        <div className={styles.actions}>
          <CopyButton text={report.contenido} label="Copiar informe en Markdown" />
          <Button size="sm" icon={<Download size={14} aria-hidden="true" />} onClick={() => downloadMarkdown(report)}>
            Descargar .md
          </Button>
        </div>
      </div>

      <p className={styles.note}>
        El apartado “Estado de validación” del informe refleja el momento de su generación; el estado
        vigente es el de la pestaña Validación.
      </p>

      <article className={styles.markdown}>
        <Markdown remarkPlugins={[remarkGfm]} components={MARKDOWN_COMPONENTS}>
          {report.contenido}
        </Markdown>
      </article>
    </div>
  )
}
