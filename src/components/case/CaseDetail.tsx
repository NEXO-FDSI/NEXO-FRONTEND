import { Crosshair, FileText, LayoutList, ShieldQuestion, Sparkles, Trash2, Zap } from 'lucide-react'
import { useState } from 'react'
import { describeFailure } from '../../domain/failures'
import { formatDateTime, indicatorTypeLabel, truncateMiddle } from '../../domain/format'
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
import { ESTADO_FUENTE_LABEL, sourceCoverage } from '../../domain/severity'
import { navigate, rutas } from '../../hooks/useRoute'
import { useInvestigations } from '../../state/InvestigationsContext'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { STATUS_TONE } from '../tones'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { ConfirmDialog } from '../ui/ConfirmDialog'
import { CopyButton } from '../ui/CopyButton'
import { Panel } from '../ui/Panel'
import { Tabs, type TabItem } from '../ui/Tabs'
import { AiAnalysisPanel } from './AiAnalysisPanel'
import { AttackPanel } from './AttackPanel'
import { IntelPanel } from './IntelPanel'
import { PipelineStepper } from './PipelineStepper'
import { ReportPanel } from './ReportPanel'
import { SeverityBadge, SourceChips } from './Signals'
import { SummaryPanel } from './SummaryPanel'
import { ValidationPanel } from './ValidationPanel'
import styles from './CaseDetail.module.css'

type TabId = 'resumen' | 'inteligencia' | 'attack' | 'ia' | 'informe'

/**
 * Un caso nuevo o con informe abre en el resumen (ahí se ve avanzar el análisis automático);
 * uno a medias, en la pestaña del paso más avanzado que ya tiene resultado.
 */
function initialTab(inv: Investigation): TabId {
  if (inv.reports.length > 0) return 'resumen'
  if (inv.correlation) return 'attack'
  if (inv.enrichment) return 'inteligencia'
  return 'resumen'
}

const AUTOMATIC_TAB: Record<AutomaticStep, TabId> = {
  enrich: 'inteligencia',
  correlate: 'attack',
  report: 'informe',
}

