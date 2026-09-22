import { act, renderHook } from '@testing-library/react'
import { describe, expect, it, vi } from 'vitest'
import { mockBackend, reply } from '../test/fakeBackend'
import { useElapsedSeconds } from './useElapsedSeconds'
import { useHealth } from './useHealth'

describe('useHealth', () => {
  it('pasa de "checking" a "online" cuando /health responde ok', async () => {
    mockBackend({ 'GET /health': reply(200, { status: 'ok' }) })
    const { result } = renderHook(() => useHealth())

    expect(result.current).toBe('checking')
    await vi.waitFor(() => expect(result.current).toBe('online'))
  })

  it.each([
    ['un estado distinto de ok', reply(200, { status: 'degraded' })],
    ['un error HTTP', reply(503, { detail: 'caído' })],
    ['un fallo de red', new TypeError('Failed to fetch')],
  ])('marca "offline" ante %s', async (_caso, response) => {
    mockBackend({ 'GET /health': response })
    const { result } = renderHook(() => useHealth())
    await vi.waitFor(() => expect(result.current).toBe('offline'))
  })

  it('vuelve a consultar cada 30 s y deja de hacerlo al desmontar', async () => {
    vi.useFakeTimers()
    const { calls } = mockBackend({ 'GET /health': reply(200, { status: 'ok' }) })
    const { unmount } = renderHook(() => useHealth())

    await act(() => vi.advanceTimersByTimeAsync(30_000))
    expect(calls).toHaveLength(2)

    unmount()
    await vi.advanceTimersByTimeAsync(60_000)
    expect(calls).toHaveLength(2)
  })
})

describe('useElapsedSeconds', () => {
  it('cuenta mientras está activo y se reinicia al desactivarse', () => {
    vi.useFakeTimers()
    const { result, rerender } = renderHook(({ active }) => useElapsedSeconds(active), {
      initialProps: { active: false },
    })

    act(() => vi.advanceTimersByTime(3_000))
    expect(result.current).toBe(0)

    rerender({ active: true })
    act(() => vi.advanceTimersByTime(3_000))
    expect(result.current).toBe(3)

    rerender({ active: false })
    expect(result.current).toBe(0)
  })
})
