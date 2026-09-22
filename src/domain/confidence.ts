export type ConfidenceLevel = 'alta' | 'media' | 'baja' | 'nula'

/**
 * Nivel legible de la confianza de la asociación. El backend emite 0.9
 * (malware_families), 0.6 (tags) o nada/0.0 (sin entidad resuelta).
 */
export function confidenceLevel(value: number | null | undefined): ConfidenceLevel {
  if (value == null || value <= 0) return 'nula'
  if (value >= 0.8) return 'alta'
  if (value >= 0.5) return 'media'
  return 'baja'
}

export const CONFIDENCE_LABEL: Record<ConfidenceLevel, string> = {
  alta: 'Confianza alta',
  media: 'Confianza media',
  baja: 'Confianza baja',
  nula: 'Sin asociación',
}
