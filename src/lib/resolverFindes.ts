import type { Turno } from '@/types'
import {
  MAX_DIAS_CONTINUOS,
  MIN_BLOQUE_TRABAJO,
  MIN_DESCANSO_SEGUIDO,
  MIN_DESCANSO_TRAS_NOCHE,
  diasDelMes,
  diasOperativosConvenio,
  esDiaTrabajado,
  esFinDeSemana,
  tieneTrabajoSuelto,
  totalTrabajados,
} from '@/lib/convenio'
import {
  MAX_FINDES_CONSECUTIVOS,
  MAX_FINDES_MES,
  OBJETIVO_FINDES_MES,
  countFindesPartidos,
  equilibrarFindesConsecutivos,
  equilibrarFindesLaboradosMes,
  equilibrarFindesUnicoMes,
  findesLaboradosEnMes,
  maxFindesConsecutivosLaborados,
  paresFindeCompletos,
} from '@/lib/finesSemana'

type TurnoMes = 'M' | 'T' | 'N'
type Cuadrante = Record<string, Turno[]>

const cachePatrones = new Map<string, Turno[][]>()

function unidadesFinde(anio: number, mes: number, nDias: number) {
  const pares = paresFindeCompletos(anio, mes, nDias).map((par) => [
    par.sabado,
    par.domingo,
  ])
  const usados = new Set(pares.flat())
  const sueltos: number[][] = []
  for (let dia = 1; dia <= nDias; dia++) {
    if (!esFinDeSemana(anio, mes, dia) || usados.has(dia)) continue
    sueltos.push([dia])
  }
  return [...sueltos, ...pares]
}

function combinaciones<T>(lista: T[], k: number) {
  const out: T[][] = []
  const actual: T[] = []
  const recorrer = (inicio: number) => {
    if (actual.length === k) {
      out.push([...actual])
      return
    }
    for (let i = inicio; i < lista.length; i++) {
      actual.push(lista[i])
      recorrer(i + 1)
      actual.pop()
    }
  }
  if (k > 0 && k <= lista.length) recorrer(0)
  return out
}

function graves(fila: Turno[], turno: TurnoMes) {
  if (tieneTrabajoSuelto(fila)) return false
  let maximo = 0
  let racha = 0
  for (const celda of fila) {
    if (esDiaTrabajado(celda)) {
      racha += 1
      maximo = Math.max(maximo, racha)
    } else {
      racha = 0
    }
  }
  if (maximo > MAX_DIAS_CONTINUOS) return false
  for (let i = 0; i < fila.length; i++) {
    if (fila[i] !== 'D') continue
    const previo = i > 0 && fila[i - 1] === 'D'
    const siguiente = i < fila.length - 1 && fila[i + 1] === 'D'
    if (!previo && !siguiente) return false
  }
  if (turno !== 'N') return true
  let i = 0
  while (i < fila.length && !esDiaTrabajado(fila[i])) i += 1
  let minimo = Infinity
  while (i < fila.length) {
    while (i < fila.length && esDiaTrabajado(fila[i])) i += 1
    const inicio = i
    while (i < fila.length && !esDiaTrabajado(fila[i])) i += 1
    if (i >= fila.length) break
    minimo = Math.min(minimo, i - inicio)
  }
  return minimo === Infinity || minimo >= MIN_DESCANSO_TRAS_NOCHE
}

