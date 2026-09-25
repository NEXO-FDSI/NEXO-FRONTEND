import { describe, expect, it } from 'vitest'
import { groupByTactic, techniqueUrl } from './attck'

describe('groupByTactic', () => {
  it('agrupa en orden de kill chain, con tácticas desconocidas al final', () => {
    const groups = groupByTactic([
      { id: 'T1486', nombre: 'Data Encrypted for Impact', tactica: 'Impact' },
      { id: 'T9999', nombre: 'Algo', tactica: 'Zeta Custom' },
      { id: 'T1071', nombre: 'Application Layer Protocol', tactica: 'Command And Control' },
      { id: 'T1210', nombre: 'Exploitation of Remote Services', tactica: 'Lateral Movement' },
      { id: 'T1489', nombre: 'Service Stop', tactica: 'Impact' },
      { id: 'T9998', nombre: 'Otro', tactica: 'Alfa Custom' },
      { id: 'T1222.001', nombre: 'Windows Permissions', tactica: 'Defense Impairment' },
      { id: 'T1564.001', nombre: 'Hidden Files and Directories', tactica: 'Stealth' },
    ])

    expect(groups.map((g) => g.tactica)).toEqual([
      'Stealth',
      'Defense Impairment',
      'Lateral Movement',
      'Command And Control',
      'Impact',
      'Alfa Custom',
      'Zeta Custom',
    ])
    expect(groups[4].tecnicas.map((t) => t.id)).toEqual(['T1486', 'T1489'])
  })

  it('devuelve una lista vacía sin técnicas', () => {
    expect(groupByTactic([])).toEqual([])
  })
})

describe('techniqueUrl', () => {
  it('apunta a la página oficial de la técnica y de la subtécnica', () => {
    expect(techniqueUrl('T1566')).toBe('https://attack.mitre.org/techniques/T1566/')
    expect(techniqueUrl('T1059.001')).toBe('https://attack.mitre.org/techniques/T1059/001/')
  })
})
