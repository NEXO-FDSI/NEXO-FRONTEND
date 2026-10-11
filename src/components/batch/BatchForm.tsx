import { Layers } from 'lucide-react'
import { useId, useState, type FormEvent } from 'react'
import type { ErrorInfo } from '../../api/http'
import { MAX_INDICADORES_LOTE, parseBlock, type LineaLote } from '../../domain/batch'
import { describeFailure } from '../../domain/failures'
import { indicatorTypeLabel, refang, truncateMiddle } from '../../domain/format'
import { findByInput, type Investigation } from '../../domain/investigation'
import { navigate, rutas } from '../../hooks/useRoute'
import { useInvestigations } from '../../state/InvestigationsContext'
import { IndicatorTypeIcon } from '../IndicatorTypeIcon'
import { Alert } from '../ui/Alert'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { Panel } from '../ui/Panel'
import form from '../sidebar/IndicatorForm.module.css'
import styles from './Batch.module.css'

// Escenarios oficiales de la propuesta (backend data/test_dataset/scenarios.json).
const EXAMPLES: readonly { label: string; texto: string }[] = [
  { label: 'SUNBURST', texto: '2c4a910a1299cdae2a4e55988a2f102e\nervsystem[.]com' },
  {
    label: 'tres amenazas',
    texto: 'googledrive[.]network\nedde2e639889353657078f66a3bd11b4ae54343a991e95a522a7d5c7f050eb15\n84.234.75.108',
  },
]

function estadoLinea(linea: LineaLote, items: Investigation[]): { texto: string; tono: 'neutral' | 'info' | 'warning' } {
  if (!linea.tipo) return { texto: 'No reconocido: quedará registrado como inválido', tono: 'warning' }
  if (linea.duplicadoDe !== null) return { texto: `Duplicado de la línea ${linea.duplicadoDe}`, tono: 'neutral' }
  const existente = findByInput(items, linea.tipo, refang(linea.entrada))
  return existente ? { texto: `Ya en NEXO (#${existente.indicator.id}): se reutiliza`, tono: 'info' } : { texto: 'Nuevo', tono: 'neutral' }
}

export function BatchForm() {
  const { createBatch, items } = useInvestigations()
  const [nombre, setNombre] = useState('')
  const [texto, setTexto] = useState('')
  const [submitting, setSubmitting] = useState(false)
  const [error, setError] = useState<ErrorInfo | null>(null)
  const ids = { nombre: useId(), texto: useId(), hint: useId() }

  const lineas = parseBlock(texto)
  const indicadores = lineas.filter((l) => l.tipo && l.duplicadoDe === null).length
  const duplicados = lineas.filter((l) => l.duplicadoDe !== null).length
  const noReconocidas = lineas.filter((l) => !l.tipo).length
  const excede = lineas.length > MAX_INDICADORES_LOTE
  const puedeEnviar = lineas.length >= 2 && indicadores > 0 && !excede

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault()
    setSubmitting(true)
    setError(null)
    // Se envía todo, también lo no reconocido: el backend revalida y deja constancia de cada línea.
    const result = await createBatch(
      { nombre: nombre.trim() || null, indicadores: lineas.map((l) => ({ tipo: l.tipo, valor: l.entrada })) },
      { autoRun: true },
    )
    setSubmitting(false)
    if (result.ok) navigate(rutas.lote(result.created.batch.id))
    else setError(result.error)
  }

  return (
    <Panel title="Analizar lote" icon={<Layers aria-hidden="true" />}>
      <form className={form.form} onSubmit={onSubmit} noValidate>
        <div className={form.field}>
          <label className={form.label} htmlFor={ids.nombre}>
            Nombre del lote <span className={form.optional}>(opcional)</span>
          </label>
          <input
            id={ids.nombre}
            className={form.input}
            value={nombre}
            onChange={(e) => setNombre(e.target.value)}
            placeholder="p. ej. triage del reporte de phishing"
            autoComplete="off"
            maxLength={200}
          />
        </div>

        <div className={form.field}>
          <label className={form.label} htmlFor={ids.texto}>
            Indicadores (uno por línea)
          </label>
          <textarea
            id={ids.texto}
            className={`${form.input} ${styles.textarea} mono`}
            value={texto}
            onChange={(e) => {
              setTexto(e.target.value)
              setError(null)
            }}
            rows={8}
            spellCheck={false}
            aria-describedby={ids.hint}
            placeholder={'hxxp://evil[.]example/payload\n203.0.113.7\nd41d8cd98f00b204e9800998ecf8427e'}
          />
        </div>

        {lineas.length > 0 && (
          <section className={styles.preview} aria-label="Vista previa del lote">
            <p className={styles.summary} aria-live="polite">
              {lineas.length} línea(s) → <strong>{indicadores} indicador(es)</strong>
              {duplicados > 0 && ` · ${duplicados} duplicado(s)`}
              {noReconocidas > 0 && ` · ${noReconocidas} no reconocida(s)`}
            </p>
            <div className={styles.tableWrap}>
              <table className={styles.table}>
                <thead>
                  <tr>
                    <th scope="col">#</th>
                    <th scope="col">Entrada</th>
                    <th scope="col">Tipo</th>
                    <th scope="col">Estado</th>
                  </tr>
                </thead>
                <tbody>
                  {lineas.map((linea) => {
                    const estado = estadoLinea(linea, items)
                    return (
                      <tr key={linea.posicion}>
                        <td className={styles.ref}>{linea.posicion}</td>
                        <td className="mono" title={linea.entrada}>
                          {truncateMiddle(linea.entrada, 44)}
                        </td>
                        <td>
                          {linea.tipo ? (
                            <Badge tone="info" icon={<IndicatorTypeIcon tipo={linea.tipo} size={12} />}>
                              {indicatorTypeLabel(linea.tipo)}
                            </Badge>
                          ) : (
                            '—'
                          )}
                        </td>
                        <td>
                          <Badge tone={estado.tono}>{estado.texto}</Badge>
                        </td>
                      </tr>
                    )
                  })}
                </tbody>
              </table>
            </div>
          </section>
        )}

        {excede && (
          <Alert tone="warning" title={`Máximo ${MAX_INDICADORES_LOTE} líneas por lote`}>
            Hay {lineas.length}: quita algunas o divide el lote.
          </Alert>
        )}
        {lineas.length === 1 && (
          <Alert tone="info" title="Un lote necesita al menos dos líneas">
            Para un solo indicador usa <a href={rutas.analizar}>Un indicador</a>.
          </Alert>
        )}

        <Button type="submit" variant="primary" loading={submitting} disabled={!puedeEnviar} icon={<Layers size={16} aria-hidden="true" />}>
          Crear lote y analizar
        </Button>

        {error && (
          <Alert tone="danger" title="No se pudo crear el lote" onDismiss={() => setError(null)}>
            {describeFailure('ingest', error).hint ?? error.message}
          </Alert>
        )}

        <div className={form.examples}>
          <span className={form.hint}>Ejemplos:</span>
          {EXAMPLES.map((example) => (
            <button key={example.label} type="button" className={form.example} onClick={() => setTexto(example.texto)}>
              {example.label}
            </button>
          ))}
        </div>
      </form>
    </Panel>
  )
}
