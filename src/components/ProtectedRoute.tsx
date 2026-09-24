import { Navigate, Outlet, useLocation } from 'react-router-dom'
import { useAcceso } from '@/contexts/AccesoContext'
import { useAuth } from '@/contexts/AuthContext'
import { puedeVerRuta } from '@/lib/acceso'

export function ProtectedRoute() {
  const { user, loading } = useAuth()
  const acceso = useAcceso()
  const location = useLocation()

  if (loading || acceso.loading) {
    return (
      <div className="flex h-svh flex-col items-center justify-center gap-2 bg-canvas">
        <p className="text-sm font-semibold text-ink">Comprobando sesión…</p>
        <p className="text-sm text-muted">
          Si tarda demasiado, serás enviado al login.
        </p>
      </div>
    )
  }

  if (!user || !acceso.perfil) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />
  }

  if (
    !puedeVerRuta(acceso.perfil.rol, location.pathname, {
      puedeEditarEventos: acceso.perfil.puedeEditarEventos,
    })
  ) {
    return <Navigate to={acceso.inicio} replace />
  }

  return <Outlet />
}