function buscarPatrones(
  turno: TurnoMes,
  anio: number,
  mes: number,
  trabajar: number[][],
  cupo: number,
) {
  const nDias = diasDelMes(anio, mes)
  const nLaborables = diasOperativosConvenio(anio, mes)
  const minDescanso = turno === 'N' ? MIN_DESCANSO_TRAS_NOCHE : MIN_DESCANSO_SEGUIDO
  const marcar = new Set(trabajar.flat())
  const forzado: Array<Turno | null> = Array.from({ length: nDias }, () => null)
  for (const unidad of unidadesFinde(anio, mes, nDias)) {
    const trabaja = unidad.every((dia) => marcar.has(dia))
    for (const dia of unidad) forzado[dia - 1] = trabaja ? turno : 'D'
  }

  const soluciones: Turno[][] = []
  const fila: Turno[] = Array.from({ length: nDias }, () => 'D' as Turno)
  let nodos = 0

  const cerrar = () => {
    if (!graves(fila, turno)) return
    if (totalTrabajados(fila) !== nLaborables) return
    if (countFindesPartidos(fila, anio, mes) !== 0) return
    const nf = findesLaboradosEnMes(fila, anio, mes)
    if (nf < OBJETIVO_FINDES_MES || nf > MAX_FINDES_MES) return
    if (maxFindesConsecutivosLaborados(fila, anio, mes) > MAX_FINDES_CONSECUTIVOS) {
      return
    }
    soluciones.push([...fila])
  }

  const recorrer = (dia: number, trabajos: number, rachaN: number, rachaD: number) => {
    if (soluciones.length >= cupo || nodos > 50_000) return
    nodos += 1
    if (dia === nDias) {
      if (trabajos === nLaborables && rachaN !== 1) cerrar()
      return
    }
    const faltan = nLaborables - trabajos
    if (faltan < 0 || faltan > nDias - dia) return
    const fuerza = forzado[dia]
    const puedeTrabajar =
      fuerza !== 'D' &&
      rachaN < MAX_DIAS_CONTINUOS &&
      rachaD !== 1 &&
      !(rachaD > 0 && rachaD < minDescanso)
    const puedeDescansar = fuerza !== turno && rachaN !== 1
    if (puedeTrabajar) {
      fila[dia] = turno
      recorrer(dia + 1, trabajos + 1, rachaN + 1, 0)
      fila[dia] = 'D'
    }
    if (puedeDescansar && !(rachaN > 0 && rachaN < MIN_BLOQUE_TRABAJO)) {
      fila[dia] = 'D'
      recorrer(dia + 1, trabajos, 0, rachaD + 1)
    }
  }

  recorrer(0, 0, 0, 0)
  return soluciones
}

/** Filas con el finde entero (sábado y domingo juntos) y 2 o 3 findes. */
export function patronesAtomicos(turno: TurnoMes, anio: number, mes: number) {
  const clave = `${turno}-${anio}-${mes}`
  const guardados = cachePatrones.get(clave)
  if (guardados) return guardados

  const nDias = diasDelMes(anio, mes)
  const unidades = unidadesFinde(anio, mes, nDias)
  const vistos = new Set<string>()
  const patrones: Turno[][] = []
  const guardar = (filas: Turno[][]) => {
    for (const fila of filas) {
      const texto = fila.join('')
      if (vistos.has(texto)) continue
      vistos.add(texto)
      patrones.push(fila)
    }
  }
  for (const eleccion of combinaciones(unidades, 2)) {
    guardar(buscarPatrones(turno, anio, mes, eleccion, 2))
  }
  for (const eleccion of combinaciones(unidades, 3)) {
    guardar(buscarPatrones(turno, anio, mes, eleccion, 1))
  }
  cachePatrones.set(clave, patrones)
  return patrones
}

function puntuarCoberturaPatron(
  patron: Turno[],
  cobertura: number[],
  usoFinde: Map<string, number>,
  anio: number,
  mes: number,
) {
  let score = 0
  const findes = new Set<string>()
  const pares = paresFindeCompletos(anio, mes, patron.length)
  for (let i = 0; i < patron.length; i++) {
    if (!esDiaTrabajado(patron[i])) continue
    const hueco = cobertura[i] ?? 0
    score += hueco * hueco
    if (esFinDeSemana(anio, mes, i + 1)) {
      const par = pares.find((item) => item.sabado === i + 1 || item.domingo === i + 1)
      findes.add(par ? String(par.sabado) : `s${i + 1}`)
    }
  }
  for (const finde of findes) score += (usoFinde.get(finde) ?? 0) * 30
  if (findesLaboradosEnMes(patron, anio, mes) !== OBJETIVO_FINDES_MES) score += 400
  return score
}

