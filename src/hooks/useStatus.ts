import { useEffect, useState } from 'react'
import { nexoApi } from '../api/nexo'
import type { StatusResponse } from '../api/types'

/** GET /status una vez al montar: fuentes e IA configuradas. null si no respondió. */
export function useStatus(): StatusResponse | null {
  const [status, setStatus] = useState<StatusResponse | null>(null)

  useEffect(() => {
    let active = true
    nexoApi.status().then(
      (s) => active && setStatus(s),
      () => active && setStatus(null),
    )
    return () => {
      active = false
    }
  }, [])

  return status
}
