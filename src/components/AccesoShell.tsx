import { Navigate, useLocation } from 'react-router-dom'
import { AdminLayout } from '@/components/AdminLayout'
import { useAcceso } from '@/contexts/AccesoContext'
import { inicioMovil } from '@/lib/acceso'
import { useEsMovil } from '@/lib/dispositivoMovil'
import { MovilLayout } from '@/pages/movil/MovilLayout'

/** En el teléfono sustituye el panel de escritorio por la consulta móvil. */
export function AccesoShell() {
  const movil = useEsMovil()
  const acceso = useAcceso()
  const { pathname } = useLocation()
  const enMovil = pathname === '/m' || pathname.startsWith('/m/')
  const destinoMovil = acceso.perfil
    ? inicioMovil(acceso.perfil.rol, {
        esJefatura: acceso.esJefatura,
        puedeEditarEventos: acceso.perfil.puedeEditarEventos,
      })
    : '/m/servicio'

  if (movil && !enMovil) {
    return <Navigate to={destinoMovil} replace />
  }
  if (!movil && enMovil) {
    return <Navigate to="/" replace />
  }
  if (movil) return <MovilLayout />
  return <AdminLayout />
}
