import { useEffect, useState } from 'react'
import { nexoApi } from '../api/nexo'

export type HealthStatus = 'checking' | 'online' | 'offline'

const POLL_INTERVAL_MS = 30_000

/** Estado de GET /health, consultado al montar y cada 30 s. */
export function useHealth(): HealthStatus {
  const [status, setStatus] = useState<HealthStatus>('checking')

  useEffect(() => {
    let active = true
    const check = () =>
      nexoApi.health().then(
        (r) => active && setStatus(r.status === 'ok' ? 'online' : 'offline'),
        () => active && setStatus('offline'),
      )
    void check()
    const timer = setInterval(check, POLL_INTERVAL_MS)
    return () => {
      active = false
      clearInterval(timer)
    }
  }, [])

  return status
}