/** Elige el patrón que mejor rellena los días flojos y reparte findes distintos. */
export function elegirPatronAtomico(
  patrones: Turno[][],
  cobertura: number[],
  usoFinde: Map<string, number>,
  anio: number,
  mes: number,
  indice: number,
) {
  const limpios = patrones.filter(
    (patron) =>
      findesLaboradosEnMes(patron, anio, mes) === OBJETIVO_FINDES_MES &&
      countFindesPartidos(patron, anio, mes) === 0,
  )
  const bolsa = limpios.length > 0 ? limpios : patrones
  let mejor = Number.POSITIVE_INFINITY
  const empatados: Turno[][] = []
  for (const patron of bolsa) {
    const score = puntuarCoberturaPatron(patron, cobertura, usoFinde, anio, mes)
    if (score < mejor) {
      mejor = score
      empatados.length = 0
      empatados.push(patron)
    } else if (score === mejor) {
      empatados.push(patron)
    }
  }
  return empatados[Math.abs(indice) % empatados.length].slice()
}

export function anotarPatronEnCobertura(
  fila: Turno[],
  cobertura: number[],
  usoFinde: Map<string, number>,
  anio: number,
  mes: number,
) {
  const pares = paresFindeCompletos(anio, mes, fila.length)
  const vistos = new Set<string>()
  for (let i = 0; i < fila.length; i++) {
    if (!esDiaTrabajado(fila[i])) continue
    cobertura[i] += 1
    if (!esFinDeSemana(anio, mes, i + 1)) continue
    const par = pares.find((item) => item.sabado === i + 1 || item.domingo === i + 1)
    const clave = par ? String(par.sabado) : `s${i + 1}`
    if (vistos.has(clave)) continue
    vistos.add(clave)
    usoFinde.set(clave, (usoFinde.get(clave) ?? 0) + 1)
  }
}

function scoreGrupo(filas: Cuadrante, ids: string[], anio: number, mes: number) {
  let score = 0
  for (const id of ids) {
    const fila = filas[id]
    if (!fila) continue
    const nf = findesLaboradosEnMes(fila, anio, mes)
    const partidos = countFindesPartidos(fila, anio, mes)
    const racha = maxFindesConsecutivosLaborados(fila, anio, mes)
    score += partidos * 10_000
    if (nf < OBJETIVO_FINDES_MES) score += (OBJETIVO_FINDES_MES - nf) * 5_000
    else if (nf > MAX_FINDES_MES) score += (nf - MAX_FINDES_MES) * 5_000
    else if (nf > OBJETIVO_FINDES_MES) score += 160
    if (racha > MAX_FINDES_CONSECUTIVOS) {
      score += (racha - MAX_FINDES_CONSECUTIVOS) * 2_500
    }
  }
  return score
}

function bajos(filas: Cuadrante, ids: string[], anio: number, mes: number) {
  let total = 0
  for (const id of ids) {
    const fila = filas[id]
    if (!fila) continue
    if (findesLaboradosEnMes(fila, anio, mes) < OBJETIVO_FINDES_MES) total += 1
  }
  return total
}

function partidosGrupo(filas: Cuadrante, ids: string[], anio: number, mes: number) {
  let total = 0
  for (const id of ids) {
    const fila = filas[id]
    if (!fila) continue
    total += countFindesPartidos(fila, anio, mes)
  }
  return total
}

function respetaPisos(
  antes: Turno[],
  despues: Turno[],
  conteos: number[],
  pisos: number[] | undefined,
) {
  if (!pisos) return true
  for (let i = 0; i < antes.length; i++) {
    const delta =
      (esDiaTrabajado(despues[i]) ? 1 : 0) - (esDiaTrabajado(antes[i]) ? 1 : 0)
    if (delta < 0 && conteos[i] + delta < (pisos[i] ?? 0)) return false
  }
  return true
}

function filaOperativa(
  prueba: Turno[],
  original: Turno[],
  turno: TurnoMes,
  anio: number,
  mes: number,
) {
  if (prueba.length !== original.length) return false
  if (totalTrabajados(prueba) !== totalTrabajados(original)) return false
  for (let i = 0; i < original.length; i++) {
    if (original[i] === 'V' && prueba[i] !== 'V') return false
    if (original[i] === 'L' && prueba[i] !== 'L') return false
    if (original[i] === 'P' && prueba[i] !== 'P') return false
  }
  if (!graves(prueba, turno)) return false
  if (findesLaboradosEnMes(prueba, anio, mes) > MAX_FINDES_MES) return false
  if (maxFindesConsecutivosLaborados(prueba, anio, mes) > MAX_FINDES_CONSECUTIVOS) {
    return false
  }
  if (countFindesPartidos(prueba, anio, mes) > countFindesPartidos(original, anio, mes)) {
    return false
  }
  return true
}

