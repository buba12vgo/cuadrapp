import type { Turno } from '@/types'
import type { PlanAnual, TurnoAnual } from '@/lib/generarPlanAnual'
import {
  MAX_DIAS_CONTINUOS,
  MIN_DESCANSO_SEGUIDO,
  MIN_DESCANSO_TRAS_NOCHE,
  diasDelMes,
  diasOperativosConvenio,
  esDiaTrabajado,
} from '@/lib/convenio'
import { equilibrarFindesConsecutivos } from '@/lib/finesSemana'

export type CuadranteMensual = Record<string, Turno[]>

function bloquesTrabajo(nLaborables: number, maxBloque: number) {
  const bloques: number[] = []
  let restante = nLaborables
  while (restante > 0) {
    if (restante > maxBloque && restante - maxBloque === 1) {
      bloques.push(maxBloque - 1)
      restante -= maxBloque - 1
    } else {
      const tam = Math.min(maxBloque, restante)
      bloques.push(tam)
      restante -= tam
    }
  }
  return bloques
}

function snapDescanso(valor: number) {
  if (valor <= 0) return 0
  if (valor === 1) return 0
  return valor
}

function repartirDescansos(
  nBloques: number,
  nDescanso: number,
  minEntre: number,
  offsetInicio: number,
) {
  const huecos = nBloques + 1
  const descansos = Array.from({ length: huecos }, () => 0)
  const nEntre = Math.max(0, nBloques - 1)
  let resto = nDescanso

  let min = minEntre
  if (nEntre * min > resto) min = MIN_DESCANSO_SEGUIDO
  if (nEntre * min > resto) min = 0

  for (let i = 1; i <= nEntre; i++) {
    const add = Math.min(min, resto)
    descansos[i] = add
    resto -= add
  }

  let inicio = snapDescanso(Math.min(offsetInicio, resto))
  if (inicio > 0 && inicio < MIN_DESCANSO_SEGUIDO) {
    inicio = resto >= MIN_DESCANSO_SEGUIDO ? MIN_DESCANSO_SEGUIDO : 0
  }
  if (inicio > resto) inicio = snapDescanso(resto)
  descansos[0] = inicio
  resto -= inicio

  if (resto === 1) {
    const hueco = nEntre >= 1 ? 1 : 0
    descansos[hueco] += 1
    resto = 0
  }

  descansos[huecos - 1] += resto
  if (descansos[huecos - 1] === 1) {
    descansos[huecos - 1] = 0
    descansos[Math.max(0, huecos - 2)] += 1
  }

  return descansos
}

function construirFila(
  turno: Exclude<TurnoAnual, 'V'>,
  nDias: number,
  nLaborables: number,
  minEntre: number,
  offsetInicio: number,
): Turno[] {
  const nDescanso = nDias - nLaborables
  const bloques = bloquesTrabajo(nLaborables, MAX_DIAS_CONTINUOS)
  const descansos = repartirDescansos(
    bloques.length,
    nDescanso,
    minEntre,
    offsetInicio,
  )

  const fila: Turno[] = []
  for (let i = 0; i < bloques.length; i++) {
    for (let d = 0; d < (descansos[i] ?? 0); d++) fila.push('D')
    for (let t = 0; t < bloques[i]; t++) fila.push(turno)
  }
  for (let d = 0; d < (descansos[bloques.length] ?? 0); d++) fila.push('D')

  while (fila.length < nDias) fila.push('D')
  if (fila.length > nDias) fila.length = nDias
  return fila
}

/**
 * Reparte exactamente 17 (16 en febrero) jornadas del turno anual.
 * Fatiga ≤ 5, descansos de 2+, y tras noches al menos 3 D entre bloques.
 */
export function generarFilaMensual(
  turnoBase: TurnoAnual,
  anio: number,
  mes: number,
  offsetDescansoInicial = 0,
): Turno[] {
  const nDias = diasDelMes(anio, mes)
  if (turnoBase === 'V') return Array.from({ length: nDias }, () => 'V')

  const nLaborables = diasOperativosConvenio(anio, mes)
  const minEntre =
    turnoBase === 'N' ? MIN_DESCANSO_TRAS_NOCHE : MIN_DESCANSO_SEGUIDO
  const offset = offsetDescansoInicial % 6
  const par = offset <= 1 ? 0 : offset % 2 === 0 ? offset : offset - 1

  const fila = construirFila(turnoBase, nDias, nLaborables, minEntre, par)
  if (turnoBase === 'M' || turnoBase === 'T' || turnoBase === 'N') {
    return equilibrarFindesConsecutivos(fila, anio, mes, turnoBase)
  }
  return fila
}

export function generarCuadranteMensual(
  planAnual: PlanAnual,
  agenteIds: string[],
  anio: number,
  mes: number,
): CuadranteMensual {
  const cuadrante: CuadranteMensual = {}
  agenteIds.forEach((id, indice) => {
    const turnoBase = planAnual[id]?.[mes - 1]
    if (!turnoBase) {
      const nDias = diasDelMes(anio, mes)
      cuadrante[id] = Array.from({ length: nDias }, () => 'D')
      return
    }
    cuadrante[id] = generarFilaMensual(turnoBase, anio, mes, indice * 2)
  })
  return cuadrante
}

export function siguienteTurnoDia(actual: Turno): Turno {
  const ciclo: Turno[] = ['M', 'T', 'N', 'L', 'D', 'V']
  const indice = ciclo.indexOf(actual)
  return ciclo[(indice + 1) % ciclo.length]
}

export function maxDiasContinuos(fila: Turno[]) {
  let max = 0
  let racha = 0
  for (const turno of fila) {
    if (esDiaTrabajado(turno)) {
      racha += 1
      max = Math.max(max, racha)
    } else {
      racha = 0
    }
  }
  return max
}
