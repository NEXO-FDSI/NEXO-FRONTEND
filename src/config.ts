/** URL base de NEXO-BACKEND. Se fija en build (Vite) con VITE_API_URL. */
export const API_URL = (import.meta.env.VITE_API_URL || 'http://localhost:8000').replace(/\/+$/, '')
