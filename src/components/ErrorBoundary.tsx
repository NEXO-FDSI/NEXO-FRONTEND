import { Component, type ErrorInfo, type ReactNode } from 'react'
import { Alert } from './ui/Alert'
import { Button } from './ui/Button'

interface ErrorBoundaryProps {
  children: ReactNode
}

/** Un fallo de render en el detalle no debe tumbar la aplicación entera. */
export class ErrorBoundary extends Component<ErrorBoundaryProps, { failed: boolean }> {
  state = { failed: false }

  static getDerivedStateFromError() {
    return { failed: true }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('Error de render en NEXO', error, info.componentStack)
  }

  render() {
    if (!this.state.failed) return this.props.children
    return (
      <Alert
        tone="danger"
        title="No se pudo mostrar esta vista"
        actions={<Button onClick={() => this.setState({ failed: false })}>Reintentar</Button>}
      >
        Ocurrió un error inesperado en la interfaz. Los datos del historial no se perdieron.
      </Alert>
    )
  }
}