function conteosTurno(filas: Cuadrante, ids: string[], turno: TurnoMes) {
  const n = filas[ids[0]]?.length ?? 0
  const conteos = Array.from({ length: n }, () => 0)
  for (const id of ids) {
    const fila = filas[id]
    if (!fila) continue
    for (let i = 0; i < fila.length; i++) {
      if (fila[i] === turno) conteos[i] += 1
    }
  }
  return conteos
}

function prioridadDia(fila: Turno[], indice: number, anio: number, mes: number) {
  let score = 0
  if (esFinDeSemana(anio, mes, indice + 1)) score += 10
  const previo = indice > 0 && esDiaTrabajado(fila[indice - 1])
  const siguiente = indice < fila.length - 1 && esDiaTrabajado(fila[indice + 1])
  if (previo !== siguiente) score += 4
  return score
}

function ordenarDias(fila: Turno[], dias: number[], anio: number, mes: number) {
  return [...dias].sort(
    (a, b) => prioridadDia(fila, b, anio, mes) - prioridadDia(fila, a, anio, mes),
  )
}

function intercambiar(
  filaA: Turno[],
  filaB: Turno[],
  deA: number[],
  deB: number[],
  turno: TurnoMes,
) {
  const copiaA = [...filaA]
  const copiaB = [...filaB]
  for (const dia of deA) {
    copiaA[dia] = 'D'
    copiaB[dia] = turno
  }
  for (const dia of deB) {
    copiaB[dia] = 'D'
    copiaA[dia] = turno
  }
  return [copiaA, copiaB] as const
}

function combinacionesDias(dias: number[], k: number) {
  const out: number[][] = []
  const actual: number[] = []
  const recorrer = (inicio: number) => {
    if (actual.length === k) {
      out.push([...actual])
      return
    }
    for (let i = inicio; i < dias.length; i++) {
      actual.push(dias[i])
      recorrer(i + 1)
      actual.pop()
    }
  }
  if (k > 0 && k <= dias.length) recorrer(0)
  return out
}

function infelices(filas: Cuadrante, ids: string[], anio: number, mes: number) {
  return ids.filter((id) => {
    const fila = filas[id]
    if (!fila) return false
    const nf = findesLaboradosEnMes(fila, anio, mes)
    return countFindesPartidos(fila, anio, mes) > 0 || nf !== OBJETIVO_FINDES_MES
  })
}

/**
 * Busca combinaciones entre compañeros que corrijan findes partidos y el reparto
 * 3 contra 1, sin romper fatiga, jornadas, permisos ni la cobertura mínima.
 */
