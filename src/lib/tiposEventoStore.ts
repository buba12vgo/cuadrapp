import { useCallback, useSyncExternalStore } from 'react'
import { crearCanalStore } from '@/lib/storeExterno'
import {
  TIPOS_EVENTO_INICIALES,
  clonarTipoEvento,
  ordenarTiposEvento,
  type TipoEventoConfig,
} from '@/lib/tiposEvento'

function clonarTipos(tipos: TipoEventoConfig[]) {
  return ordenarTiposEvento(tipos.map(clonarTipoEvento))
}

let tiposData = clonarTipos(TIPOS_EVENTO_INICIALES)
let tiposCargados = false
const { emit, subscribe } = crearCanalStore()

function getSnapshot() {
  return tiposData
}

export function getTiposEvento(): TipoEventoConfig[] {
  return tiposData
}

export function tiposEventoEstanCargados() {
  return tiposCargados
}

export function hydrateTiposEvento(tipos: TipoEventoConfig[]) {
  tiposData = clonarTipos(tipos.length > 0 ? tipos : TIPOS_EVENTO_INICIALES)
  tiposCargados = true
  emit()
}

export function useTiposEvento() {
  const tipos = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)

  const setTiposEvento = useCallback(
    (
      next:
        | TipoEventoConfig[]
        | ((actual: TipoEventoConfig[]) => TipoEventoConfig[]),
    ) => {
      tiposData = clonarTipos(
        typeof next === 'function' ? next(tiposData) : next,
      )
      emit()
    },
    [],
  )

  return [tipos, setTiposEvento] as const
}
