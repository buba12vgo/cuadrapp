import { useCallback, useSyncExternalStore } from 'react'
import {
  PUESTOS_INICIALES,
  clonarMinimos,
  clonarMinimosSemana,
  crearMinimosSemana,
  nombresPuestos,
  type MinimosDia,
  type MinimosPuesto,
  type MinimosSemana,
  type PuestoConfig,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'

function clonarPuesto(puesto: PuestoConfig): PuestoConfig {
  return { ...puesto }
}

function clonarPuestos(puestos: PuestoConfig[]) {
  return puestos.map(clonarPuesto)
}

function alinearMinimosDia(
  minimos: MinimosDia,
  puestos: PuestoConfig[],
  plantilla?: MinimosDia,
): MinimosDia {
  const copia: MinimosDia = {}
  for (const puesto of puestos) {
    copia[puesto.nombre] = clonarMinimosPuesto(
      minimos[puesto.nombre] ??
        plantilla?.[puesto.nombre] ?? { M: 1, T: 1, N: 1 },
    )
  }
  return copia
}

function clonarMinimosPuesto(minimos: MinimosPuesto): MinimosPuesto {
  return { M: minimos.M, T: minimos.T, N: minimos.N }
}

function alinearMinimosSemana(
  semana: MinimosSemana,
  puestos: PuestoConfig[],
): MinimosSemana {
  const plantilla = semana[1]
  return {
    1: alinearMinimosDia(semana[1], puestos, plantilla),
    2: alinearMinimosDia(semana[2], puestos, plantilla),
    3: alinearMinimosDia(semana[3], puestos, plantilla),
    4: alinearMinimosDia(semana[4], puestos, plantilla),
    5: alinearMinimosDia(semana[5], puestos, plantilla),
    6: alinearMinimosDia(semana[6], puestos, plantilla),
    7: alinearMinimosDia(semana[7], puestos, plantilla),
  }
}

let puestosData = clonarPuestos(PUESTOS_INICIALES)
let minimosSemanaData = crearMinimosSemana(puestosData)

const listeners = new Set<() => void>()

function emit() {
  for (const listener of listeners) listener()
}

function subscribe(listener: () => void) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

function getPuestosSnapshot() {
  return puestosData
}

function getMinimosSnapshot() {
  return minimosSemanaData
}

export function getPuestos(): PuestoConfig[] {
  return puestosData
}

export function getMinimosSemana(): MinimosSemana {
  return minimosSemanaData
}

export function usePuestosData() {
  const puestos = useSyncExternalStore(
    subscribe,
    getPuestosSnapshot,
    getPuestosSnapshot,
  )

  const setPuestosData = useCallback(
    (
      next: PuestoConfig[] | ((actual: PuestoConfig[]) => PuestoConfig[]),
    ) => {
      const lista = clonarPuestos(
        typeof next === 'function' ? next(puestosData) : next,
      )
      puestosData = lista
      minimosSemanaData = alinearMinimosSemana(minimosSemanaData, lista)
      emit()
    },
    [],
  )

  return [puestos, setPuestosData] as const
}

export function useMinimosSemanaData() {
  const minimos = useSyncExternalStore(
    subscribe,
    getMinimosSnapshot,
    getMinimosSnapshot,
  )

  const setMinimosSemanaData = useCallback(
    (
      next: MinimosSemana | ((actual: MinimosSemana) => MinimosSemana),
    ) => {
      const semana = clonarMinimosSemana(
        typeof next === 'function' ? next(minimosSemanaData) : next,
      )
      minimosSemanaData = alinearMinimosSemana(semana, puestosData)
      emit()
    },
    [],
  )

  return [minimos, setMinimosSemanaData] as const
}

export function actualizarMinimo(
  dia: keyof MinimosSemana,
  puestoNombre: string,
  turno: TurnoOperativo,
  valor: number,
) {
  minimosSemanaData = {
    ...clonarMinimosSemana(minimosSemanaData),
    [dia]: {
      ...clonarMinimos(minimosSemanaData[dia], nombresPuestos(puestosData)),
      [puestoNombre]: {
        ...clonarMinimosPuesto(
          minimosSemanaData[dia][puestoNombre] ?? { M: 0, T: 0, N: 0 },
        ),
        [turno]: valor,
      },
    },
  }
  emit()
}

export function copiarMinimosDiaATodaLaSemana(diaOrigen: keyof MinimosSemana) {
  const origen = clonarMinimos(
    minimosSemanaData[diaOrigen],
    nombresPuestos(puestosData),
  )
  minimosSemanaData = {
    1: clonarMinimos(origen),
    2: clonarMinimos(origen),
    3: clonarMinimos(origen),
    4: clonarMinimos(origen),
    5: clonarMinimos(origen),
    6: clonarMinimos(origen),
    7: clonarMinimos(origen),
  }
  emit()
}

export function renombrarPuestoEnMinimos(
  nombreAnterior: string,
  nombreNuevo: string,
) {
  if (nombreAnterior === nombreNuevo) return
  const semana = clonarMinimosSemana(minimosSemanaData)
  for (const dia of [1, 2, 3, 4, 5, 6, 7] as const) {
    const diaMin = semana[dia]
    if (diaMin[nombreAnterior]) {
      diaMin[nombreNuevo] = diaMin[nombreAnterior]
      delete diaMin[nombreAnterior]
    }
  }
  minimosSemanaData = semana
  emit()
}
