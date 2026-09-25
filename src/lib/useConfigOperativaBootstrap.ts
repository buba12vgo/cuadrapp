import { useEffect, useState } from 'react'
import { hydrateAgentes } from '@/lib/agentesStore'
import { cargarConfigOperativa, getAgentes, getPlanesAnuales } from '@/lib/db'
import { hydrateEventos } from '@/lib/eventosStore'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import {
  fetchFirebaseStatus,
  formatFirebaseStatus,
} from '@/lib/firebaseStatus'
import {
  hydratePlanesAnuales,
  marcarErrorCargaPlan,
} from '@/lib/planAnualStore'
import { hydratePuestosYMinimos } from '@/lib/puestosStore'
import { hydrateTiposPermiso } from '@/lib/permisosStore'
import { bootstrapDesignPreview } from '@/lib/designPreviewBootstrap'
import { isDesignPreview } from '@/lib/designPreview'
import { useAcceso } from '@/contexts/AccesoContext'
import { vePermisosDeTodos } from '@/lib/acceso'

type EstadoCarga = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Carga plantilla, puestos, mínimos y eventos.
 * El plan anual solo lo leen superadmin y admin: consulta no tiene esa regla.
 */
function mensajeDeCarga(err: unknown, fallback: string) {
  const raw = err instanceof Error ? err.message : ''
  if (/insufficient permissions|permission-denied/i.test(raw)) {
    return 'Tu usuario no tiene permiso para leer esos datos.'
  }
  return raw || fallback
}

export function useConfigOperativaBootstrap() {
  const { perfil } = useAcceso()
  const puedePlan = vePermisosDeTodos(perfil?.rol)
  const [estado, setEstado] = useState<EstadoCarga>(() =>
    isFirebaseReady() ? 'loading' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      if (isDesignPreview) {
        bootstrapDesignPreview()
        if (cancelado) return
        setFirebaseOk(false)
        setError(null)
        setEstado('ready')
        return
      }

      setEstado('loading')
      setError(null)

      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)

      if (!ready) {
        const status = await fetchFirebaseStatus()
        if (cancelado) return
        hydratePlanesAnuales({}, {})
        setError(
          status
            ? `Firebase no configurado. ${formatFirebaseStatus(status)}`
            : 'Firebase no configurado. Define VITE_FIREBASE_* o .env.local.',
        )
        setEstado('error')
        return
      }

      try {
        const [config, agentes] = await Promise.all([
          cargarConfigOperativa(),
          getAgentes(),
        ])
        if (cancelado) return
        hydratePuestosYMinimos(config.puestos, config.minimosSemana)
        hydrateEventos(config.eventos)
        hydrateAgentes(agentes)
        hydrateTiposPermiso(config.tiposPermiso)

        if (puedePlan) {
          try {
            const planes = await getPlanesAnuales(agentes)
            if (cancelado) return
            hydratePlanesAnuales(planes.planes, planes.objetivos)
          } catch (err) {
            if (cancelado) return
            const mensaje = mensajeDeCarga(
              err,
              'No se pudo cargar el plan anual desde Firestore',
            )
            marcarErrorCargaPlan(mensaje)
            console.error('[bootstrap] No se pudo cargar el plan anual', err)
            setError(mensaje)
          }
        } else {
          hydratePlanesAnuales({}, {})
        }

        setEstado('ready')
      } catch (err) {
        if (cancelado) return
        const mensaje = mensajeDeCarga(
          err,
          'No se pudo cargar la configuración operativa desde Firestore',
        )
        marcarErrorCargaPlan(mensaje)
        setError(mensaje)
        setEstado('error')
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [puedePlan])

  return { estado, error, firebaseOk }
}
