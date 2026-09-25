import { FileQuestion, Fingerprint, Globe, Link2, Network } from 'lucide-react'
import type { LucideIcon } from 'lucide-react'

const ICONS: Record<string, LucideIcon> = {
  ip: Network,
  domain: Globe,
  hash: Fingerprint,
  url: Link2,
}

export function IndicatorTypeIcon({ tipo, size = 16 }: { tipo: string; size?: number }) {
  const Icon = ICONS[tipo] ?? FileQuestion
  return <Icon size={size} aria-hidden="true" />
}
