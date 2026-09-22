import type { ConfidenceLevel } from '../domain/confidence'
import type { InvestigationStatus } from '../domain/investigation'
import type { Tone } from './ui/Badge'

export const STATUS_TONE: Record<InvestigationStatus, Tone> = {
  registrado: 'neutral',
  enriquecido: 'info',
  correlacionado: 'info',
  pendiente: 'warning',
  aceptado: 'success',
  rechazado: 'danger',
}

export const CONFIDENCE_TONE: Record<ConfidenceLevel, Tone> = {
  alta: 'success',
  media: 'warning',
  baja: 'danger',
  nula: 'neutral',
}