export function resolverFindesGrupo(
  cuadrante: Cuadrante,
  ids: string[],
  turno: TurnoMes,
  anio: number,
  mes: number,
  pisos?: number[],
) {
  if (ids.length < 1) return
  const nDias = diasDelMes(anio, mes)
  for (const id of ids) {
    const fila = cuadrante[id]
    if (!fila || fila.length !== nDias) return
  }

  const patrones = patronesAtomicos(turno, anio, mes)

  for (let pasada = 0; pasada < 14; pasada++) {
    const actual: Cuadrante = {}
    for (const id of ids) actual[id] = cuadrante[id]
    const foco = infelices(actual, ids, anio, mes)
    if (foco.length === 0) return

    const scoreActual = scoreGrupo(actual, ids, anio, mes)
    const bajosActual = bajos(actual, ids, anio, mes)
    const partidosActual = partidosGrupo(actual, ids, anio, mes)
    const conteos = conteosTurno(actual, ids, turno)
    let mejor: Cuadrante | null = null
    let mejorScore = scoreActual

    const considerar = (idA: string, filaA: Turno[], idB?: string, filaB?: Turno[]) => {
      if (!filaOperativa(filaA, actual[idA], turno, anio, mes)) return
      if (!respetaPisos(actual[idA], filaA, conteos, pisos)) return
      if (idB && filaB) {
        if (!filaOperativa(filaB, actual[idB], turno, anio, mes)) return
        if (!respetaPisos(actual[idB], filaB, conteos, pisos)) return
      }
      const prueba: Cuadrante = { ...actual, [idA]: filaA }
      if (idB && filaB) prueba[idB] = filaB
      if (bajos(prueba, ids, anio, mes) > bajosActual) return
      if (partidosGrupo(prueba, ids, anio, mes) > partidosActual) return
      const score = scoreGrupo(prueba, ids, anio, mes)
      if (score < mejorScore) {
        mejorScore = score
        mejor = idB && filaB ? { [idA]: filaA, [idB]: filaB } : { [idA]: filaA }
      }
    }

    for (const id of foco) {
      const fila = actual[id]
      let ajustada = equilibrarFindesUnicoMes(fila, anio, mes, turno, (prueba) =>
        graves(prueba, turno),
      )
      ajustada = equilibrarFindesLaboradosMes(ajustada, anio, mes, turno, (prueba) =>
        graves(prueba, turno),
      )
      ajustada = equilibrarFindesConsecutivos(ajustada, anio, mes, turno, (prueba) =>
        graves(prueba, turno),
      )
      if (ajustada.some((celda, i) => celda !== fila[i])) considerar(id, ajustada)
    }

    for (const idA of foco) {
      for (const idB of ids) {
        if (idA === idB) continue
        const filaA = actual[idA]
        const filaB = actual[idB]
        const deA: number[] = []
        const deB: number[] = []
        for (let dia = 0; dia < nDias; dia++) {
          if (filaA[dia] === turno && filaB[dia] === 'D') deA.push(dia)
          else if (filaB[dia] === turno && filaA[dia] === 'D') deB.push(dia)
        }
        const ordenA = ordenarDias(filaA, deA, anio, mes).slice(0, 10)
        const ordenB = ordenarDias(filaB, deB, anio, mes).slice(0, 10)
        for (const diaA of ordenA) {
          for (const diaB of ordenB) {
            const [siguienteA, siguienteB] = intercambiar(filaA, filaB, [diaA], [diaB], turno)
            considerar(idA, siguienteA, idB, siguienteB)
          }
        }
        for (const diasA of combinacionesDias(ordenA.slice(0, 6), 2)) {
          for (const diasB of combinacionesDias(ordenB.slice(0, 6), 2)) {
            const [siguienteA, siguienteB] = intercambiar(filaA, filaB, diasA, diasB, turno)
            considerar(idA, siguienteA, idB, siguienteB)
          }
        }
      }
    }

    for (const id of foco) {
      const fila = actual[id]
      for (const patron of patrones) {
        if (patron.length !== fila.length) continue
        const deja: number[] = []
        const toma: number[] = []
        let incompatible = false
        for (let dia = 0; dia < fila.length; dia++) {
          const congelada = fila[dia] === 'V' || fila[dia] === 'L' || fila[dia] === 'P'
          if (congelada && patron[dia] !== fila[dia]) {
            incompatible = true
            break
          }
          const trabajaba = fila[dia] === turno
          const trabajara = patron[dia] === turno
          if (trabajaba && !trabajara) deja.push(dia)
          else if (!trabajaba && trabajara) toma.push(dia)
        }
        if (incompatible || deja.length !== toma.length || deja.length === 0 || deja.length > 8) {
          continue
        }
        const propuesta = [...fila]
        for (const dia of deja) propuesta[dia] = 'D'
        for (const dia of toma) propuesta[dia] = turno
        for (const idB of ids) {
          if (idB === id) continue
          const companero = actual[idB]
          if (!deja.every((dia) => companero[dia] === 'D')) continue
          if (!toma.every((dia) => companero[dia] === turno)) continue
          const copia = [...companero]
          for (const dia of deja) copia[dia] = turno
          for (const dia of toma) copia[dia] = 'D'
          considerar(id, propuesta, idB, copia)
        }
      }
    }

    if (!mejor) return
    for (const id of Object.keys(mejor)) {
      const fila = mejor[id]
      if (fila) cuadrante[id] = fila
    }
  }
}
