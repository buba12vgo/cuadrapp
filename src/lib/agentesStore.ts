import { useCallback, useSyncExternalStore } from 'react'
import { mockAgentes } from '@/lib/mockData'
import type { FichaPolicia } from '@/types'

function clonarAgente(agente: FichaPolicia): FichaPolicia {
  return {
    ...agente,
    limitaciones: { ...agente.limitaciones },
    preferenciaAnual: { ...agente.preferenciaAnual },
    puestosExcluidos: [...agente.puestosExcluidos],
  }
}

function clonarAgentes(agentes: FichaPolicia[]) {
  return agentes.map(clonarAgente)
}

let agentesData = clonarAgentes(mockAgentes)
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return agentesData
}

export function useAgentesData() {
  const agentes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setAgentesData = useCallback(
    (
      next:
        | FichaPolicia[]
        | ((actual: FichaPolicia[]) => FichaPolicia[]),
    ) => {
      agentesData = clonarAgentes(
        typeof next === 'function' ? next(agentesData) : next,
      )
      emit()
    },
    [],
  )

  return [agentes, setAgentesData] as const
}
