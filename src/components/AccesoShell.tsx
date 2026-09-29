import { Navigate, useLocation } from 'react-router-dom'
import { AdminLayout } from '@/components/AdminLayout'
import { useAcceso } from '@/contexts/AccesoContext'
import { useEsMovil } from '@/lib/dispositivoMovil'
import { MovilLayout } from '@/pages/movil/MovilLayout'

/** En el teléfono sustituye el panel de escritorio por la consulta móvil. */
export function AccesoShell() {
  const movil = useEsMovil()
  const acceso = useAcceso()
  const { pathname } = useLocation()
  const enMovil = pathname === '/m' || pathname.startsWith('/m/')

  if (movil && !enMovil) {
    return <Navigate to={acceso.inicioMovil} replace />
  }
  if (!movil && enMovil) {
    return <Navigate to="/" replace />
  }
  if (movil) return <MovilLayout />
  return <AdminLayout />
}
