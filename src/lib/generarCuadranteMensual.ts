import type { Turno, EventoOperativo } from '@/types'
import type { PlanAnual, TurnoAnual } from '@/lib/generarPlanAnual'
import {
  contarVariablesCobroAgente,
  puntajeEquilibrioVariablesMensual,
  sumatorioFMensual,
  totalConciliaciones,
  totalVariablesCobro,
} from '@/lib/variablesCobro'
import {
  MAX_DIAS_CONTINUOS,
  MIN_DESCANSO_SEGUIDO,
  MIN_DESCANSO_TRAS_NOCHE,
  diasDelMes,
  diasOperativosConvenio,
  esDiaTrabajado,
  esFinDeSemana,
  totalTrabajados,
} from '@/lib/convenio'
import {
  MAX_FINDES_CONSECUTIVOS,
  equilibrarFindesConsecutivos,
  esFindePartido,
  countFindesPartidos,
  maxFindesConsecutivosLaborados,
  paresFindeCompletos,
} from '@/lib/finesSemana'

export type CuadranteMensual = Record<string, Turno[]>

type TurnoOperativoMes = Exclude<TurnoAnual, 'V'>

function turnoOperativoMes(
  turno: TurnoAnual | null | undefined,
): TurnoOperativoMes | null {
  if (turno === 'M' || turno === 'T' || turno === 'N') return turno
  return null
}

function rotarFilaCiclica(fila: Turno[], pasos: number): Turno[] {
  const n = fila.length
  if (n === 0) return fila
  const p = ((pasos % n) + n) % n
  if (p === 0) return [...fila]
  return [...fila.slice(n - p), ...fila.slice(0, n - p)]
}

function desfasarFilaMensual(
  fila: Turno[],
  _turno: TurnoOperativoMes,
  indice: number,
  anio: number,
  mes: number,
): Turno[] {
  const n = fila.length
  const pasos = (indice * 3) % n
  if (pasos === 0) return fila
  const rotada = rotarFilaCiclica(fila, pasos)
  if (filaAceptable(rotada, fila, anio, mes, false)) return rotada
  if (filaAceptable(rotada, fila, anio, mes, true)) return rotada
  return fila
}

function rotarLista<T>(lista: T[], desplazamiento: number): T[] {
  if (lista.length === 0) return lista
  const n = ((desplazamiento % lista.length) + lista.length) % lista.length
  if (n === 0) return [...lista]
  return [...lista.slice(n), ...lista.slice(0, n)]
}

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

function corregirDescansosSueltos(descansos: number[]) {
  for (let i = 0; i < descansos.length; i++) {
    if (descansos[i] !== 1) continue
    const donor = descansos.findIndex(
      (valor, j) => j !== i && valor >= MIN_DESCANSO_SEGUIDO + 1,
    )
    if (donor >= 0) {
      descansos[donor] -= 1
      descansos[i] += 1
      continue
    }
    const interno = i > 0 && i < descansos.length - 1
    if (interno) {
      descansos[i] += 1
      const mayor = descansos.reduce(
        (best, valor, j) => (j !== i && valor > descansos[best] ? j : best),
        i === 0 ? 1 : 0,
      )
      if (mayor !== i && descansos[mayor] > 0) descansos[mayor] -= 1
    } else if (i > 0) {
      descansos[i - 1] += 1
      descansos[i] = 0
    } else if (i + 1 < descansos.length) {
      descansos[i + 1] += 1
      descansos[i] = 0
    }
  }
}

/**
 * Coloca el descanso mínimo entre bloques y reparte el resto en huecos
 * distintos según `fase`, para no apilar todos los D al final del mes.
 */
function repartirDescansos(
  nBloques: number,
  nDescanso: number,
  minEntre: number,
  fase: number,
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

  if (resto > 0 && huecos > 0) {
    let slot = ((fase % huecos) + huecos) % huecos
    while (resto > 0) {
      const chunk = resto === 3 ? 3 : resto === 1 ? 1 : 2
      if (chunk === 1) {
        const conRest = descansos.findIndex((valor) => valor >= MIN_DESCANSO_SEGUIDO)
        if (conRest >= 0) descansos[conRest] += 1
        else descansos[slot] += 1
        resto = 0
        break
      }
      descansos[slot] += chunk
      resto -= chunk
      slot = (slot + 1) % huecos
    }
  }

  corregirDescansosSueltos(descansos)
  return descansos
}

