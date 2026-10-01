import { useEffect, useState } from 'react'

export type Theme = 'dark' | 'light'
const THEME_KEY = 'nexo.tema'

// localStorage puede no existir o lanzar (modo privado): el tema es una preferencia, no un dato.
function readTheme(): Theme {
  try {
    return window.localStorage.getItem(THEME_KEY) === 'light' ? 'light' : 'dark'
  } catch {
    return 'dark'
  }
}

/** Oscuro por defecto (consola SOC); claro a pedido. Se aplica con <html data-theme>. */
export function useTheme(): [Theme, () => void] {
  const [theme, setTheme] = useState<Theme>(readTheme)

  useEffect(() => {
    document.documentElement.dataset.theme = theme
    try {
      window.localStorage.setItem(THEME_KEY, theme)
    } catch {
      // sin persistencia: el tema dura lo que la pestaña
    }
  }, [theme])

  return [theme, () => setTheme((t) => (t === 'dark' ? 'light' : 'dark'))]
}
