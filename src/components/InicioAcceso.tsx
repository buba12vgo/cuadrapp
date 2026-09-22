import { Navigate } from 'react-router-dom'
import { useAcceso } from '@/contexts/AccesoContext'

export function InicioAcceso() {
  const { inicio, perfil, loading } = useAcceso()
  if (loading || !perfil) return null
  return <Navigate to={inicio} replace />
}
