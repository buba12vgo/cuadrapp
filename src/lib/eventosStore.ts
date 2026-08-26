import { useCallback, useSyncExternalStore } from 'react'
import type { EventoOperativo } from '@/types'

function clonarEvento(evento: EventoOperativo): EventoOperativo {
  const modificadoresMinimos: EventoOperativo['modificadoresMinimos'] = {}
  for (const [puesto, turnos] of Object.entries(evento.modificadoresMinimos)) {
    modificadoresMinimos[puesto] = { ...turnos }
  }
  return { ...evento, modificadoresMinimos }
}

function clonarEventos(eventos: EventoOperativo[]) {
  return eventos.map(clonarEvento)
}

let eventosData: EventoOperativo[] = []
let eventosCargados = false
const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return eventosData
}

export function eventosEstanCargados() {
  return eventosCargados
}

export function hydrateEventos(eventos: EventoOperativo[]) {
  eventosData = clonarEventos(eventos)
  eventosCargados = true
  emit()
}

export function useEventosData() {
  const eventos = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setEventosData = useCallback(
    (
      next:
        | EventoOperativo[]
        | ((actual: EventoOperativo[]) => EventoOperativo[]),
    ) => {
      eventosData = clonarEventos(
        typeof next === 'function' ? next(eventosData) : next,
      )
      emit()
    },
    [],
  )

  return [eventos, setEventosData] as const
}

export function eventoPorFecha(eventos: EventoOperativo[], fecha: string) {
  return eventos.find((evento) => evento.fecha === fecha)
}
