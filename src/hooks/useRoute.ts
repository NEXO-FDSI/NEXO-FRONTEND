import { useSyncExternalStore } from 'react'

/**
 * Router por hash, sin dependencia: seis vistas no justifican react-router. La URL es
 * la única fuente de verdad de qué investigación está abierta (enlazable y con "atrás").
 */
export type Route =
  | { view: 'panel' }
  | { view: 'investigaciones' }
  | { view: 'analizar'; modo: 'indicador' | 'lote' }
  | { view: 'investigacion'; id: number }
  | { view: 'lotes' }
  | { view: 'lote'; id: number }

export const rutas = {
  panel: '#/',
  investigaciones: '#/investigaciones',
  analizar: '#/analizar',
  analizarLote: '#/analizar/lote',
  investigacion: (id: number) => `#/investigaciones/${id}`,
  lotes: '#/lotes',
  lote: (id: number) => `#/lotes/${id}`,
}

export function parseRoute(hash: string): Route {
  const [seccion, id, ...resto] = hash.replace(/^#\/?/, '').split('/').filter(Boolean)
  const numero = id !== undefined && /^\d+$/.test(id)
  if (resto.length > 0) return { view: 'panel' }
  if (seccion === 'analizar' && (!id || id === 'lote')) return { view: 'analizar', modo: id ? 'lote' : 'indicador' }
  if (seccion === 'investigaciones' && !id) return { view: 'investigaciones' }
  if (seccion === 'investigaciones' && numero) return { view: 'investigacion', id: Number(id) }
  if (seccion === 'lotes' && !id) return { view: 'lotes' }
  if (seccion === 'lotes' && numero) return { view: 'lote', id: Number(id) }
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
