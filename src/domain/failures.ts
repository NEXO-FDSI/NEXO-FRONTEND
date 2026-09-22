import type { ErrorInfo } from '../api/http'
import type { StepId } from './investigation'

export interface FailureDescription {
  title: string
  hint: string | null
}

const STEP_NAME: Record<StepId, string> = {
  ingest: 'registrar el indicador',
  enrich: 'enriquecer el indicador',
  correlate: 'correlacionar con ATT&CK',
  report: 'generar el informe',
  validate: 'registrar la validación',
}

/** Traduce un fallo del backend a un mensaje accionable para el analista. */
export function describeFailure(step: StepId, error: ErrorInfo): FailureDescription {
  if (error.kind === 'network') {
    return {
      title: 'Backend inaccesible',
      hint: 'Verifica que NEXO-BACKEND esté en línea. Si lo está, revisa su log: un error interno (500) llega al navegador sin cabeceras CORS.',
    }
  }
  if (error.kind === 'timeout') {
    return {
      title: `Tiempo de espera agotado al ${STEP_NAME[step]}`,
      hint:
        step === 'report'
          ? 'El LLM puede tardar hasta ~60 s en CPU. Si el backend terminó, el informe quedó guardado aunque no se muestre aquí.'
          : error.message,
    }
  }
  switch (error.status) {
    case 502:
      return {
        title: 'No se pudo verificar la reputación',
        hint: `${error.message}. Esto NO significa "sin evidencia": reintenta cuando OTX esté disponible.`,
      }
    case 404:
      return {
        title: 'El recurso ya no existe en el backend',
        hint: `${error.message}. La base de datos pudo reiniciarse; registra el indicador de nuevo.`,
      }
    case 400:
      return { title: 'Falta un paso previo', hint: error.message }
    case 422:
      return { title: 'Datos inválidos', hint: error.message }
    default:
      return { title: `No se pudo ${STEP_NAME[step]}`, hint: error.message }
  }
}
