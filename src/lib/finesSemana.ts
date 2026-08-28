import type { Turno } from '@/types'
import { esDiaTrabajado, esFinDeSemana } from '@/lib/convenio'

/** Máximo de fines de semana laborables seguidos (semanas consecutivas). */
export const MAX_FINDES_CONSECUTIVOS = 2

export function semanaCalendarioId(anio: number, mes: number, dia: number) {
  const fecha = new Date(anio, mes - 1, dia)
  const js = fecha.getDay()
  const lunes = new Date(fecha)
  lunes.setDate(fecha.getDate() - (js === 0 ? 6 : js - 1))
  const y = lunes.getFullYear()
  const m = String(lunes.getMonth() + 1).padStart(2, '0')
  const d = String(lunes.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}

export function semanasDelMes(anio: number, mes: number, nDias: number) {
  const semanas: string[] = []
  const visto = new Set<string>()
  for (let dia = 1; dia <= nDias; dia++) {
    const id = semanaCalendarioId(anio, mes, dia)
    if (!visto.has(id)) {
      visto.add(id)
      semanas.push(id)
    }
  }
  return semanas.sort()
}

export function finDeSemanaLaboradoEnSemana(
  fila: Turno[],
  anio: number,
  mes: number,
  semanaId: string,
) {
  for (let dia = 1; dia <= fila.length; dia++) {
    if (semanaCalendarioId(anio, mes, dia) !== semanaId) continue
    if (!esFinDeSemana(anio, mes, dia)) continue
    if (esDiaTrabajado(fila[dia - 1])) return true
  }
  return false
}

export function maxFindesConsecutivosLaborados(
  fila: Turno[],
  anio: number,
  mes: number,
) {
  const semanas = semanasDelMes(anio, mes, fila.length)
  let maximo = 0
  let racha = 0
  for (const semana of semanas) {
    if (finDeSemanaLaboradoEnSemana(fila, anio, mes, semana)) {
      racha += 1
      maximo = Math.max(maximo, racha)
    } else {
      racha = 0
    }
  }
  return maximo
}

export function finDeSemanaLaboradoEnDia(
  fila: Turno[],
  anio: number,
  mes: number,
  dia: number,
) {
  if (!esFinDeSemana(anio, mes, dia)) return false
  return esDiaTrabajado(fila[dia - 1])
}

/** Intercambia trabajo en finde por descanso entre semana, manteniendo jornadas. */
export function equilibrarFindesConsecutivos(
  fila: Turno[],
  anio: number,
  mes: number,
  turnoTrabajo: Exclude<Turno, 'V' | 'D' | 'L'>,
): Turno[] {
  const copia = [...fila]
  const nDias = copia.length
  const objetivoTrabajo = copia.filter((t) => esDiaTrabajado(t)).length

  for (let iter = 0; iter < 60; iter++) {
    if (maxFindesConsecutivosLaborados(copia, anio, mes) <= MAX_FINDES_CONSECUTIVOS) {
      break
    }

    const semanas = semanasDelMes(anio, mes, nDias)
    let racha = 0
    let semanaObjetivo: string | null = null
    for (const semana of semanas) {
      if (finDeSemanaLaboradoEnSemana(copia, anio, mes, semana)) {
        racha += 1
        if (racha > MAX_FINDES_CONSECUTIVOS) {
          semanaObjetivo = semana
          break
        }
      } else {
        racha = 0
      }
    }
    if (!semanaObjetivo) break

    let intercambiado = false
    for (let diaFinde = 1; diaFinde <= nDias && !intercambiado; diaFinde++) {
      if (semanaCalendarioId(anio, mes, diaFinde) !== semanaObjetivo) continue
      if (!esFinDeSemana(anio, mes, diaFinde)) continue
      if (!esDiaTrabajado(copia[diaFinde - 1])) continue

      for (let diaSemana = 1; diaSemana <= nDias; diaSemana++) {
        if (esFinDeSemana(anio, mes, diaSemana)) continue
        if (copia[diaSemana - 1] !== 'D') continue

        const prueba = [...copia]
        prueba[diaFinde - 1] = 'D'
        prueba[diaSemana - 1] = turnoTrabajo

        if (prueba.filter((t) => esDiaTrabajado(t)).length !== objetivoTrabajo) {
          continue
        }
        if (maxFindesConsecutivosLaborados(prueba, anio, mes) >= racha) {
          continue
        }

        copia[diaFinde - 1] = 'D'
        copia[diaSemana - 1] = turnoTrabajo
        intercambiado = true
        break
      }
    }
    if (!intercambiado) break
  }

  return copia
}
