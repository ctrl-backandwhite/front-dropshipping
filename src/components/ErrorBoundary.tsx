import { Component, ReactNode } from 'react'
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome'
import { faTriangleExclamation, faRotate, faHouse, faCloudArrowDown } from '@fortawesome/free-solid-svg-icons'

interface Props { children: ReactNode }
interface State { error: Error | null; info: string | null }

/**
 * Fallback de PÁGINA limpio y on-brand (no alarmante). Se usa cuando el contenido
 * de una ruta no se puede pintar (p.ej. la API no responde en el despliegue remoto):
 * en vez de la pantalla roja "Algo salió mal", mantenemos el chrome del sitio
 * (nav/footer) y mostramos un estado vacío estético con opción de reintentar.
 */
export function ContentUnavailable() {
  return (
    <div className="min-h-[40vh] flex flex-col items-center justify-center text-center gap-3 py-16">
      <span className="inline-flex w-14 h-14 items-center justify-center rounded-full bg-base-200 text-ink-400">
        <FontAwesomeIcon icon={faCloudArrowDown} className="text-xl" />
      </span>
      <p className="text-ink-500 max-w-sm text-sm">
        Estamos preparando el contenido. Vuelve a intentarlo en unos segundos.
      </p>
      <button onClick={() => window.location.reload()} className="btn btn-sm btn-outline">
        <FontAwesomeIcon icon={faRotate} /> Reintentar
      </button>
    </div>
  )
}

/**
 * Boundary inline para envolver secciones (charts lazy, carruseles, etc.).
 * Si falla, muestra un alert pequeño sin tumbar la página entera.
 */
interface InlineProps { children: ReactNode; fallback?: ReactNode; label?: string }
interface InlineState { hasError: boolean; message: string }
export class SectionBoundary extends Component<InlineProps, InlineState> {
  state: InlineState = { hasError: false, message: '' }
  static getDerivedStateFromError(err: Error): InlineState {
    return { hasError: true, message: err?.message ?? 'error' }
  }
  componentDidCatch(err: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error('[SectionBoundary]', this.props.label ?? '', err, info?.componentStack)
  }
  render() {
    if (!this.state.hasError) return this.props.children
    if (this.props.fallback) return this.props.fallback
    return (
      <div role="alert" className="alert alert-warning text-[12px]">
        <FontAwesomeIcon icon={faTriangleExclamation} />
        <span>
          No se pudo cargar {this.props.label ?? 'esta sección'}.
          <span className="opacity-70 block mt-0.5">{this.state.message}</span>
        </span>
      </div>
    )
  }
}

/**
 * Root-level error boundary. Without it, an uncaught render error blanks the
 * entire page — this catches it, logs the trace, and offers a recovery path.
 */
export class ErrorBoundary extends Component<Props, State> {
  state: State = { error: null, info: null }

  static getDerivedStateFromError(error: Error): State {
    return { error, info: null }
  }

  componentDidCatch(error: Error, info: { componentStack?: string }) {
    // eslint-disable-next-line no-console
    console.error('[ErrorBoundary]', error, info?.componentStack)
    this.setState({ info: info?.componentStack ?? null })
  }

  reset = () => this.setState({ error: null, info: null })

  render() {
    if (!this.state.error) return this.props.children
    // Mostrar los detalles también en producción para que los errores se puedan
    // diagnosticar sin tener que recompilar en modo dev.
    return (
      <div className="min-h-screen flex items-center justify-center p-6 bg-ink-50">
        <div className="max-w-xl w-full card p-8 text-center">
          <span className="inline-flex w-12 h-12 items-center justify-center rounded-full bg-red-100 text-red-600">
            <FontAwesomeIcon icon={faTriangleExclamation} className="text-xl" />
          </span>
          <h1 className="mt-4 text-2xl font-medium">Algo salió mal</h1>
          <p className="mt-2 text-ink-600">
            La página tuvo un problema inesperado. Probá recargar o volver al inicio.
          </p>
          <div className="mt-5 flex flex-wrap gap-2 justify-center">
            <button onClick={() => { this.reset(); window.location.reload() }} className="btn btn-primary">
              <FontAwesomeIcon icon={faRotate} /> Recargar
            </button>
            <a href="/" className="btn btn-outline" onClick={this.reset}>
              <FontAwesomeIcon icon={faHouse} /> Ir al inicio
            </a>
          </div>
          <details className="mt-6 text-left text-[11px] opacity-70">
            <summary className="cursor-pointer">Detalles técnicos</summary>
            <pre className="mt-2 p-3 bg-base-200 border border-base-300 rounded overflow-auto text-[11px] whitespace-pre-wrap max-h-80">
              {this.state.error.message}{'\n\n'}{this.state.error.stack}{this.state.info ?? ''}
            </pre>
          </details>
        </div>
      </div>
    )
  }
}
