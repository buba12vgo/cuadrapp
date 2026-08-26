import { useEffect, useState } from 'react'
import { cargarConfigOperativa } from '@/lib/db'
import { hydrateEventos } from '@/lib/eventosStore'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import {
  fetchFirebaseStatus,
  formatFirebaseStatus,
} from '@/lib/firebaseStatus'
import { hydratePuestosYMinimos } from '@/lib/puestosStore'

type EstadoCarga = 'idle' | 'loading' | 'ready' | 'error'

/**
 * Carga puestos, mínimos semanales y eventos desde Firestore una vez
 * por sesión de admin. Siembra puestos/mínimos por defecto si están vacíos.
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
        setError(
          status
            ? `Firebase no configurado. ${formatFirebaseStatus(status)}`
            : 'Firebase no configurado. Define VITE_FIREBASE_* o .env.local.',
        )
        setEstado('error')
        return
      }

      try {
        const config = await cargarConfigOperativa()
        if (cancelado) return
        hydratePuestosYMinimos(config.puestos, config.minimosSemana)
        hydrateEventos(config.eventos)
        setEstado('ready')
      } catch (err) {
        if (cancelado) return
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
