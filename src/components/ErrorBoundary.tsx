import { Component, type ErrorInfo, type ReactNode } from 'react'
import { esErrorCargaModulo } from '@/lib/cargaDiferida'

type Props = { children: ReactNode }
type State = { error: Error | null }

export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null }

  static getDerivedStateFromError(error: Error): State {
    return { error }
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error('[Cuadrapp] Error de renderizado', error, info.componentStack)
  }

  render() {
    if (this.state.error) {
      const versionVieja = esErrorCargaModulo(this.state.error)
      return (
        <div className="flex min-h-svh flex-col items-center justify-center bg-canvas px-4">
          <div className="w-full max-w-md rounded-xl border border-red-200 bg-surface p-6 shadow-card">
            <h1 className="font-display text-lg font-bold text-ink">
              {versionVieja
                ? 'No se pudo cargar esta pantalla'
                : 'Error al cargar la aplicación'}
            </h1>
            <p className="mt-2 text-sm text-muted">
              {versionVieja
                ? 'Hay una versión nueva de Cuadrapp o se ha perdido la conexión. Recarga para continuar.'
                : this.state.error.message || 'Ha ocurrido un error inesperado.'}
            </p>
            <button
              type="button"
              onClick={() => window.location.reload()}
              className="mt-4 rounded-lg bg-brand-600 px-4 py-2 text-sm font-semibold text-white hover:bg-brand-700"
            >
              Recargar
            </button>
          </div>
        </div>
      )
    }

    return this.props.children
  }
}
