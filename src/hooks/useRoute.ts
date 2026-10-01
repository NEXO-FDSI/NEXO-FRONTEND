import { useSyncExternalStore } from 'react'

/**
 * Router por hash, sin dependencia: cuatro vistas no justifican react-router. La URL es
 * la única fuente de verdad de qué investigación está abierta (enlazable y con "atrás").
 */
export type Route =
  | { view: 'panel' }
  | { view: 'investigaciones' }
  | { view: 'analizar' }
  | { view: 'investigacion'; id: number }

export const rutas = {
  panel: '#/',
  investigaciones: '#/investigaciones',
  analizar: '#/analizar',
  investigacion: (id: number) => `#/investigaciones/${id}`,
}

export function parseRoute(hash: string): Route {
  const [seccion, id, ...resto] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  if (resto.length > 0) return { view: 'panel' }
  if (seccion === 'analizar' && !id) return { view: 'analizar' }
  if (seccion === 'investigaciones' && !id) return { view: 'investigaciones' }
  if (seccion === 'investigaciones' && /^\d+$/.test(id)) return { view: 'investigacion', id: Number(id) }
  return { view: 'panel' }
}

function subscribe(onChange: () => void): () => void {
  window.addEventListener('hashchange', onChange)
  return () => window.removeEventListener('hashchange', onChange)
}

export function useRoute(): Route {
  return parseRoute(useSyncExternalStore(subscribe, () => window.location.hash))
}

export function navigate(to: string): void {
  window.location.hash = to
}
