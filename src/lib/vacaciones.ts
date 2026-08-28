import type { FichaPolicia } from '@/types'

export const MESES_VACACIONES_CICLO = [
  'JUNIO',
  'JULIO',
  'SEPTIEMBRE',
  'AGOSTO',
] as const satisfies ReadonlyArray<FichaPolicia['mesAnclaVacaciones']>

export const ANIO_REFERENCIA_VACACIONES_DEFECTO = 2026

/** Índice de mes 0–11 (enero = 0). */
export const INDICE_MES_VACACIONES: Record<
  FichaPolicia['mesAnclaVacaciones'],
  number
> = {
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
}

export function anioReferenciaVacaciones(agente: FichaPolicia) {
  return agente.anioReferenciaVacaciones ?? ANIO_REFERENCIA_VACACIONES_DEFECTO
}

/** Mes del ciclo Jun–Jul–Sep–Ago que corresponde al año indicado. */
export function mesVacacionesCiclo(
  agente: FichaPolicia,
  anio: number,
): FichaPolicia['mesAnclaVacaciones'] {
  const base = MESES_VACACIONES_CICLO.indexOf(agente.mesAnclaVacaciones)
  const anioRef = anioReferenciaVacaciones(agente)
  const offset = ((anio - anioRef) % 4 + 4) % 4
  return MESES_VACACIONES_CICLO[(base + offset) % 4]
}

/** Índice 0–11 del primer mes de vacaciones en el año del plan. */
export function indiceMesVacacionesEfectivo(
  agente: FichaPolicia,
  anio: number,
) {
  return INDICE_MES_VACACIONES[mesVacacionesCiclo(agente, anio)]
}

/** Meses 0–11 con V según objetivo y rotación (consecutivos en calendario). */
export function mesesVacacionesEnPlan(
  agente: FichaPolicia,
  anio: number,
  cantidad: number,
) {
  if (cantidad <= 0) return []
  const inicio = indiceMesVacacionesEfectivo(agente, anio)
  const meses: number[] = []
  for (let i = 0; i < cantidad && i < 12; i++) {
    meses.push((inicio + i) % 12)
  }
  return meses
}

export const ETIQUETA_MES_VACACIONES: Record<
  FichaPolicia['mesAnclaVacaciones'],
  string
> = {
  JUNIO: 'Junio',
  JULIO: 'Julio',
  AGOSTO: 'Agosto',
  SEPTIEMBRE: 'Septiembre',
}
