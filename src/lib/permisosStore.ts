import { useCallback, useSyncExternalStore } from 'react'
import {
  PERMISOS_INICIALES,
  clonarPermiso,
  type PermisoConfig,
} from '@/lib/permisos'

function clonarPermisos(permisos: PermisoConfig[]) {
  return permisos.map(clonarPermiso)
}

let permisosData = clonarPermisos(PERMISOS_INICIALES)
let permisosCargados = false

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getSnapshot() {
  return permisosData
}

export function getTiposPermiso(): PermisoConfig[] {
  return permisosData
}

export function tiposPermisoCargados() {
  return permisosCargados
}

export function hydrateTiposPermiso(permisos: PermisoConfig[]) {
  permisosData = clonarPermisos(permisos)
  permisosCargados = true
  emit()
}

export function useTiposPermiso() {
  const permisos = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setTiposPermiso = useCallback(
    (
      next:
        | PermisoConfig[]
        | ((actual: PermisoConfig[]) => PermisoConfig[]),
    ) => {
      permisosData = clonarPermisos(
        typeof next === 'function' ? next(permisosData) : next,
      )
      emit()
    },
    [],
  )

  return [permisos, setTiposPermiso] as const
}
