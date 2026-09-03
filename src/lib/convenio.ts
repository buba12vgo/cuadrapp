import type { Turno } from '@/types'

/** Días operativos del convenio en meses de 30 o 31 días. */
export const DIAS_OPERATIVOS_ESTANDAR = 17

/** Días operativos del convenio en febrero (28 o 29 días). */
export const DIAS_OPERATIVOS_FEBRERO = 16

/** Tope de jornadas seguidas. El sexto día es D obligatorio. */
export const MAX_DIAS_CONTINUOS = 5

/** Un D suelto está prohibido: mínimo 2 descansos contiguos. */
export const MIN_DESCANSO_SEGUIDO = 2

/** Tras un bloque de noches, mínimo 3 D antes de una M. */
export const MIN_DESCANSO_TRAS_NOCHE = 3

/** `mes` es 1–12. */
export function diasDelMes(anio: number, mes: number) {
  return new Date(anio, mes, 0).getDate()
}

/** `mes` es 1–12. Febrero = 16; resto = 17. */
export function diasOperativosConvenio(_anio: number, mes: number) {
  return mes === 2 ? DIAS_OPERATIVOS_FEBRERO : DIAS_OPERATIVOS_ESTANDAR
}

export function esDiaTrabajado(turno: Turno | undefined) {
  return turno != null && turno !== 'D' && turno !== 'V'
}

export function totalTrabajados(fila: Turno[]) {
  let n = 0
  for (const turno of fila) {
    if (esDiaTrabajado(turno)) n += 1
  }
  return n
}

export function esFinDeSemana(anio: number, mes: number, dia: number) {
  const weekday = new Date(anio, mes - 1, dia).getDay()
  return weekday === 0 || weekday === 6
}

export function totalFindesTrabajados(
  fila: Turno[],
  anio: number,
  mes: number,
) {
  let n = 0
  for (let i = 0; i < fila.length; i++) {
    if (!esDiaTrabajado(fila[i])) continue
    if (esFinDeSemana(anio, mes, i + 1)) n += 1
  }
  return n
}
