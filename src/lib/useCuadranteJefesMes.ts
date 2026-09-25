import { useEffect, useMemo, useState } from 'react'
import { useAgentesData } from '@/lib/agentesStore'
import type { AsignacionesDiarias } from '@/lib/calendarioPuestos'
import {
  cuadranteDesdeFirestore,
  cuadranteVacio,
} from '@/lib/cuadranteFirestore'
import { diasDelMes } from '@/lib/convenio'
import { getAgentes, getCuadranteJefes } from '@/lib/db'
import { useEventosData } from '@/lib/eventosStore'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { useTiposPermiso } from '@/lib/permisosStore'
import { usePuestosData } from '@/lib/puestosStore'
import { agentesCuadranteJefes } from '@/lib/rolesCuadrante'

/** Lectura del cuadrante de jefes y responsables. No escribe. */
export function useCuadranteJefesMes(anio: number, mes: number) {
  const [agentesData, setAgentesData] = useAgentesData()
  const [puestos] = usePuestosData()
  const [tiposPermiso] = useTiposPermiso()
  const [eventos] = useEventosData()
  const [cuadrante, setCuadrante] = useState<CuadranteMensual>({})
  const [asignaciones, setAsignaciones] = useState<AsignacionesDiarias>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())

  const jefes = useMemo(
    () => agentesCuadranteJefes(agentesData),
    [agentesData],
  )
  const jefesIdsKey = jefes.map((agente) => agente.id).join('\0')
  const nDias = diasDelMes(anio, mes)

  useEffect(() => {
    let cancelado = false
    async function cargarAgentes() {
      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)
      if (!ready) return
      try {
        const lista = await getAgentes()
        if (!cancelado) setAgentesData(lista)
      } catch {
        /* la plantilla de sesión sigue valiendo */
      }
    }
    void cargarAgentes()
    return () => {
      cancelado = true
    }
  }, [setAgentesData])

  useEffect(() => {
    let cancelado = false
    async function cargar() {
      setLoading(true)
      setError(null)
      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)
      if (!ready || jefes.length === 0) {
        setCuadrante(jefes.length > 0 ? cuadranteVacio(jefes, nDias) : {})
        setAsignaciones({})
        setLoading(false)
        return
      }
      try {
        const datos = await getCuadranteJefes(mes, anio)
        if (cancelado) return
        if (datos) {
          const cargado = cuadranteDesdeFirestore(datos, jefes, anio, mes, nDias, {
            puestos,
            permisos: tiposPermiso,
            migrarLibranzaAPermiso: true,
          })
          setCuadrante(cargado.cuadrante)
          setAsignaciones(cargado.asignaciones)
        } else {
          setCuadrante(cuadranteVacio(jefes, nDias))
          setAsignaciones({})
        }
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el cuadrante',
          )
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelado = true
    }
  }, [anio, mes, nDias, jefesIdsKey, jefes, puestos, tiposPermiso])

  return {
    jefes,
    cuadrante,
    asignaciones,
    eventos,
    puestos,
    tiposPermiso,
    loading,
    error,
    firebaseOk,
    nDias,
  }
}
