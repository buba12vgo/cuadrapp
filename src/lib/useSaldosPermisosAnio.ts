import { useEffect, useRef, useState } from 'react'
import {
  cargarResumenesPermisosAnio,
  resumenPermisosVacio,
  type ResumenPermisosAgente,
} from '@/lib/conteoPermisos'
import { ensureFirebase } from '@/lib/firebase'
import { useTiposPermiso } from '@/lib/permisosStore'
import type { FichaPolicia } from '@/types'

export function useSaldosPermisosAnio(agentes: FichaPolicia[], anio: number) {
  const [permisos] = useTiposPermiso()
  const [resumenes, setResumenes] = useState<Record<string, ResumenPermisosAgente>>({})
  const [loading, setLoading] = useState(true)
  const clave = agentes.map((agente) => agente.id).join('\0')
  const agentesRef = useRef(agentes)
  agentesRef.current = agentes

  useEffect(() => {
    let cancelado = false
    const lista = agentesRef.current
    async function cargar() {
      setLoading(true)
      const vacio = Object.fromEntries(
        lista.map((agente) => [agente.id, resumenPermisosVacio()]),
      )
      const ready = await ensureFirebase()
      if (!ready || lista.length === 0) {
        if (!cancelado) {
          setResumenes(vacio)
          setLoading(false)
        }
        return
      }
      try {
        const mapa = await cargarResumenesPermisosAnio(lista, anio, permisos)
        if (!cancelado) setResumenes(mapa)
      } catch {
        if (!cancelado) setResumenes(vacio)
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelado = true
    }
  }, [anio, clave, permisos])

  return { permisos, resumenes, loading }
}