export function CaseDetail({ inv }: { inv: Investigation }) {
  const { activityOf, runStep, runAutomatic, validate, deleteIndicator, dismissFailure } = useInvestigations()
  const [confirmingDelete, setConfirmingDelete] = useState(false)
  const [deleteError, setDeleteError] = useState<string | null>(null)
  const [deleting, setDeleting] = useState(false)
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
  const fuentes = inv.enrichment?.fuentes ?? []
  const cobertura = sourceCoverage(fuentes)
  const metadatos = report?.metadatos

  function run(step: AutomaticStep) {
    if (step === 'report') setChosenReportId(null) // mostrar el informe nuevo
    setTab(AUTOMATIC_TAB[step])
    void runStep(id, step)
  }

  async function analyze() {
    if (await runAutomatic(inv)) setTab('resumen')
  }

  function closeDialog() {
    setConfirmingDelete(false)
    setDeleteError(null)
  }

  async function confirmDelete() {
    setDeleting(true)
    setDeleteError(null)
    const result = await deleteIndicator(id)
    if (result.ok) {
      navigate(rutas.investigaciones)
      return
    }
    // El diálogo sigue abierto con el error: se puede reintentar o cancelar.
    setDeleting(false)
    setDeleteError(result.error.message)
  }

  const panelProps = { inv, activity, onRun: run }
  const tabs: TabItem<TabId>[] = [
    {
      id: 'resumen',
      label: 'Resumen',
      icon: <LayoutList aria-hidden="true" />,
      content: <SummaryPanel inv={inv} onOpenAnalysis={() => setTab('ia')} />,
    },
    {
      id: 'inteligencia',
      label: 'Inteligencia',
      icon: <ShieldQuestion aria-hidden="true" />,
      count: inv.enrichment ? fuentes.filter((f) => f.estado === 'con_evidencia').length || undefined : undefined,
      content: <IntelPanel {...panelProps} />,
    },
    {
      id: 'attack',
      label: 'MITRE ATT&CK',
      icon: <Crosshair aria-hidden="true" />,
      count: inv.correlation?.tecnicas.length,
      content: <AttackPanel {...panelProps} destacadas={metadatos?.ia.analisis?.tecnicas_destacadas ?? []} />,
    },
    {
      id: 'ia',
      label: 'Análisis IA',
      icon: <Sparkles aria-hidden="true" />,
      count: metadatos?.ia.analisis?.hallazgos.length,
      content: <AiAnalysisPanel {...panelProps} report={report} />,
    },
    {
      id: 'informe',
      label: 'Informe y validación',
      icon: <FileText aria-hidden="true" />,
      count: inv.reports.length || undefined,
      content: (
        <div className={styles.stack}>
          <ReportPanel {...panelProps} report={report} onSelectReport={setChosenReportId} />
          <ValidationPanel
            inv={inv}
            activity={activity}
            report={report}
            onValidate={(reportId, request) => validate(id, reportId, request)}
          />
        </div>
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
              <SeverityBadge nivel={metadatos?.severidad.nivel ?? null} />
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
            {fuentes.length > 0 && <SourceChips fuentes={fuentes} />}
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
            <Button
              variant="danger"
              size="sm"
              icon={<Trash2 size={14} aria-hidden="true" />}
              disabled={busy}
              onClick={() => setConfirmingDelete(true)}
            >
              Eliminar
            </Button>
          </div>
        </div>

        {(inv.missing || failureText || cobertura.fallidas.length > 0) && (
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
            {cobertura.fallidas.length > 0 && (
              <Alert
                tone="info"
                title={`Enriquecido con ${cobertura.conDatos} de ${cobertura.consultadas} fuentes`}
                actions={
                  <Button size="sm" onClick={() => run('enrich')} disabled={busy || inv.missing}>
                    Reintentar fuentes
                  </Button>
                }
              >
                Sin datos de{' '}
                {cobertura.fallidas.map((f) => `${f.etiqueta} (${ESTADO_FUENTE_LABEL[f.estado]})`).join(', ')}. El
                resultado puede estar incompleto; "no respondió" no equivale a "sin evidencia".
              </Alert>
            )}
          </div>
        )}

        <div className={styles.stepper}>
          <PipelineStepper inv={inv} activity={activity} onRun={run} onValidate={() => setTab('informe')} />
        </div>
      </Panel>

      <Panel>
        <Tabs label="Resultados del pipeline" items={tabs} value={tab} onChange={setTab} />
      </Panel>

      <ConfirmDialog
        open={confirmingDelete}
        title="¿Eliminar este indicador?"
        confirmLabel="Eliminar definitivamente"
        busy={deleting}
        onConfirm={confirmDelete}
        onCancel={closeDialog}
      >
        <p>
          <span className={`${styles.dialogValue} mono`}>{truncateMiddle(valor, 52)}</span> se eliminará del backend
          junto con todo lo que depende de él:
        </p>
        <ul className={styles.consequences}>
          <li>
            {inv.reports.length} versión(es) del informe, con su análisis de IA y su trazabilidad
          </li>
          <li>
            {inv.validations.length} decisión(es) de analistas: <strong>se pierde ese historial de auditoría</strong>
          </li>
          <li>La caché de las fuentes de inteligencia consultadas (OTX, ThreatFox, VirusTotal)</li>
          {inv.correlation?.entity && (
            <li>
              El vínculo con <strong>{inv.correlation.entity.nombre}</strong>; la entidad solo se borra si ningún otro
              indicador la usa
            </li>
          )}
        </ul>
        <p className={styles.irreversible}>Esta acción no se puede deshacer.</p>
        {deleteError && (
          <Alert tone="danger" title="No se pudo eliminar el indicador">
            {deleteError}
          </Alert>
        )}
      </ConfirmDialog>
    </div>
  )
}
