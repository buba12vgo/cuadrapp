import { useEffect, useState } from 'react'
import { hydrateAgentes } from '@/lib/agentesStore'
import { cargarConfigOperativa, getAgentes, getPlanesAnuales } from '@/lib/db'
import { hydrateEventos } from '@/lib/eventosStore'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import {
  fetchFirebaseStatus,
  formatFirebaseStatus,
} from '@/lib/firebaseStatus'
import { hydratePlanesAnuales } from '@/lib/planAnualStore'
import { hydratePuestosYMinimos } from '@/lib/puestosStore'

type EstadoCarga = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Carga plantilla, plan anual, puestos, mínimos y eventos desde Firestore
 * una vez por sesión de admin.
 */
export function useConfigOperativaBootstrap() {
  const [estado, setEstado] = useState<EstadoCarga>(() =>
    isFirebaseReady() ? 'loading' : 'idle',
  )
  const [error, setError] = useState<string | null>(null)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())

  useEffect(() => {
    let cancelado = false

    async function cargar() {
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

        try {
          const planes = await getPlanesAnuales(agentes)
          if (cancelado) return
          hydratePlanesAnuales(planes.planes, planes.objetivos)
        } catch (err) {
          if (cancelado) return
          hydratePlanesAnuales({}, {})
          console.error('[bootstrap] No se pudo cargar el plan anual', err)
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el plan anual desde Firestore',
          )
        }

        setEstado('ready')
      } catch (err) {
        if (cancelado) return
        hydratePlanesAnuales({}, {})
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar la configuración operativa desde Firestore',
        )
        setEstado('error')
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [])

  return { estado, error, firebaseOk }
}