function construirFila(
  turno: Exclude<TurnoAnual, 'V'>,
  nDias: number,
  nLaborables: number,
  minEntre: number,
  fase: number,
): Turno[] {
  const nDescanso = nDias - nLaborables
  const bloques = rotarLista(
    bloquesTrabajo(nLaborables, MAX_DIAS_CONTINUOS),
    fase,
  )
  const descansos = repartirDescansos(
    bloques.length,
    nDescanso,
    minEntre,
    fase,
  )

  const fila: Turno[] = []
  for (let i = 0; i < bloques.length; i++) {
    for (let d = 0; d < (descansos[i] ?? 0); d++) fila.push('D')
    for (let t = 0; t < bloques[i]; t++) fila.push(turno)
  }
  for (let d = 0; d < (descansos[bloques.length] ?? 0); d++) fila.push('D')

  while (fila.length < nDias) {
    const huecoD = fila.findIndex(
      (turno, i) => turno === 'D' && (i === 0 || fila[i - 1] === 'D'),
    )
    if (huecoD >= 0) fila.splice(huecoD, 0, 'D')
    else fila.push('D')
  }
  if (fila.length > nDias) {
    for (let i = fila.length - 1; i >= 0 && fila.length > nDias; i--) {
      if (fila[i] === 'D') fila.splice(i, 1)
    }
    if (fila.length > nDias) fila.length = nDias
  }
  return fila
}

function turnoTrabajoDeFila(
  fila: Turno[],
): Exclude<Turno, 'V' | 'D' | 'L'> | null {
  for (const turno of fila) {
    if (turno === 'M' || turno === 'T' || turno === 'N') return turno
  }
  return null
}

function minDescansoInterno(fila: Turno[]) {
  let i = 0
  const n = fila.length
  while (i < n && !esDiaTrabajado(fila[i])) i += 1
  let minimo = Infinity
  while (i < n) {
    while (i < n && esDiaTrabajado(fila[i])) i += 1
    const inicio = i
    while (i < n && !esDiaTrabajado(fila[i])) i += 1
    if (i >= n) break
    minimo = Math.min(minimo, i - inicio)
  }
  return minimo === Infinity ? 0 : minimo
}

function tieneDescansoSuelto(fila: Turno[]) {
  for (let i = 0; i < fila.length; i++) {
    if (fila[i] !== 'D') continue
    const previo = i > 0 && fila[i - 1] === 'D'
    const siguiente = i < fila.length - 1 && fila[i + 1] === 'D'
    if (!previo && !siguiente) return true
  }
  return false
}

