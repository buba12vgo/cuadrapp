import { useEffect, useMemo, useState } from 'react'
import { useAgentesData } from '@/lib/agentesStore'
import type { AsignacionesDiarias } from '@/lib/calendarioPuestos'
import {
  cuadranteDesdeFirestore,
  cuadranteVacio,
} from '@/lib/cuadranteFirestore'
import { diasDelMes } from '@/lib/convenio'
import { getAgentes, getCuadrante } from '@/lib/db'
import { useEventosData } from '@/lib/eventosStore'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { useTiposPermiso } from '@/lib/permisosStore'
import { usePuestosData } from '@/lib/puestosStore'
import { agentesOperativosCuadrante } from '@/lib/rolesCuadrante'

/** Lectura del cuadrante mensual operativo. No escribe. */
export function useCuadranteOperativoMes(anio: number, mes: number) {
  const [agentesData, setAgentesData] = useAgentesData()
  const [puestos] = usePuestosData()
  const [tiposPermiso] = useTiposPermiso()
  const [eventos] = useEventosData()
  const [cuadrante, setCuadrante] = useState<CuadranteMensual>({})
  const [asignaciones, setAsignaciones] = useState<AsignacionesDiarias>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())
  const [agentesCargados, setAgentesCargados] = useState(false)

  const operativos = useMemo(
    () => agentesOperativosCuadrante(agentesData),
    [agentesData],
  )
  const idsKey = operativos.map((agente) => agente.id).join('\0')
  const nDias = diasDelMes(anio, mes)

  useEffect(() => {
    let cancelado = false
    async function cargarAgentes() {
      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)
      if (!ready) {
        setAgentesCargados(true)
        return
      }
      try {
        const lista = await getAgentes()
        if (!cancelado) setAgentesData(lista)
      } catch {
        /* la plantilla del store sigue en pantalla */
      } finally {
        if (!cancelado) setAgentesCargados(true)
      }
    }
    void cargarAgentes()
    return () => {
      cancelado = true
    }
  }, [setAgentesData])

  useEffect(() => {
    if (!agentesCargados) return
    let cancelado = false

    async function cargar() {
      setLoading(true)
      setError(null)
      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)
      if (!ready) {
        setCuadrante(cuadranteVacio(operativos, nDias))
        setAsignaciones({})
        setLoading(false)
        return
      }
      try {
        const datos = await getCuadrante(mes, anio)
        if (cancelado) return
        if (datos && operativos.length > 0) {
          const cargado = cuadranteDesdeFirestore(
            datos,
            operativos,
            anio,
            mes,
            nDias,
            { puestos, permisos: tiposPermiso },
          )
          setCuadrante(cargado.cuadrante)
          setAsignaciones(cargado.asignaciones)
        } else {
          setCuadrante(cuadranteVacio(operativos, nDias))
          setAsignaciones({})
        }
      } catch (err) {
        if (cancelado) return
        setError(
          err instanceof Error
            ? err.message
            : 'No se pudo cargar el cuadrante del mes',
        )
        setCuadrante(cuadranteVacio(operativos, nDias))
        setAsignaciones({})
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [agentesCargados, anio, mes, nDias, idsKey, operativos, puestos, tiposPermiso])

  return {
    operativos,
    cuadrante,
    asignaciones,
    puestos,
    eventos,
    loading,
    error,
    firebaseOk,
    agentesCargados,
    nDias,
  }
}
