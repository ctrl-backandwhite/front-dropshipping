import { useEffect } from 'react'
import { Navigate, useLocation } from 'react-router-dom'
import { useAuthStore, CurrentUser } from '../store/auth'
import { dialog } from '../store/dialog'
import { useT } from '../store/locale'

interface Props {
  children: React.ReactNode
  roles?: CurrentUser['role'][]
}

export function ProtectedRoute({ children, roles }: Props) {
  const { user, initialized, loading, init } = useAuthStore()
  const location = useLocation()
  const t = useT()

  useEffect(() => {
    if (!initialized) init()
  }, [initialized, init])

  // Aviso explícito cuando el rol no tiene permiso (antes la redirección al home era silenciosa
  // y se sentía como una incoherencia de navegación).
  const denied = !!user && !!roles && roles.length > 0 && !roles.includes(user.role)
  useEffect(() => {
    if (denied) dialog.alert({ variant: 'error', message: t('nav.access_denied') })
  }, [denied, t])

  if (!initialized || loading) {
    return <CenteredSpinner />
  }
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }
  if (denied) {
    // Usuario autenticado sin permiso → vuelve a SU zona (catálogo) en vez de al home.
    return <Navigate to="/catalog" replace />
  }
  return <>{children}</>
}

function CenteredSpinner() {
  return (
    <div className="min-h-screen flex items-center justify-center">
      <div className="text-sm text-slate-500">Cargando…</div>
    </div>
  )
}
