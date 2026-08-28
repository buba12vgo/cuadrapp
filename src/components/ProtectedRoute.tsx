import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const location = useLocation()

  if (loading) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-2 bg-slate-50">
        <p className="text-sm font-medium text-slate-700">Comprobando sesión…</p>
        <p className="text-xs text-slate-500">Si tarda demasiado, serás enviado al login.</p>
      </div>
    )
  }

  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  return <Outlet />
}
