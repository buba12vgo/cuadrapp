import { useCallback, useSyncExternalStore } from 'react'
import { generarPlanAnual, type PlanAnual } from '@/lib/generarPlanAnual'
import { mockAgentes } from '@/lib/mockData'

function clonarPlan(plan: PlanAnual): PlanAnual {
  const copia: PlanAnual = {}
  for (const [id, fila] of Object.entries(plan)) {
    copia[id] = [...fila]
  }
  return copia
}

let planAnual = clonarPlan(generarPlanAnual(mockAgentes))
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return planAnual
}

export function usePlanAnual() {
  const plan = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setPlanAnual = useCallback(
    (next: PlanAnual | ((actual: PlanAnual) => PlanAnual)) => {
      planAnual = clonarPlan(typeof next === 'function' ? next(planAnual) : next)
      emit()
    },
    [],
  )

  return [plan, setPlanAnual] as const
}
