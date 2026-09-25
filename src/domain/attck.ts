import type { Technique } from '../api/types'

// Orden oficial de la matriz Enterprise ATT&CK 19.1 (x-mitre-matrix.tactic_refs del
// bundle que carga el backend; en v19 "Defense Evasion" se dividió en "Stealth" y
// "Defense Impairment"). El backend entrega la táctica con .title() ("Command And
// Control"), por eso se compara en minúsculas.
const TACTIC_ORDER = [
  'reconnaissance',
  'resource development',
  'initial access',
  'execution',
  'persistence',
  'privilege escalation',
  'stealth',
  'defense impairment',
  'credential access',
  'discovery',
  'lateral movement',
  'collection',
  'command and control',
  'exfiltration',
  'impact',
]

export interface TacticGroup {
  tactica: string
  tecnicas: Technique[]
}

const rank = (tactica: string): number => {
  const index = TACTIC_ORDER.indexOf(tactica.toLowerCase())
  return index === -1 ? TACTIC_ORDER.length : index
}

/** Técnicas agrupadas por táctica, en orden de kill chain; tácticas desconocidas al final. */
export function groupByTactic(tecnicas: Technique[]): TacticGroup[] {
  const groups = new Map<string, Technique[]>()
  for (const tecnica of tecnicas) {
    groups.set(tecnica.tactica, [...(groups.get(tecnica.tactica) ?? []), tecnica])
  }
  return [...groups.entries()]
    .map(([tactica, items]) => ({
      tactica,
      tecnicas: items.toSorted((a, b) => a.id.localeCompare(b.id)),
    }))
    .toSorted((a, b) => rank(a.tactica) - rank(b.tactica) || a.tactica.localeCompare(b.tactica))
}

/** Página oficial de la técnica: T1059.001 → /techniques/T1059/001/. */
export function techniqueUrl(id: string): string {
  return `https://attack.mitre.org/techniques/${id.replace('.', '/')}/`
}
