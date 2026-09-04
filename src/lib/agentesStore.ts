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
let agentesCargados = false
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

export function agentesEstanCargados() {
  return agentesCargados
}

export function hydrateAgentes(agentes: FichaPolicia[]) {
  const mismos =
    agentesCargados &&
    agentes.length === agentesData.length &&
    agentes.every((agente, i) => agente.id === agentesData[i]?.id)
  if (mismos) return
  agentesData = clonarAgentes(agentes)
  agentesCargados = true
  emit()
}

export function useAgentesData() {
  const agentes = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setAgentesData = useCallback(
    (
      next:
        | FichaPolicia[]
        | ((actual: FichaPolicia[]) => FichaPolicia[]),
    ) => {
      const resuelto =
        typeof next === 'function' ? next(agentesData) : next
      const mismos =
        agentesCargados &&
        resuelto.length === agentesData.length &&
        resuelto.every((agente, i) => agente.id === agentesData[i]?.id)
      if (mismos) return
      agentesData = clonarAgentes(resuelto)
      agentesCargados = true
      emit()
    },
    [],
  )

  return [agentes, setAgentesData] as const
}
