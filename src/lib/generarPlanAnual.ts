import type { FichaPolicia } from '@/types'

export type TurnoAnual = 'M' | 'T' | 'N' | 'V'
export type ObjetivosGlobales = { M: number; T: number; N: number }
export type PlanAnual = Record<string, TurnoAnual[]>

const MESES = 12

const MES_ANCLA: Record<FichaPolicia['mesAnclaVacaciones'], number> = {
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
}

type Cupos = { M: number; T: number; N: number }
type Fila = (TurnoAnual | null)[]

function distCircular(a: number, b: number) {
  const d = Math.abs(a - b)
  return Math.min(d, MESES - d)
}

function huecos(fila: Fila) {
  const meses: number[] = []
  for (let mes = 0; mes < MESES; mes++) {
    if (fila[mes] == null) meses.push(mes)
  }
  return meses
}

function puedeNoche(fila: Fila, mes: number, minDist: number) {
  if (fila[mes] != null) return false
  for (let otro = 0; otro < MESES; otro++) {
    if (fila[otro] !== 'N') continue
    if (distCircular(mes, otro) < minDist) return false
  }
  return true
}

function cuposLaborales(agente: FichaPolicia, libres: number): Cupos {
  const lim = agente.limitaciones
  let M = agente.preferenciaAnual.objetivoM
  let T = agente.preferenciaAnual.objetivoT
  let N = agente.preferenciaAnual.objetivoN

  if (libres <= 0) return { M: 0, T: 0, N: 0 }
  if (lim.soloManana) return { M: libres, T: 0, N: 0 }

  if (lim.soloMananaNoche) {
    N = Math.min(Math.max(0, N), libres)
    return { M: libres - N, T: 0, N }
  }

  if (lim.exentoNoches) {
    T = Math.min(Math.max(0, T), libres)
    return { M: libres - T, T, N: 0 }
  }

  M = Math.max(0, M)
  T = Math.max(0, T)
  N = Math.max(0, N)
  const suma = M + T + N
  if (suma === 0) return { M: libres, T: 0, N: 0 }
  if (suma > libres) {
    N = Math.min(N, libres)
    T = Math.min(T, libres - N)
    M = libres - N - T
  } else if (suma < libres) {
    M += libres - suma
  }
  return { M, T, N }
}

function capacidadN(fila: Fila, minDist: number) {
  let mejor = 0
  for (const invertido of [false, true]) {
    for (let fase = 0; fase < minDist; fase++) {
      const copia = [...fila]
      let n = 0
      for (let k = 0; k < MESES; k++) {
        const mes = invertido
          ? (fase - k + MESES * 2) % MESES
          : (fase + k) % MESES
        if (!puedeNoche(copia, mes, minDist)) continue
        copia[mes] = 'N'
        n += 1
      }
      mejor = Math.max(mejor, n)
    }
  }
  return mejor
}

function asignarFila(agente: FichaPolicia): TurnoAnual[] {
  const fila: Fila = Array.from({ length: MESES }, () => null)
  fila[MES_ANCLA[agente.mesAnclaVacaciones]] = 'V'

  const cupos = cuposLaborales(agente, huecos(fila).length)
  const minDists = cupos.N <= capacidadN(fila, 3) ? [3] : [2]

  for (const minDist of minDists) {
    for (const invertido of [false, true]) {
      if (cupos.N <= 0) break
      const candidatos = invertido ? [...huecos(fila)].reverse() : huecos(fila)
      for (const mes of candidatos) {
        if (cupos.N <= 0) break
        if (!puedeNoche(fila, mes, minDist)) continue
        fila[mes] = 'N'
        cupos.N -= 1
      }
    }
  }

  cupos.T += cupos.N
  cupos.N = 0

  for (const mes of huecos(fila)) {
    if (cupos.T <= 0) break
    fila[mes] = 'T'
    cupos.T -= 1
  }

  for (const mes of huecos(fila)) {
    fila[mes] = 'M'
  }

  return fila.map((turno) => turno ?? 'M')
}

export function generarPlanAnual(agentes: FichaPolicia[]): PlanAnual {
  const plan: PlanAnual = {}
  for (const agente of agentes) {
    plan[agente.id] = asignarFila(agente)
  }
  return plan
}

export function cicloRotacion(agente: FichaPolicia): TurnoAnual[] {
  if (agente.limitaciones.soloManana) return ['M', 'V']
  if (agente.limitaciones.soloMananaNoche) return ['M', 'N', 'V']
  if (agente.limitaciones.exentoNoches) return ['M', 'T', 'V']
  return ['M', 'T', 'N', 'V']
}

export function siguienteTurno(agente: FichaPolicia, actual: TurnoAnual) {
  const ciclo = cicloRotacion(agente)
  const indice = ciclo.indexOf(actual)
  if (indice < 0) return ciclo[0]
  return ciclo[(indice + 1) % ciclo.length]
}

export function vacacionesObjetivo(agente: FichaPolicia) {
  const { objetivoM, objetivoT, objetivoN } = agente.preferenciaAnual
  return 12 - objetivoM - objetivoT - objetivoN
}
