import { ArrowRight, Sparkles } from 'lucide-react'
import type { Concordancia } from '../../api/types'
import type { Investigation } from '../../domain/investigation'
import { latestMetadatos, NIVEL_CONFIANZA_LABEL } from '../../domain/severity'
import { NIVEL_CONFIANZA_TONE } from '../tones'
import { Badge } from '../ui/Badge'
import { Button } from '../ui/Button'
import { EvidenceChain } from './EvidenceChain'
import { SeverityBadge } from './Signals'
import styles from './SummaryPanel.module.css'

function concordanceText({ etiqueta, entidades, resultado }: Concordancia): string {
  const lista = entidades.join(', ')
  if (resultado === 'concuerda') return `${etiqueta} concuerda: sus familias apuntan a ${lista}.`
  if (resultado === 'discrepa') return `${etiqueta} contradice la asociación: sus familias apuntan a ${lista}.`
  return `${etiqueta} sugiere ${lista}, entidad que NEXO no resolvió.`
}

interface SummaryPanelProps {
  inv: Investigation
  onOpenAnalysis: () => void
}

/** Lo esencial de un vistazo: qué tan grave, si las fuentes coinciden y qué dice la IA. */
export function SummaryPanel({ inv, onOpenAnalysis }: SummaryPanelProps) {
  const meta = latestMetadatos(inv)
  const contradicciones = meta?.contradicciones ?? []
  // Una familia que apunta a otra entidad ya figura como contradicción: no se repite aquí.
  const yaContradice = (fuente: string) =>
    contradicciones.some((c) => c.tipo === 'entidad_distinta' && c.fuentes.includes(fuente))
  const comparables =
    meta?.concordancia.filter((c) => c.resultado !== 'no_comparable' && !yaContradice(c.fuente)) ?? []
  const resumenIA = meta?.ia.analisis?.resumen

  return (
    <div className={styles.panel}>
      <div className={styles.top}>
        <section className={styles.block} aria-label="Evaluación de severidad">
          <h3 className={styles.heading}>Severidad</h3>
          <SeverityBadge nivel={meta?.severidad.nivel ?? null} />
          {meta ? (
            <ul className={styles.reasons}>
              {meta.severidad.motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          ) : (
            <p className={styles.muted}>
              Se calcula al generar el informe, con reglas determinísticas: la IA no decide la severidad.
            </p>
          )}
        </section>

        {meta?.confianza && (
          <section className={styles.block} aria-label="Nivel de confianza">
            <h3 className={styles.heading}>Nivel de confianza</h3>
            <Badge tone={NIVEL_CONFIANZA_TONE[meta.confianza.nivel]}>{NIVEL_CONFIANZA_LABEL[meta.confianza.nivel]}</Badge>
            <ul className={styles.reasons}>
              {meta.confianza.motivos.map((m) => (
                <li key={m}>{m}</li>
              ))}
            </ul>
          </section>
        )}

        {contradicciones.length > 0 && (
          <section className={styles.block} aria-label="Contradicciones entre fuentes">
            <h3 className={styles.heading}>Contradicciones entre fuentes</h3>
            <ul className={styles.reasons}>
              {contradicciones.map((c) => (
                <li key={c.detalle} className={styles.discrepa}>
                  {c.detalle}
                </li>
              ))}
            </ul>
          </section>
        )}

        {comparables.length > 0 && (
          <section className={styles.block} aria-label="Concordancia entre fuentes">
            <h3 className={styles.heading}>Concordancia entre fuentes</h3>
            <ul className={styles.reasons}>
              {comparables.map((c) => (
                <li key={c.fuente} className={styles[c.resultado]}>
                  {concordanceText(c)}
                </li>
              ))}
            </ul>
          </section>
        )}
      </div>

      {resumenIA && (
        <section className={styles.ai} aria-label="Resumen de la IA">
          <p className={styles.kicker}>
            <Sparkles size={14} aria-hidden="true" /> Resumen redactado por IA
          </p>
          <p>{resumenIA}</p>
          <Button size="sm" variant="ghost" icon={<ArrowRight size={14} aria-hidden="true" />} onClick={onOpenAnalysis}>
            Ver análisis y trazabilidad
          </Button>
        </section>
      )}

      <EvidenceChain inv={inv} />
    </div>
  )
}
