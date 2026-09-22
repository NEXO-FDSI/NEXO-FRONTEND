import { act, render, screen } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { useState } from 'react'
import { describe, expect, it, vi } from 'vitest'
import { ErrorBoundary } from '../ErrorBoundary'
import { CopyButton } from './CopyButton'
import { Tabs } from './Tabs'

function TabsHarness() {
  const [value, setValue] = useState<'a' | 'b' | 'c'>('a')
  return (
    <Tabs
      label="Demo"
      value={value}
      onChange={setValue}
      items={[
        { id: 'a', label: 'Uno', content: 'Panel uno' },
        { id: 'b', label: 'Dos', count: 4, content: 'Panel dos' },
        { id: 'c', label: 'Tres', content: 'Panel tres' },
      ]}
    />
  )
}

describe('Tabs', () => {
  it('sigue el patrón WAI-ARIA de teclado', async () => {
    const user = userEvent.setup()
    render(<TabsHarness />)
    const selected = () => screen.getByRole('tab', { selected: true })

    expect(screen.getByRole('tabpanel', { name: 'Uno' })).toHaveTextContent('Panel uno')
    await user.click(screen.getByRole('tab', { name: 'Uno' }))
    await user.keyboard('{ArrowLeft}')
    expect(selected()).toHaveTextContent('Tres')
    expect(selected()).toHaveFocus()
    await user.keyboard('{ArrowRight}')
    expect(selected()).toHaveTextContent('Uno')
    await user.keyboard('{End}')
    expect(selected()).toHaveTextContent('Tres')
    await user.keyboard('{Home}')
    expect(selected()).toHaveTextContent('Uno')
    await user.keyboard('{Enter}')
    expect(selected()).toHaveTextContent('Uno')

    await user.click(screen.getByRole('tab', { name: /^Dos:\s?4$/ }))
    expect(screen.getByRole('tabpanel')).toHaveTextContent('Panel dos')
    expect(screen.getAllByRole('tab').map((t) => t.tabIndex)).toEqual([-1, 0, -1])
  })
})

describe('CopyButton', () => {
  it('confirma la copia y vuelve al estado inicial', async () => {
    vi.useFakeTimers()
    const writeText = vi.fn().mockResolvedValueOnce(undefined).mockRejectedValueOnce(new Error('denegado'))
    vi.stubGlobal('navigator', { clipboard: { writeText } })
    render(<CopyButton text="8.8.8.8" label="Copiar valor" />)
    const button = screen.getByRole('button', { name: 'Copiar valor' })

    await act(async () => button.click())
    expect(writeText).toHaveBeenCalledWith('8.8.8.8')
    expect(button).toHaveTextContent('Copiado')

    act(() => vi.advanceTimersByTime(2_000))
    expect(button).toHaveTextContent('')

    await act(async () => button.click())
    expect(button).toHaveTextContent('No se pudo copiar')
  })
})

describe('ErrorBoundary', () => {
  it('contiene un error de render y permite reintentar', async () => {
    vi.spyOn(console, 'error').mockImplementation(() => {})
    let fail = true
    function Fragile() {
      if (fail) throw new Error('render roto')
      return <p>Recuperado</p>
    }
    const user = userEvent.setup()
    render(
      <ErrorBoundary>
        <Fragile />
      </ErrorBoundary>,
    )

    expect(screen.getByRole('alert')).toHaveTextContent('No se pudo mostrar esta vista')
    fail = false
    await user.click(screen.getByRole('button', { name: 'Reintentar' }))
    expect(screen.getByText('Recuperado')).toBeInTheDocument()
  })
})
