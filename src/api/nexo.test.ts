import { describe, expect, it } from 'vitest'
import { mockBackend, reply } from '../test/fakeBackend'
import { nexoApi } from './nexo'

describe('nexoApi', () => {
  it('mapea cada paso del pipeline a su endpoint del backend', async () => {
    const { calls } = mockBackend({
      'GET /health': reply(200, { status: 'ok' }),
      'POST /indicators': reply(201, {}),
      'POST /indicators/3/enrich': reply(200, {}),
      'POST /indicators/3/correlate': reply(200, {}),
      'POST /indicators/3/report': reply(201, {}),
      'POST /reports/5/validate': reply(201, {}),
    })

    await nexoApi.health()
    await nexoApi.createIndicator({ tipo: 'domain', valor: 'evil.com', fuente: null })
    await nexoApi.enrich(3)
    await nexoApi.correlate(3)
    await nexoApi.createReport(3)
    await nexoApi.validateReport(5, { decision: 'rechazado', analista: 'N2' })

    expect(calls).toEqual([
      { method: 'GET', path: '/health', body: undefined },
      { method: 'POST', path: '/indicators', body: { tipo: 'domain', valor: 'evil.com', fuente: null } },
      { method: 'POST', path: '/indicators/3/enrich', body: undefined },
      { method: 'POST', path: '/indicators/3/correlate', body: undefined },
      { method: 'POST', path: '/indicators/3/report', body: undefined },
      { method: 'POST', path: '/reports/5/validate', body: { decision: 'rechazado', analista: 'N2' } },
    ])
  })
})
