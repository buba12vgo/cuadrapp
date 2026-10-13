import { CalendarDays } from 'lucide-react'
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
      <div className="flex h-svh flex-col items-center justify-center gap-3 bg-canvas">
        <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
          <CalendarDays className="h-6 w-6" aria-hidden />
        </span>
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
      esJefatura: acceso.esJefatura,
      email: acceso.perfil.email,
    })
  ) {
    const destino = location.pathname.startsWith('/m')
      ? acceso.inicioMovil
      : acceso.inicio
    return <Navigate to={destino} replace />
  }

  return <Outlet />
}
