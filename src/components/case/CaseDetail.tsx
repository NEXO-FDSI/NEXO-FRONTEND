import { ClipboardCheck, Crosshair, FileText, ShieldQuestion, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { describeFailure } from '../../domain/failures'
import { formatDateTime, indicatorTypeLabel } from '../../domain/format'
import {
  AUTOMATIC_STEPS,
  investigationStatus,
  isAutomaticStep,
  isStepDone,
  latestReport,
  STATUS_LABEL,
  type AutomaticStep,
  type Investigation,
} from '../../domain/investigation'
import { useInvestigations } from '../../state/InvestigationsContext'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { STATUS_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { CopyButton } from '../ui/CopyButton'
import { Panel } from '../ui/Panel'
import { Tabs, type TabItem } from '../ui/Tabs'
import { AttackPanel } from './AttackPanel'
import { EnrichmentPanel } from './EnrichmentPanel'
import { EvidenceChain } from './EvidenceChain'
import { PipelineStepper } from './PipelineStepper'
import { ReportPanel } from './ReportPanel'
import { ValidationPanel } from './ValidationPanel'
import styles from './CaseDetail.module.css'

type TabId = 'enrichment' | 'attack' | 'report' | 'validation'

/** Abre la pestaña del paso más avanzado que ya tiene resultado. */
function initialTab(inv: Investigation): TabId {
  if (inv.reports.length > 0) return 'report'
  if (inv.correlation) return 'attack'
  return 'enrichment'
}

const AUTOMATIC_TAB: Record<AutomaticStep, TabId> = {
  enrich: 'enrichment',
  correlate: 'attack',
  report: 'report',
}

export function CaseDetail({ inv }: { inv: Investigation }) {
  const { activityOf, runStep, runAutomatic, validate, remove, dismissFailure } = useInvestigations()
  const [tab, setTab] = useState<TabId>(() => initialTab(inv))
  const [chosenReportId, setChosenReportId] = useState<number | null>(null)

  const { id, tipo, valor, fuente, timestamp_ingesta } = inv.indicator
  const activity = activityOf(id)
  const busy = activity.running !== null
  const status = investigationStatus(inv)
  const pending = AUTOMATIC_STEPS.some((step) => !isStepDone(inv, step))
  const report = inv.reports.find((r) => r.id === chosenReportId) ?? latestReport(inv)
  const failure = activity.failure
  const failureText = failure && describeFailure(failure.step, failure.error)
  const retryStep = failure && isAutomaticStep(failure.step) && !inv.missing ? failure.step : null

  function run(step: AutomaticStep) {
    if (step === 'report') setChosenReportId(null) // mostrar el informe nuevo
    setTab(AUTOMATIC_TAB[step])
    void runStep(id, step)
  }

  async function analyze() {
    if (await runAutomatic(inv)) setTab('report')
  }

  function onRemove() {
    const ok = window.confirm(
      '¿Quitar esta investigación del historial de este navegador? El indicador sigue registrado en el backend.',
    )
    if (ok) remove(id)
  }

  const panelProps = { inv, activity, onRun: run }
  const tabs: TabItem<TabId>[] = [
    {
      id: 'enrichment',
      label: 'Enriquecimiento',
      icon: <ShieldQuestion aria-hidden="true" />,
      count: inv.enrichment?.resumen.pulseCount,
      content: <EnrichmentPanel {...panelProps} />,
    },
    {
      id: 'attack',
      label: 'MITRE ATT&CK',
      icon: <Crosshair aria-hidden="true" />,
      count: inv.correlation?.tecnicas.length,
      content: <AttackPanel {...panelProps} />,
    },
    {
      id: 'report',
      label: 'Informe',
      icon: <FileText aria-hidden="true" />,
      count: inv.reports.length || undefined,
      content: <ReportPanel {...panelProps} report={report} onSelectReport={setChosenReportId} />,
    },
    {
      id: 'validation',
      label: 'Validación',
      icon: <ClipboardCheck aria-hidden="true" />,
      content: (
        <ValidationPanel
          inv={inv}
          activity={activity}
          report={report}
          onValidate={(reportId, request) => validate(id, reportId, request)}
        />
      ),
    },
  ]

  return (
    <div className={styles.detail}>
      <Panel>
        <div className={styles.header}>
          <div className={styles.identity}>
            <div className={styles.badges}>
              <Badge tone="info" icon={<IndicatorTypeIcon tipo={tipo} size={13} />}>
                {indicatorTypeLabel(tipo)}
              </Badge>
              <Badge tone={STATUS_TONE[status]}>{STATUS_LABEL[status]}</Badge>
            </div>
            <div className={styles.valueRow}>
              <h1 className={`${styles.value} mono`}>{valor}</h1>
              <CopyButton text={valor} label="Copiar valor del indicador" />
            </div>
            <dl className={styles.meta}>
              <div>
                <dt>ID</dt>
                <dd className="mono">#{id}</dd>
              </div>
              <div>
                <dt>Fuente</dt>
                <dd>{fuente || '—'}</dd>
              </div>
              <div>
                <dt>Registrado</dt>
                <dd>{formatDateTime(timestamp_ingesta)}</dd>
              </div>
              {inv.entrada !== valor && (
                <div>
                  <dt>Entrada original</dt>
                  <dd className="mono">{inv.entrada}</dd>
                </div>
              )}
            </dl>
          </div>
          <div className={styles.actions}>
            <Button
              variant="primary"
              icon={<Zap size={16} aria-hidden="true" />}
              loading={busy}
              disabled={!pending || inv.missing}
              onClick={analyze}
            >
              {busy ? 'Analizando…' : 'Análisis completo'}
            </Button>
            <Button variant="danger" size="sm" icon={<Trash2 size={14} aria-hidden="true" />} onClick={onRemove}>
              Quitar del historial
            </Button>
          </div>
        </div>

        {(inv.missing || failureText) && (
          <div className={styles.notices}>
            {inv.missing && (
              <Alert tone="warning" title="Este indicador ya no existe en el backend">
                La base de datos pudo reiniciarse. Quítalo del historial y regístralo de nuevo para analizarlo.
              </Alert>
            )}
            {failureText && (
              <Alert
                tone="danger"
                title={failureText.title}
                onDismiss={() => dismissFailure(id)}
                actions={
                  retryStep && (
                    <Button size="sm" onClick={() => run(retryStep)} disabled={busy}>
                      Reintentar
                    </Button>
                  )
                }
              >
                {failureText.hint}
              </Alert>
            )}
          </div>
        )}

        <div className={styles.stepper}>
          <PipelineStepper inv={inv} activity={activity} onRun={run} onValidate={() => setTab('validation')} />
        </div>
      </Panel>

      <EvidenceChain inv={inv} />

      <Panel>
        <Tabs label="Resultados del pipeline" items={tabs} value={tab} onChange={setTab} />
      </Panel>
    </div>
  )
}
