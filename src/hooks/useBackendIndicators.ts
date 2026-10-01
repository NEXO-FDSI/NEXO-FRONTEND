import { useEffect, useState } from 'react'
import { nexoApi } from '../api/nexo'
import type { IndicatorRead } from '../api/types'

/** GET /indicators una vez al montar: lo registrado en el backend (también desde otros
 * navegadores). null si no respondió. Solo lectura, como useHealth y useStatus. */
export function useBackendIndicators(): IndicatorRead[] | null {
  const [indicators, setIndicators] = useState<IndicatorRead[] | null>(null)

  useEffect(() => {
    let active = true
    nexoApi.listIndicators().then(
      (list) => active && setIndicators(list),
      () => active && setIndicators(null),
    )
    return () => {
      active = false
    }
  }, [])

  return indicators
}
