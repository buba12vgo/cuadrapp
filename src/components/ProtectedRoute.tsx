import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { isAllowedAdmin } from '@/lib/authAllowlist'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-2 bg-canvas">
        <p className="text-sm font-semibold text-ink">Comprobando sesión…</p>
        <p className="text-sm text-muted">
          Si tarda demasiado, serás enviado al login.
        </p>
      </div>
    )
  }

  if (!user || !isAllowedAdmin(user)) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
