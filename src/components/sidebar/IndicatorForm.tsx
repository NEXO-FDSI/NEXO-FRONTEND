import { Plus, ScanSearch } from 'lucide-react'
import { useId, useState, type FormEvent, type ReactNode } from 'react'
import type { IndicatorTipo } from '../../api/types'
import { describeFailure } from '../../domain/failures'
import { detectType, INDICATOR_TYPES } from '../../domain/format'
import { findByInput } from '../../domain/investigation'
import { navigate, rutas } from '../../hooks/useRoute'
import { useInvestigations } from '../../state/InvestigationsContext'
import { Alert } from '../ui/Alert'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import styles from './IndicatorForm.module.css'

// Indicadores reales de los escenarios oficiales del backend (data/test_dataset).
const EXAMPLES: readonly { label: string; tipo: IndicatorTipo; valor: string }[] = [
  { label: 'WannaCry', tipo: 'hash', valor: '24d004a104d4d54034dbcffc2a4b19a11f39008a575aa614ea04703480b1022c' },
  { label: 'SUNBURST', tipo: 'domain', valor: 'ervsystem.com' },
  { label: 'IP benigna', tipo: 'ip', valor: '8.8.8.8' },
]

interface Feedback {
  tone: 'success' | 'info' | 'danger'
  title: string
  text?: ReactNode
}

export function IndicatorForm() {
  const { register, items, locate } = useInvestigations()
  const [tipo, setTipo] = useState<IndicatorTipo>('ip')
  const [valor, setValor] = useState('')
  const [fuente, setFuente] = useState('')
  const [autoRun, setAutoRun] = useState(true)
  const [submitting, setSubmitting] = useState(false)
  const [feedback, setFeedback] = useState<Feedback | null>(null)
  const ids = { valor: useId(), fuente: useId(), hint: useId(), feedback: useId() }
  const placeholder = INDICATOR_TYPES.find((t) => t.tipo === tipo)?.placeholder

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    const entrada = valor.trim()
    if (!entrada) {
      setFeedback({ tone: 'danger', title: 'Escribe el valor del indicador.' })
      return
    }
    setSubmitting(true)
    setFeedback(null)
    const result = await register({ tipo, valor: entrada, fuente: fuente.trim() || null }, { autoRun })
    setSubmitting(false)

    if (result.ok) {
      navigate(rutas.investigacion(result.indicator.id))
      return
    }

    if (result.error.status === 409) {
      // Primero el historial local (sin red); si no está, se busca por valor en el backend:
      // la página del caso lo reconstruye con GET /indicators/{id}.
      const existingId = findByInput(items, tipo, entrada)?.indicator.id ?? (await locate(tipo, entrada))
      if (existingId !== null) {
        navigate(rutas.investigacion(existingId))
      } else {
        setFeedback({
          tone: 'danger',
          title: 'El indicador ya existe en el backend.',
          text: 'No se pudo recuperar su investigación: la búsqueda por valor en el backend no respondió.',
        })
      }
      return
    }

    const { title, hint } = describeFailure('ingest', result.error)
    setFeedback({ tone: 'danger', title, text: hint })
  }

  function applyExample(example: (typeof EXAMPLES)[number]) {
    setTipo(example.tipo)
    setValor(example.valor)
    setFuente('Escenario oficial de prueba')
    setFeedback(null)
  }

  return (
    <Panel title="Analizar indicador" icon={<ScanSearch aria-hidden="true" />}>
      <form className={styles.form} onSubmit={onSubmit} noValidate>
        <fieldset className={styles.types}>
          <legend className={styles.label}>Tipo</legend>
          {INDICATOR_TYPES.map((type) => (
            <label key={type.tipo} className={styles.type}>
              <input
                type="radio"
                name="tipo"
                value={type.tipo}
                checked={tipo === type.tipo}
                onChange={() => setTipo(type.tipo)}
              />
              <span>{type.label}</span>
            </label>
          ))}
        </fieldset>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.valor}>
            Valor
          </label>
          <input
            id={ids.valor}
            className={`${styles.input} mono`}
            value={valor}
            onChange={(e) => {
              setValor(e.target.value)
              // Preselecciona el tipo al pegar o escribir; el analista puede cambiarlo.
              const detected = detectType(e.target.value)
              if (detected) setTipo(detected)
            }}
            placeholder={placeholder}
            autoComplete="off"
            spellCheck={false}
            maxLength={2048}
            required
            aria-invalid={feedback?.tone === 'danger' || undefined}
            aria-describedby={feedback ? `${ids.hint} ${ids.feedback}` : ids.hint}
          />
          <p id={ids.hint} className={styles.hint}>
            El tipo se detecta al pegar el valor. Se aceptan valores defanged (<code>hxxp://</code>,{' '}
            <code>[.]</code>): el backend los normaliza.
          </p>
        </div>

        <div className={styles.field}>
          <label className={styles.label} htmlFor={ids.fuente}>
            Fuente <span className={styles.optional}>(opcional)</span>
          </label>
          <input
            id={ids.fuente}
            className={styles.input}
            value={fuente}
            onChange={(e) => setFuente(e.target.value)}
            placeholder="p. ej. reporte interno SOC"
            autoComplete="off"
            maxLength={200}
          />
        </div>

        <label className={styles.check}>
          <input type="checkbox" checked={autoRun} onChange={(e) => setAutoRun(e.target.checked)} />
          Analizar automáticamente (enriquecer, correlacionar e informar)
        </label>

        <Button type="submit" variant="primary" loading={submitting} icon={<Plus size={16} aria-hidden="true" />}>
          Registrar indicador
        </Button>

        {feedback && (
          <div id={ids.feedback}>
            <Alert tone={feedback.tone} title={feedback.title} onDismiss={() => setFeedback(null)}>
              {feedback.text}
            </Alert>
          </div>
        )}

        <div className={styles.examples}>
          <span className={styles.hint}>Ejemplos:</span>
          {EXAMPLES.map((example) => (
            <button key={example.label} type="button" className={styles.example} onClick={() => applyExample(example)}>
              {example.label}
            </button>
          ))}
        </div>
      </form>
    </Panel>
  )
}
