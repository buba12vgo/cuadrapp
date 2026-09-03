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

/** El mes de la ficha es siempre el de 2026; el resto de años rota desde ahí. */
export function anioReferenciaVacaciones(_agente?: FichaPolicia) {
  return ANIO_REFERENCIA_VACACIONES_DEFECTO
}

export function mesSiguienteCicloVacaciones(
  mes: FichaPolicia['mesAnclaVacaciones'],
): FichaPolicia['mesAnclaVacaciones'] {
  const base = MESES_VACACIONES_CICLO.indexOf(mes)
  const indice = base < 0 ? 0 : (base + 1) % MESES_VACACIONES_CICLO.length
  return MESES_VACACIONES_CICLO[indice]
}

/** Mes del ciclo Jun–Jul–Sep–Ago que corresponde al año indicado. */
export function mesVacacionesCiclo(
  agente: FichaPolicia,
  anio: number,
): FichaPolicia['mesAnclaVacaciones'] {
  const base = MESES_VACACIONES_CICLO.indexOf(agente.mesAnclaVacaciones)
  const origen = base < 0 ? 0 : base
  const anioRef = anioReferenciaVacaciones(agente)
  const offset = ((anio - anioRef) % 4 + 4) % 4
  return MESES_VACACIONES_CICLO[(origen + offset) % 4]
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
