import { diasDelMes } from '@/lib/convenio'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import type { Turno } from '@/types'

/** Días del mes anterior que se consultan para fatiga y salida de noche. */
export const COLA_DIAS_BORDE_MES = 14

export function mesCalendarioAnterior(anio: number, mes: number) {
  if (mes === 1) return { anio: anio - 1, mes: 12 }
  return { anio, mes: mes - 1 }
}

export function colaMesAnteriorPorAgente(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  anio: number,
  mes: number,
  maxDias = COLA_DIAS_BORDE_MES,
): Record<string, Turno[]> {
  const nDias = diasDelMes(anio, mes)
  const tail = Math.min(maxDias, nDias)
  const cola: Record<string, Turno[]> = {}
  for (const id of agenteIds) {
    const fila = cuadrante[id] ?? []
    cola[id] = fila.slice(Math.max(0, fila.length - tail))
  }
  return cola
}
