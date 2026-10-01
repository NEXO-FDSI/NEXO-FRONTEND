import '@testing-library/jest-dom/vitest'
import { cleanup } from '@testing-library/react'
import { afterEach, vi } from 'vitest'

afterEach(() => {
  cleanup()
  vi.useRealTimers()
  vi.unstubAllGlobals()
  vi.restoreAllMocks()
  window.localStorage.clear()
  // Router por hash y tema viven en window/document: cada test empieza en el panel, oscuro.
  window.history.replaceState(null, '', '/')
  delete document.documentElement.dataset.theme
})
