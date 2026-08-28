import { useCallback, useSyncExternalStore } from 'react'
import {
  generarPlanAnual,
  type MarcasPlanAnual,
  type ObjetivosGlobales,
  type PlanAnual,
} from '@/lib/generarPlanAnual'
import { ANIO_REFERENCIA_VACACIONES_DEFECTO } from '@/lib/vacaciones'

export const OBJETIVOS_PLAN_DEFECTO: ObjetivosGlobales = {
  M: 34,
  T: 33,
  N: 33,
}

function clonarPlan(plan: PlanAnual): PlanAnual {
  const copia: PlanAnual = {}
  for (const [id, fila] of Object.entries(plan)) {
    copia[id] = [...fila]
  }
  return copia
}

function clonarObjetivos(objetivos: ObjetivosGlobales): ObjetivosGlobales {
  return { M: objetivos.M, T: objetivos.T, N: objetivos.N }
}

const PLAN_VACIO: PlanAnual = {}

let anioActivo = ANIO_REFERENCIA_VACACIONES_DEFECTO
let planesPorAnio: Record<number, PlanAnual> = {}
let marcasPorAnio: Record<number, MarcasPlanAnual | null> = {}
let objetivosPorAnio: Record<number, ObjetivosGlobales> = {}
let planCargado = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return anioActivo
}

function planSnapshot() {
  return planesPorAnio[anioActivo] ?? PLAN_VACIO
}

function marcasSnapshot() {
  return marcasPorAnio[anioActivo] ?? null
}

function objetivosSnapshot() {
  return objetivosPorAnio[anioActivo] ?? OBJETIVOS_PLAN_DEFECTO
}

function cargadoSnapshot() {
  return planCargado
}

export function planParaAnio(anio: number) {
  const plan = planesPorAnio[anio]
  return plan ? clonarPlan(plan) : PLAN_VACIO
}

export function tienePlanParaAnio(anio: number) {
  return Object.keys(planesPorAnio[anio] ?? {}).length > 0
}

export function planAnualEstaCargado() {
  return planCargado
}

export function hydratePlanesAnuales(
  planes: Record<number, PlanAnual>,
  objetivos: Record<number, ObjetivosGlobales> = {},
) {
  const siguientesPlanes: Record<number, PlanAnual> = {}
  for (const [clave, plan] of Object.entries(planes)) {
    siguientesPlanes[Number(clave)] = clonarPlan(plan)
  }
  const siguientesObjetivos: Record<number, ObjetivosGlobales> = {}
  for (const [clave, valor] of Object.entries(objetivos)) {
    siguientesObjetivos[Number(clave)] = clonarObjetivos(valor)
  }
  planesPorAnio = siguientesPlanes
  objetivosPorAnio = siguientesObjetivos
  planCargado = true
  emit()
}

export function usePlanAnual() {
  const anio = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  const plan = useSyncExternalStore(subscribe, planSnapshot, planSnapshot)
  const marcas = useSyncExternalStore(subscribe, marcasSnapshot, marcasSnapshot)
  const objetivos = useSyncExternalStore(
    subscribe,
    objetivosSnapshot,
    objetivosSnapshot,
  )
  const cargado = useSyncExternalStore(
    subscribe,
    cargadoSnapshot,
    cargadoSnapshot,
  )

  const setAnio = useCallback((siguiente: number) => {
    anioActivo = siguiente
    emit()
  }, [])

  const setPlanAnual = useCallback(
    (next: PlanAnual | ((actual: PlanAnual) => PlanAnual)) => {
      const actual = planesPorAnio[anioActivo] ?? {}
      planesPorAnio[anioActivo] = clonarPlan(
        typeof next === 'function' ? next(actual) : next,
      )
      emit()
    },
    [],
  )

  const setObjetivos = useCallback((siguiente: ObjetivosGlobales) => {
    objetivosPorAnio[anioActivo] = clonarObjetivos(siguiente)
    emit()
  }, [])

  const setMarcas = useCallback((siguiente: MarcasPlanAnual | null) => {
    marcasPorAnio[anioActivo] = siguiente
    emit()
  }, [])

  const registrarPlan = useCallback(
    (
      anioPlan: number,
      plan: PlanAnual,
      marcasPlan: MarcasPlanAnual,
      activar = true,
    ) => {
      planesPorAnio[anioPlan] = clonarPlan(plan)
      marcasPorAnio[anioPlan] = marcasPlan
      if (activar) anioActivo = anioPlan
      emit()
    },
    [],
  )

  return {
    anio,
    plan,
    marcas,
    objetivos,
    cargado,
    setAnio,
    setPlanAnual,
    setObjetivos,
    setMarcas,
    registrarPlan,
  }
}

/** Solo rellena el año indicado si aún no existe; no toca otros años. */
export function inicializarPlanAnual(
  agentes: Parameters<typeof generarPlanAnual>[0],
  anio = ANIO_REFERENCIA_VACACIONES_DEFECTO,
  objetivos?: Parameters<typeof generarPlanAnual>[1],
) {
  if (tienePlanParaAnio(anio)) return
  const resultado = generarPlanAnual(
    agentes,
    objetivos,
    anio,
    planParaAnio(anio - 1),
  )
  planesPorAnio[anio] = clonarPlan(resultado.plan)
  marcasPorAnio[anio] = resultado.marcas
  emit()
}
