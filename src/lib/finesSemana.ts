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

/** Sábado+domingo del mismo finde, ambos dentro del mes. */
export type ParFinde = { sabado: number; domingo: number }

export function paresFindeCompletos(
  anio: number,
  mes: number,
  nDias: number,
): ParFinde[] {
  const pares: ParFinde[] = []
  for (let dia = 1; dia <= nDias; dia++) {
    if (new Date(anio, mes - 1, dia).getDay() !== 6) continue
    if (dia + 1 > nDias) continue
    pares.push({ sabado: dia, domingo: dia + 1 })
  }
  return pares
}

function esParFindePartido(fila: Turno[], par: ParFinde) {
  if (fila[par.sabado - 1] === 'V' || fila[par.domingo - 1] === 'V') {
    return false
  }
  return (
    esDiaTrabajado(fila[par.sabado - 1]) !==
    esDiaTrabajado(fila[par.domingo - 1])
  )
}

/** True si hay algún sábado laborable y domingo de descanso (o al revés). */
export function countFindesPartidos(
  fila: Turno[],
  anio: number,
  mes: number,
) {
  return paresFindeCompletos(anio, mes, fila.length).filter((par) =>
    esParFindePartido(fila, par),
  ).length
}

export function esFindePartido(
  fila: Turno[],
  anio: number,
  mes: number,
) {
  return countFindesPartidos(fila, anio, mes) > 0
}

export function esFindePartidoEnDia(
  fila: Turno[],
  anio: number,
  mes: number,
  dia: number,
) {
  if (!esFinDeSemana(anio, mes, dia)) return false
  const pares = paresFindeCompletos(anio, mes, fila.length)
  const par = pares.find((p) => p.sabado === dia || p.domingo === dia)
  if (!par) return false
  return esParFindePartido(fila, par)
}

/** Intercambia un finde entero (sábado+domingo) por descanso entre semana. */
export function equilibrarFindesConsecutivos(
  fila: Turno[],
  anio: number,
  mes: number,
  turnoTrabajo: Exclude<Turno, 'V' | 'D' | 'L'>,
  esValida?: (prueba: Turno[], original: Turno[]) => boolean,
): Turno[] {
  const copia = [...fila]
  const nDias = copia.length
  const objetivoTrabajo = copia.filter((t) => esDiaTrabajado(t)).length

  const valida = (prueba: Turno[]) => {
    if (prueba.filter((t) => esDiaTrabajado(t)).length !== objetivoTrabajo) {
      return false
    }
    if (
      countFindesPartidos(prueba, anio, mes) >
      countFindesPartidos(copia, anio, mes)
    ) {
      return false
    }
    if (esValida) return esValida(prueba, copia)
    return true
  }

  for (let iter = 0; iter < 60; iter++) {
    const rachaMax = maxFindesConsecutivosLaborados(copia, anio, mes)
    if (rachaMax <= MAX_FINDES_CONSECUTIVOS) break

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

    const diasFindeTrabajo: number[] = []
    for (let dia = 1; dia <= nDias; dia++) {
      if (semanaCalendarioId(anio, mes, dia) !== semanaObjetivo) continue
      if (!esFinDeSemana(anio, mes, dia)) continue
      if (esDiaTrabajado(copia[dia - 1])) diasFindeTrabajo.push(dia)
    }
    if (diasFindeTrabajo.length === 0) break

    const huecosSemana: number[] = []
    for (let dia = 1; dia <= nDias; dia++) {
      if (esFinDeSemana(anio, mes, dia)) continue
      if (copia[dia - 1] !== 'D') continue
      huecosSemana.push(dia)
    }
    if (huecosSemana.length < diasFindeTrabajo.length) break

    let intercambiado = false
    const k = diasFindeTrabajo.length
    const elegir = (inicio: number, pendientes: number[]): void => {
      if (intercambiado) return
      if (pendientes.length === k) {
        const prueba = [...copia]
        for (const dia of diasFindeTrabajo) prueba[dia - 1] = 'D'
        for (const dia of pendientes) prueba[dia - 1] = turnoTrabajo
        if (!valida(prueba)) return
        if (maxFindesConsecutivosLaborados(prueba, anio, mes) >= racha) return
        for (let i = 0; i < nDias; i++) copia[i] = prueba[i]
        intercambiado = true
        return
      }
      for (let i = inicio; i < huecosSemana.length; i++) {
        pendientes.push(huecosSemana[i])
        elegir(i + 1, pendientes)
        pendientes.pop()
        if (intercambiado) return
      }
    }
    elegir(0, [])
    if (!intercambiado) break
  }

  return copia
}