function maxDiasContinuosFila(fila: Turno[]) {
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

function filaSinGraves(fila: Turno[]) {
  if (maxDiasContinuosFila(fila) > MAX_DIAS_CONTINUOS) return false
  if (tieneDescansoSuelto(fila)) return false
  if (fila.includes('N') && minDescansoInterno(fila) < MIN_DESCANSO_TRAS_NOCHE) {
    return false
  }
  return true
}

function filaAceptable(
  prueba: Turno[],
  original: Turno[],
  anio: number,
  mes: number,
  permitirFindes: boolean,
) {
  if (prueba.length !== original.length) return false
  if (totalTrabajados(prueba) !== totalTrabajados(original)) return false
  for (let i = 0; i < original.length; i++) {
    if (original[i] === 'V' && prueba[i] !== 'V') return false
    if (original[i] === 'L' && prueba[i] !== 'L') return false
  }
  if (!filaSinGraves(prueba)) return false
  if (
    countFindesPartidos(prueba, anio, mes) >
    countFindesPartidos(original, anio, mes)
  ) {
    return false
  }
  if (
    !permitirFindes &&
    maxFindesConsecutivosLaborados(prueba, anio, mes) > MAX_FINDES_CONSECUTIVOS
  ) {
    return false
  }
  return true
}

/** Valida una fila tras un swap o traslado (mismas jornadas, reglas de fatiga). */
export function validarFilaCuadrante(
  prueba: Turno[],
  original: Turno[],
  anio: number,
  mes: number,
  permitirFindes = false,
) {
  return filaAceptable(prueba, original, anio, mes, permitirFindes)
}

function indicesCandidatos(
  fila: Turno[],
  anio: number,
  mes: number,
  pred: (turno: Turno) => boolean,
) {
  const indices: number[] = []
  for (let dia = 1; dia <= fila.length; dia++) {
    if (esFinDeSemana(anio, mes, dia)) continue
    if (pred(fila[dia - 1])) indices.push(dia - 1)
  }
  return indices
}

function aplicarReubicacion(
  fila: Turno[],
  origenes: number[],
  destinos: number[],
  valorOrigen: Turno,
  valorDestino: Turno,
): Turno[] | null {
  if (origenes.length !== destinos.length) return null
  if (new Set([...origenes, ...destinos]).size !== origenes.length + destinos.length) {
    return null
  }
  const prueba = [...fila]
  for (const i of origenes) prueba[i] = valorOrigen
  for (const i of destinos) prueba[i] = valorDestino
  return prueba
}

function elegirCombinacion(
  candidatos: number[],
  k: number,
  usar: (elegidos: number[]) => boolean,
) {
  const pendientes: number[] = []
  const recorrer = (inicio: number): boolean => {
    if (pendientes.length === k) return usar([...pendientes])
    for (let i = inicio; i < candidatos.length; i++) {
      pendientes.push(candidatos[i])
      if (recorrer(i + 1)) return true
      pendientes.pop()
    }
    return false
  }
  return recorrer(0)
}

/**
 * Sábado y domingo del mismo finde, o los dos de trabajo o los dos de descanso.
 */
function unificarFindesPartidos(
  fila: Turno[],
  turno: Exclude<Turno, 'V' | 'D' | 'L'>,
  anio: number,
  mes: number,
): Turno[] {
  let actual = [...fila]
  for (let pasada = 0; pasada < 8; pasada++) {
    if (!esFindePartido(actual, anio, mes)) return actual
    let progreso = false
    for (const par of paresFindeCompletos(anio, mes, actual.length)) {
      const iSab = par.sabado - 1
      const iDom = par.domingo - 1
      if (actual[iSab] === 'V' || actual[iDom] === 'V') continue
      const sabTrab = esDiaTrabajado(actual[iSab])
      const domTrab = esDiaTrabajado(actual[iDom])
      if (sabTrab === domTrab) continue

      const probar = (prueba: Turno[] | null) => {
        if (!prueba) return false
        if (prueba[iSab] === 'V' || prueba[iDom] === 'V') return false
        if (esDiaTrabajado(prueba[iSab]) !== esDiaTrabajado(prueba[iDom])) {
          return false
        }
        if (
          countFindesPartidos(prueba, anio, mes) >=
          countFindesPartidos(actual, anio, mes)
        ) {
          return false
        }
        if (filaAceptable(prueba, actual, anio, mes, false)) {
          actual = prueba
          return true
        }
        if (filaAceptable(prueba, actual, anio, mes, true)) {
          actual = prueba
          return true
        }
        return false
      }

      const diasFindeTrabajo: number[] = []
      const diasFindeDescanso: number[] = []
      if (sabTrab) diasFindeTrabajo.push(iSab)
      else diasFindeDescanso.push(iSab)
      if (domTrab) diasFindeTrabajo.push(iDom)
      else diasFindeDescanso.push(iDom)

      const huecosD = indicesCandidatos(actual, anio, mes, (t) => t === 'D')
      const huecosTrabajo = indicesCandidatos(actual, anio, mes, esDiaTrabajado)

      const descansoEntero = () =>
        elegirCombinacion(huecosD, diasFindeTrabajo.length, (elegidos) =>
          probar(
            aplicarReubicacion(actual, diasFindeTrabajo, elegidos, 'D', turno),
          ),
        )
      const trabajoEntero = () =>
        elegirCombinacion(huecosTrabajo, diasFindeDescanso.length, (elegidos) =>
          probar(
            aplicarReubicacion(
              actual,
              diasFindeDescanso,
              elegidos,
              turno,
              'D',
            ),
          ),
        )

      if (descansoEntero() || trabajoEntero()) {
        progreso = true
      }
    }
    if (!progreso) break
  }
  return actual
}

function coberturaPorDia(
  cuadrante: CuadranteMensual,
  ids: string[],
  nDias: number,
) {
  const cobertura = Array.from({ length: nDias }, () => 0)
  for (const id of ids) {
    const fila = cuadrante[id]
    if (!fila) continue
    for (let d = 0; d < nDias; d++) {
      if (esDiaTrabajado(fila[d])) cobertura[d] += 1
    }
  }
  return cobertura
}

function coberturaTurnoPorDia(
  cuadrante: CuadranteMensual,
  ids: string[],
  turno: TurnoOperativoMes,
  nDias: number,
) {
  const cobertura = Array.from({ length: nDias }, () => 0)
  for (const id of ids) {
    const fila = cuadrante[id]
    if (!fila) continue
    for (let d = 0; d < nDias; d++) {
      if (fila[d] === turno) cobertura[d] += 1
    }
  }
  return cobertura
}

function agentesPorTurnoMes(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  mes: number,
  nDias: number,
) {
  const grupos = new Map<TurnoOperativoMes, string[]>()
  for (const id of agenteIds) {
    const turno = turnoOperativoMes(planAnual[id]?.[mes - 1])
    if (!turno) continue
    const fila = cuadrante[id]
    if (!fila || fila.length !== nDias) continue
    const lista = grupos.get(turno) ?? []
    lista.push(id)
    grupos.set(turno, lista)
  }
  return grupos
}

function longitudBloqueD(fila: Turno[], idx: number) {
  if (fila[idx] !== 'D') return 0
  let a = idx
  let b = idx
  while (a > 0 && fila[a - 1] === 'D') a -= 1
  while (b < fila.length - 1 && fila[b + 1] === 'D') b += 1
  return b - a + 1
}

function adyacenteADescanso(fila: Turno[], idx: number) {
  const prev = idx > 0 ? fila[idx - 1] : null
  const next = idx < fila.length - 1 ? fila[idx + 1] : null
  return prev === 'D' || prev === 'V' || next === 'D' || next === 'V'
}

function intentarTraslado(
  fila: Turno[],
  alto: number,
  bajo: number,
  turno: Exclude<Turno, 'V' | 'D' | 'L'>,
  anio: number,
  mes: number,
  permitirFindes: boolean,
): Turno[] | null {
  if (alto === bajo) return null
  if (!esDiaTrabajado(fila[alto]) || fila[bajo] !== 'D') return null

  const simple = [...fila]
  simple[alto] = 'D'
  simple[bajo] = turno
  if (filaAceptable(simple, fila, anio, mes, permitirFindes)) return simple

  const pares: Array<[number, number, number, number]> = [
    [alto, alto + 1, bajo, bajo + 1],
    [alto - 1, alto, bajo, bajo + 1],
    [alto, alto + 1, bajo - 1, bajo],
    [alto - 1, alto, bajo - 1, bajo],
  ]
  for (const [a1, a2, b1, b2] of pares) {
    if (a1 < 0 || b1 < 0 || a2 >= fila.length || b2 >= fila.length) continue
    if (new Set([a1, a2, b1, b2]).size !== 4) continue
    if (!esDiaTrabajado(fila[a1]) || !esDiaTrabajado(fila[a2])) continue
    if (fila[b1] !== 'D' || fila[b2] !== 'D') continue
    const prueba = [...fila]
    prueba[a1] = 'D'
    prueba[a2] = 'D'
    prueba[b1] = turno
    prueba[b2] = turno
    if (filaAceptable(prueba, fila, anio, mes, permitirFindes)) return prueba
  }
  return null
}

function puntuacionCandidato(fila: Turno[], alto: number, bajo: number) {
  const descansoOrigen = longitudBloqueD(fila, bajo)
  const uneDescanso = adyacenteADescanso(fila, alto) ? 1 : 0
  return descansoOrigen * 10 + uneDescanso
}

function diasPorCobertura(cobertura: number[], predicado: (valor: number) => boolean) {
  const indices: number[] = []
  for (let i = 0; i < cobertura.length; i++) {
    if (predicado(cobertura[i])) indices.push(i)
  }
  return indices
}

function equilibrarCoberturaInterna(
  cuadrante: CuadranteMensual,
  ids: string[],
  nDias: number,
  anio: number,
  mes: number,
  turnoFijo?: TurnoOperativoMes,
) {
  const intentarMover = (
    diasBajos: number[],
    diasAltos: number[],
    coberturaActual: number[],
    permitirFindes: boolean,
  ) => {
    const candidatos: Array<{
      id: string
      alto: number
      bajo: number
      score: number
    }> = []
    for (const bajo of diasBajos) {
      for (const alto of diasAltos) {
        if (coberturaActual[alto] - coberturaActual[bajo] < 2) continue
        for (const id of ids) {
          const fila = cuadrante[id]
          if (!fila) continue
          const turno = turnoFijo ?? turnoTrabajoDeFila(fila)
          if (!turno) continue
          if (fila[alto] !== turno || fila[bajo] !== 'D') continue
          const priorizaCero = coberturaActual[bajo] === 0 ? 1000 : 0
          candidatos.push({
            id,
            alto,
            bajo,
            score:
              priorizaCero +
              (coberturaActual[alto] - coberturaActual[bajo]) * 20 +
              puntuacionCandidato(fila, alto, bajo),
          })
        }
      }
    }
    candidatos.sort((a, b) => b.score - a.score)
    for (const cand of candidatos) {
      const fila = cuadrante[cand.id]
      if (!fila) continue
      const turno = turnoFijo ?? turnoTrabajoDeFila(fila)
      if (!turno) continue
      const siguiente = intentarTraslado(
        fila,
        cand.alto,
        cand.bajo,
        turno,
        anio,
        mes,
        permitirFindes,
      )
      if (!siguiente) continue
      cuadrante[cand.id] = siguiente
      return true
    }
    return false
  }

  for (let pasada = 0; pasada < 2; pasada++) {
    const permitirFindes = pasada === 1
    for (let iter = 0; iter < (turnoFijo ? 500 : 300); iter++) {
      const actual = turnoFijo
        ? coberturaTurnoPorDia(cuadrante, ids, turnoFijo, nDias)
        : coberturaPorDia(cuadrante, ids, nDias)
      const minimo = Math.min(...actual)
      const maximo = Math.max(...actual)
      if (maximo - minimo <= 1) break

      const extremos = intentarMover(
        diasPorCobertura(actual, (v) => v === minimo),
        diasPorCobertura(actual, (v) => v === maximo),
        actual,
        permitirFindes,
      )
      if (extremos) continue

      const ampliados = intentarMover(
        diasPorCobertura(actual, (v) => v <= minimo + 1),
        diasPorCobertura(actual, (v) => v >= maximo - 1),
        actual,
        permitirFindes,
      )
      if (ampliados) continue

      const todosBajos = diasPorCobertura(actual, (v) => v < maximo - 1)
      const todosAltos = diasPorCobertura(actual, (v) => v > minimo + 1)
      if (!intentarMover(todosBajos, todosAltos, actual, permitirFindes)) {
        break
      }
    }
  }
}

/**
 * Mueve jornadas de días saturados a días cortos para que la falta
 * de personal no se concentre (p. ej. varios días a 0 al final de mes).
 */
export function equilibrarCoberturaDiaria(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  anio: number,
  mes: number,
): CuadranteMensual {
  const nDias = diasDelMes(anio, mes)
  const ids = agenteIds.filter((id) => {
    const fila = cuadrante[id]
    return fila != null && turnoTrabajoDeFila(fila) != null
  })
  equilibrarCoberturaInterna(cuadrante, ids, nDias, anio, mes)
  return cuadrante
}

/**
 * Equilibra la columna M, T o N de cada día entre agentes del mismo turno mensual.
 * Evita bandas horizontales (p. ej. 20 noches un día y 2 al siguiente).
 */
export function equilibrarCoberturaPorTurno(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
): CuadranteMensual {
  const nDias = diasDelMes(anio, mes)
  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)

  for (const [turno, ids] of grupos) {
    if (ids.length < 2) continue
    equilibrarCoberturaInterna(cuadrante, ids, nDias, anio, mes, turno)
  }

  return cuadrante
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

  let fila = construirFila(
    turnoBase,
    nDias,
    nLaborables,
    minEntre,
    offsetDescansoInicial,
  )
  let mejorScore = Number.POSITIVE_INFINITY
  const empatadas: Turno[][] = []
  for (let extra = 0; extra < 16; extra++) {
    const candidata = construirFila(
      turnoBase,
      nDias,
      nLaborables,
      minEntre,
      offsetDescansoInicial + extra,
    )
    if (!filaSinGraves(candidata)) continue
    const partidos = countFindesPartidos(candidata, anio, mes)
    const score = partidos * 100 + extra
    if (score < mejorScore) {
      fila = candidata
      mejorScore = score
      empatadas.length = 0
      empatadas.push(candidata)
    } else if (score === mejorScore) {
      empatadas.push(candidata)
    }
    if (partidos === 0 && score === mejorScore) {
      // Sigue buscando variantes sin findes partidos para desfasar entre agentes.
      continue
    }
    if (partidos === 0 && mejorScore < 100) break
  }
  if (empatadas.length > 1) {
    fila = empatadas[offsetDescansoInicial % empatadas.length]
  }

  if (turnoBase === 'M' || turnoBase === 'T' || turnoBase === 'N') {
    fila = unificarFindesPartidos(fila, turnoBase, anio, mes)
    const conFindes = equilibrarFindesConsecutivos(
      fila,
      anio,
      mes,
      turnoBase,
      (prueba, original) => filaAceptable(prueba, original, anio, mes, false),
    )
    if (filaAceptable(conFindes, fila, anio, mes, false)) {
      fila = conFindes
    }
    fila = unificarFindesPartidos(fila, turnoBase, anio, mes)
  }
  return fila
}

function conteosVariablesGrupo(
  cuadrante: CuadranteMensual,
  ids: string[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
) {
  return ids.map((id) =>
    contarVariablesCobroAgente(cuadrante[id] ?? [], anio, mes, eventos),
  )
}

function sumatoriosFGrupo(
  cuadrante: CuadranteMensual,
  ids: string[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
) {
  return ids.map((id) =>
    sumatorioFMensual(cuadrante[id] ?? [], anio, mes, eventos),
  )
}

function puntajeVariablesGrupo(
  cuadrante: CuadranteMensual,
  ids: string[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
) {
  return puntajeEquilibrioVariablesMensual(
    conteosVariablesGrupo(cuadrante, ids, anio, mes, eventos),
    sumatoriosFGrupo(cuadrante, ids, anio, mes, eventos),
  )
}

function filasValidasTrasSwapVariables(
  filaA: Turno[],
  filaB: Turno[],
  pruebaA: Turno[],
  pruebaB: Turno[],
  anio: number,
  mes: number,
) {
  if (
    filaAceptable(pruebaA, filaA, anio, mes, false) &&
    filaAceptable(pruebaB, filaB, anio, mes, false)
  ) {
    return true
  }
  return (
    filaAceptable(pruebaA, filaA, anio, mes, true) &&
    filaAceptable(pruebaB, filaB, anio, mes, true)
  )
}

/**
 * Reparte conciliaciones y festivos entre agentes del mismo turno mensual.
 */
function equilibrarVariablesCobro(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[] = [],
): CuadranteMensual {
  const nDias = diasDelMes(anio, mes)
  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)

  for (const [turno, ids] of grupos) {
    if (ids.length < 2) continue

    for (let iter = 0; iter < 400; iter++) {
      const puntajeAntes = puntajeVariablesGrupo(
        cuadrante,
        ids,
        anio,
        mes,
        eventos,
      )
      if (puntajeAntes === 0) break

      const conteos = conteosVariablesGrupo(cuadrante, ids, anio, mes, eventos)
      const sumatoriosF = sumatoriosFGrupo(cuadrante, ids, anio, mes, eventos)
      let mejorSwap: {
        idA: string
        idB: string
        idx: number
        puntaje: number
      } | null = null

      for (let i = 0; i < ids.length; i++) {
        for (let j = 0; j < ids.length; j++) {
          if (i === j) continue
          const idA = ids[i]
          const idB = ids[j]
          const filaA = cuadrante[idA]
          const filaB = cuadrante[idB]
          if (!filaA || !filaB) continue

          const cargaA =
            sumatoriosF[i] * 20 +
            totalConciliaciones(conteos[i]) * 15 +
            totalVariablesCobro(conteos[i])
          const cargaB =
            sumatoriosF[j] * 20 +
            totalConciliaciones(conteos[j]) * 15 +
            totalVariablesCobro(conteos[j])
          if (cargaA <= cargaB) continue

          for (let idx = 0; idx < nDias; idx++) {
            if (!esDiaTrabajado(filaA[idx]) || filaB[idx] !== 'D') continue
            if (filaA[idx] !== turno) continue
            if (filaA[idx] === 'V' || filaB[idx] === 'V') continue

            const pruebaA = [...filaA]
            const pruebaB = [...filaB]
            pruebaA[idx] = 'D'
            pruebaB[idx] = turno

            if (
              !filasValidasTrasSwapVariables(
                filaA,
                filaB,
                pruebaA,
                pruebaB,
                anio,
                mes,
              )
            ) {
              continue
            }

            const copia = { ...cuadrante, [idA]: pruebaA, [idB]: pruebaB }
            const puntajeDesp = puntajeVariablesGrupo(
              copia,
              ids,
              anio,
              mes,
              eventos,
            )
            if (puntajeDesp >= puntajeAntes) continue

            if (!mejorSwap || puntajeDesp < mejorSwap.puntaje) {
              mejorSwap = { idA, idB, idx, puntaje: puntajeDesp }
            }
          }
        }
      }

      if (!mejorSwap) break

      const filaA = cuadrante[mejorSwap.idA]!
      const filaB = cuadrante[mejorSwap.idB]!
      const pruebaA = [...filaA]
      const pruebaB = [...filaB]
      pruebaA[mejorSwap.idx] = 'D'
      pruebaB[mejorSwap.idx] = turno
      cuadrante[mejorSwap.idA] = pruebaA
      cuadrante[mejorSwap.idB] = pruebaB
    }
  }

  return cuadrante
}

export function generarCuadranteMensual(
  planAnual: PlanAnual,
  agenteIds: string[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[] = [],
): CuadranteMensual {
  const cuadrante: CuadranteMensual = {}
  const fasePorTurno: Record<TurnoAnual, number> = { M: 0, T: 0, N: 0, V: 0 }

  for (const id of agenteIds) {
    const turnoBase = planAnual[id]?.[mes - 1]
    if (!turnoBase) {
      const nDias = diasDelMes(anio, mes)
      cuadrante[id] = Array.from({ length: nDias }, () => 'D')
      continue
    }
    const indiceTurno = fasePorTurno[turnoBase]
    const fase = indiceTurno * 5 + 1
    fasePorTurno[turnoBase] += 1
    let fila = generarFilaMensual(turnoBase, anio, mes, fase)
    if (turnoBase === 'M' || turnoBase === 'T' || turnoBase === 'N') {
      fila = desfasarFilaMensual(fila, turnoBase, indiceTurno, anio, mes)
    }
    cuadrante[id] = fila
  }

  equilibrarCoberturaPorTurno(cuadrante, agenteIds, planAnual, anio, mes)
  equilibrarCoberturaDiaria(cuadrante, agenteIds, anio, mes)
  equilibrarCoberturaPorTurno(cuadrante, agenteIds, planAnual, anio, mes)
  equilibrarVariablesCobro(cuadrante, agenteIds, planAnual, anio, mes, eventos)
  equilibrarCoberturaPorTurno(cuadrante, agenteIds, planAnual, anio, mes)
  return cuadrante
}

export function siguienteTurnoDia(actual: Turno): Turno {
  const ciclo: Turno[] = ['M', 'T', 'N', 'L', 'D', 'V']
  const indice = ciclo.indexOf(actual)
  return ciclo[(indice + 1) % ciclo.length]
}

export function maxDiasContinuos(fila: Turno[]) {
  return maxDiasContinuosFila(fila)
}
