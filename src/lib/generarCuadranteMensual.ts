import type { Turno, EventoOperativo } from '@/types'
import type { PlanAnual, TurnoAnual } from '@/lib/generarPlanAnual'
import {
  minimosParaFecha,
  type MinimosSemana,
  type PuestoConfig,
  totalMinimosTurno,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import {
  contarVariablesCobroAgente,
  puntajeEquilibrioVariablesMensual,
  sumatorioFMensual,
  totalConciliaciones,
  totalVariablesCobro,
} from '@/lib/variablesCobro'
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
  equilibrarFindesConsecutivos,
  equilibrarFindesLaboradosMes,
  equilibrarFindesUnicoMes,
  esFindePartido,
  countFindesPartidos,
  findesLaboradosEnMes,
  findesMesCuadra,
  maxFindesConsecutivosLaborados,
  OBJETIVO_FINDES_MES,
  paresFindeCompletos,
} from '@/lib/finesSemana'
import {
  type ContextoMetricasCuadrante,
  puntuacionGlobalCuadrante,
} from '@/lib/metricasRefinadoCuadrante'

export type CuadranteMensual = Record<string, Turno[]>

export type OpcionesGeneracionCuadranteMensual = {
  minimosSemana?: MinimosSemana
  puestos?: PuestoConfig[]
}

/** Pasadas de refinado tras construir filas (cobertura, mínimos, variables, findes). */
export const PASADAS_REFINO_CUADRANTE_MENSUAL = 4

/** Rondas del refinado final coordinado (sudoku). */
export const MAX_RONDAS_REFINO_SUDOKU = 12

function padDia(n: number) {
  return String(n).padStart(2, '0')
}

function isoFechaCuadrante(anio: number, mes: number, dia: number) {
  return `${anio}-${padDia(mes)}-${padDia(dia)}`
}

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
  if (n === 0) return fila

  for (let t = 0; t < n; t++) {
    const pasos = (indice * 7 + t) % n
    if (pasos === 0) continue
    const rotada = rotarFilaCiclica(fila, pasos)
    if (filaAceptable(rotada, fila, anio, mes, true)) return rotada
    if (filaAceptable(rotada, fila, anio, mes, false)) return rotada
  }

  for (let t = 0; t < n; t++) {
    const pasos = (indice * 7 + t) % n
    if (pasos === 0) continue
    const rotada = rotarFilaCiclica(fila, pasos)
    if (filaAceptableParaDesfase(rotada, fila, anio, mes)) return rotada
  }

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
    if (restante === 1) {
      const donor = bloques.findIndex((tam) => tam > MIN_BLOQUE_TRABAJO)
      if (donor >= 0) {
        bloques[donor] -= 1
        bloques.push(MIN_BLOQUE_TRABAJO)
      } else if (bloques.length > 0) {
        bloques[bloques.length - 1] += 1
      } else {
        bloques.push(1)
      }
      restante = 0
      continue
    }
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
  if (tieneTrabajoSuelto(fila)) return false
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
  if (!findesMesCuadra(findesLaboradosEnMes(prueba, anio, mes))) return false
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

/** Validación relajada al cubrir mínimos operativos (findes se reequilibran después). */
function filaAceptableParaMinimos(
  prueba: Turno[],
  original: Turno[],
  anio: number,
  mes: number,
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
  return true
}

/** Rotación/desfase: sin findes (se corrigen en refinado posterior). */
function filaAceptableParaDesfase(
  prueba: Turno[],
  original: Turno[],
  anio: number,
  mes: number,
) {
  return filaAceptableParaMinimos(prueba, original, anio, mes)
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

function intentarTrasladoParaMinimos(
  fila: Turno[],
  alto: number,
  bajo: number,
  turno: Exclude<Turno, 'V' | 'D' | 'L'>,
  anio: number,
  mes: number,
): Turno[] | null {
  if (alto === bajo) return null
  if (!esDiaTrabajado(fila[alto]) || fila[bajo] !== 'D') return null

  const simple = [...fila]
  simple[alto] = 'D'
  simple[bajo] = turno
  if (filaAceptableParaMinimos(simple, fila, anio, mes)) return simple

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
    if (filaAceptableParaMinimos(prueba, fila, anio, mes)) return prueba
  }
  return null
}

function intentarRotarAgenteParaMinimos(
  fila: Turno[],
  diaObjetivo: number,
  turno: Exclude<Turno, 'V' | 'D' | 'L'>,
  anio: number,
  mes: number,
): Turno[] | null {
  if (fila[diaObjetivo] === turno) return null
  const n = fila.length
  for (let pasos = 1; pasos < n; pasos++) {
    const rotada = rotarFilaCiclica(fila, pasos)
    if (rotada[diaObjetivo] !== turno) continue
    if (filaAceptableParaDesfase(rotada, fila, anio, mes)) return rotada
  }
  return null
}

function intentarIntercambioDiaEntreAgentes(
  filaA: Turno[],
  filaB: Turno[],
  dia: number,
  turno: Exclude<Turno, 'V' | 'D' | 'L'>,
  anio: number,
  mes: number,
): [Turno[], Turno[]] | null {
  if (filaA[dia] === filaB[dia]) return null
  const conteoAntes =
    (filaA[dia] === turno ? 1 : 0) + (filaB[dia] === turno ? 1 : 0)
  const pruebaA = [...filaA]
  const pruebaB = [...filaB]
  pruebaA[dia] = filaB[dia]
  pruebaB[dia] = filaA[dia]
  const conteoDespues =
    (pruebaA[dia] === turno ? 1 : 0) + (pruebaB[dia] === turno ? 1 : 0)
  if (conteoDespues <= conteoAntes) return null
  if (!filaAceptableParaMinimos(pruebaA, filaA, anio, mes)) return null
  if (!filaAceptableParaMinimos(pruebaB, filaB, anio, mes)) return null
  return [pruebaA, pruebaB]
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

function maxIteracionesCobertura(nAgentes: number, porTurno: boolean) {
  const base = porTurno ? 120 : 80
  return Math.min(porTurno ? 220 : 160, base + nAgentes * 2)
}

function maxIteracionesVariables(nAgentes: number) {
  return Math.min(100, 24 + Math.floor(nAgentes * 1.5))
}

export function yieldToMain() {
  return new Promise<void>((resolve) => {
    setTimeout(resolve, 0)
  })
}

function equilibrarCoberturaInterna(
  cuadrante: CuadranteMensual,
  ids: string[],
  nDias: number,
  anio: number,
  mes: number,
  turnoFijo?: TurnoOperativoMes,
  pisosPorDia?: number[],
) {
  const puedeTomarDeDia = (dia: number, coberturaActual: number[]) => {
    if (!pisosPorDia) return true
    return coberturaActual[dia] > pisosPorDia[dia]
  }

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
        if (!puedeTomarDeDia(alto, coberturaActual)) continue
        if (coberturaActual[alto] <= coberturaActual[bajo]) continue
        if (
          coberturaActual[alto] - coberturaActual[bajo] < 2 &&
          coberturaActual[bajo] > 0
        ) {
          continue
        }
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
    for (let iter = 0; iter < maxIteracionesCobertura(ids.length, !!turnoFijo); iter++) {
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
  opciones?: OpcionesGeneracionCuadranteMensual,
  eventos: EventoOperativo[] = [],
): CuadranteMensual {
  const nDias = diasDelMes(anio, mes)
  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)
  const conMinimos = tieneContextoMinimos(opciones)

  for (const [turno, ids] of grupos) {
    if (ids.length < 2) continue
    let pisos: number[] | undefined
    if (conMinimos) {
      pisos = Array.from({ length: nDias }, (_, dia) => {
        const minimos = minimosParaFecha(
          isoFechaCuadrante(anio, mes, dia + 1),
          eventos,
          opciones!.minimosSemana!,
          opciones!.puestos!,
        )
        return totalMinimosTurno(minimos, turno, opciones!.puestos!)
      })
    }
    equilibrarCoberturaInterna(
      cuadrante,
      ids,
      nDias,
      anio,
      mes,
      turno,
      pisos,
    )
  }

  return cuadrante
}

function conteoTurnoDia(
  cuadrante: CuadranteMensual,
  ids: string[],
  dia: number,
  turno: TurnoOperativo,
) {
  let total = 0
  for (const id of ids) {
    if (cuadrante[id]?.[dia] === turno) total += 1
  }
  return total
}

function maxIteracionesMinimos(nAgentes: number, gateGlobal = false) {
  if (gateGlobal) return Math.min(80, 40 + nAgentes * 2)
  return Math.min(500, 200 + nAgentes * 8)
}

/**
 * Prioriza días por debajo del mínimo operativo M/T/N (columnas del pie).
 */
function equilibrarMinimosOperativos(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  minimosSemana: MinimosSemana,
  puestos: PuestoConfig[],
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
  gateGlobal = false,
) {
  const nDias = diasDelMes(anio, mes)
  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)
  const turnos: TurnoOperativo[] = ['M', 'T', 'N']

  for (
    let iter = 0;
    iter < maxIteracionesMinimos(agenteIds.length, gateGlobal);
    iter++
  ) {
    let mejorado = false

    for (const turno of turnos) {
      const ids = grupos.get(turno) ?? []
      if (ids.length === 0) continue

      const pisos = Array.from({ length: nDias }, (_, dia) => {
        const minimos = minimosParaFecha(
          isoFechaCuadrante(anio, mes, dia + 1),
          eventos,
          minimosSemana,
          puestos,
        )
        return totalMinimosTurno(minimos, turno, puestos)
      })

      const deficits: Array<{ dia: number; deficit: number }> = []
      for (let dia = 0; dia < nDias; dia++) {
        const conteo = conteoTurnoDia(cuadrante, ids, dia, turno)
        const deficit = pisos[dia] - conteo
        if (deficit > 0) deficits.push({ dia, deficit })
      }
      if (deficits.length === 0) continue
      deficits.sort((a, b) => {
        const cA = conteoTurnoDia(cuadrante, ids, a.dia, turno)
        const cB = conteoTurnoDia(cuadrante, ids, b.dia, turno)
        if (cA === 0 && cB > 0) return -1
        if (cB === 0 && cA > 0) return 1
        return b.deficit - a.deficit
      })

      for (const { dia: diaBajo } of deficits) {
        let progresoEnDia = true
        while (progresoEnDia) {
          progresoEnDia = false
          if (conteoTurnoDia(cuadrante, ids, diaBajo, turno) >= pisos[diaBajo]) {
            break
          }

          const cobertura = coberturaTurnoPorDia(cuadrante, ids, turno, nDias)
          const diasAltos: number[] = []
          for (let dia = 0; dia < nDias; dia++) {
            if (dia === diaBajo) continue
            if (cobertura[dia] > pisos[dia]) diasAltos.push(dia)
          }
          diasAltos.sort((a, b) => cobertura[b] - cobertura[a])

          const candidatos: Array<{ id: string; alto: number; score: number }> = []
          for (const alto of diasAltos) {
            for (const id of ids) {
              const fila = cuadrante[id]
              if (!fila || fila[alto] !== turno || fila[diaBajo] !== 'D') continue
              candidatos.push({
                id,
                alto,
                score:
                  (cobertura[diaBajo] === 0 ? 10000 : 0) +
                  (cobertura[alto] - pisos[alto]) * 50 +
                  puntuacionCandidato(fila, alto, diaBajo),
              })
            }
          }
          candidatos.sort((a, b) => b.score - a.score)

          for (const cand of candidatos) {
            const fila = cuadrante[cand.id]
            if (!fila) continue
            const siguiente = intentarTrasladoParaMinimos(
              fila,
              cand.alto,
              diaBajo,
              turno,
              anio,
              mes,
            )
            if (!siguiente) continue
            if (gateGlobal) {
              const aplicado = intentarMejoraGlobal(
                cuadrante,
                [cand.id],
                () => {
                  cuadrante[cand.id] = siguiente
                },
                agenteIds,
                planAnual,
                anio,
                mes,
                eventos,
                opciones,
              )
              if (!aplicado) continue
            } else {
              cuadrante[cand.id] = siguiente
            }
            mejorado = true
            progresoEnDia = true
            break
          }

          if (!progresoEnDia) {
            for (const id of ids) {
              const fila = cuadrante[id]
              if (!fila || fila[diaBajo] === turno) continue
              const rotada = intentarRotarAgenteParaMinimos(
                fila,
                diaBajo,
                turno,
                anio,
                mes,
              )
              if (!rotada) continue
              if (gateGlobal) {
                const aplicado = intentarMejoraGlobal(
                  cuadrante,
                  [id],
                  () => {
                    cuadrante[id] = rotada
                  },
                  agenteIds,
                  planAnual,
                  anio,
                  mes,
                  eventos,
                  opciones,
                )
                if (!aplicado) continue
              } else {
                cuadrante[id] = rotada
              }
              mejorado = true
              progresoEnDia = true
              break
            }
          }

          if (!progresoEnDia) {
            for (let a = 0; a < ids.length; a++) {
              for (let b = a + 1; b < ids.length; b++) {
                const filaA = cuadrante[ids[a]]
                const filaB = cuadrante[ids[b]]
                if (!filaA || !filaB) continue
                const intercambio = intentarIntercambioDiaEntreAgentes(
                  filaA,
                  filaB,
                  diaBajo,
                  turno,
                  anio,
                  mes,
                )
                if (!intercambio) continue
                if (gateGlobal) {
                  const aplicado = intentarMejoraGlobal(
                    cuadrante,
                    [ids[a], ids[b]],
                    () => {
                      cuadrante[ids[a]] = intercambio[0]
                      cuadrante[ids[b]] = intercambio[1]
                    },
                    agenteIds,
                    planAnual,
                    anio,
                    mes,
                    eventos,
                    opciones,
                  )
                  if (!aplicado) continue
                } else {
                  cuadrante[ids[a]] = intercambio[0]
                  cuadrante[ids[b]] = intercambio[1]
                }
                mejorado = true
                progresoEnDia = true
                break
              }
              if (progresoEnDia) break
            }
          }
        }
      }
    }

    if (!mejorado) break
  }
}

function refinarFilaFindes(
  fila: Turno[],
  turno: TurnoOperativoMes,
  anio: number,
  mes: number,
) {
  let actualizada = unificarFindesPartidos(fila, turno, anio, mes)
  const conFindes = equilibrarFindesConsecutivos(
    actualizada,
    anio,
    mes,
    turno,
    (prueba, original) => filaAceptable(prueba, original, anio, mes, true),
  )
  if (filaAceptable(conFindes, actualizada, anio, mes, true)) {
    actualizada = conFindes
  }
  const conUnico = equilibrarFindesUnicoMes(
    actualizada,
    anio,
    mes,
    turno,
    (prueba, original) => filaAceptable(prueba, original, anio, mes, true),
  )
  if (filaAceptable(conUnico, actualizada, anio, mes, true)) {
    actualizada = conUnico
  }
  const conTope = equilibrarFindesLaboradosMes(
    actualizada,
    anio,
    mes,
    turno,
    (prueba, original) => filaAceptable(prueba, original, anio, mes, true),
  )
  if (filaAceptable(conTope, actualizada, anio, mes, true)) {
    actualizada = conTope
  }
  return actualizada
}

function refinarReglasFindesFilas(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
) {
  const nDias = diasDelMes(anio, mes)
  for (const id of agenteIds) {
    const turno = turnoOperativoMes(planAnual[id]?.[mes - 1])
    const fila = cuadrante[id]
    if (!turno || !fila || fila.length !== nDias) continue
    cuadrante[id] = refinarFilaFindes(fila, turno, anio, mes)
  }
}

function refinarFindesFilasConScore(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  const nDias = diasDelMes(anio, mes)
  let mejorado = false
  for (const id of agenteIds) {
    const turno = turnoOperativoMes(planAnual[id]?.[mes - 1])
    const fila = cuadrante[id]
    if (!turno || !fila || fila.length !== nDias) continue
    const refinada = refinarFilaFindes(fila, turno, anio, mes)
    if (refinada.every((t, i) => t === fila[i])) continue
    const aplicado = intentarMejoraGlobal(
      cuadrante,
      [id],
      () => {
        cuadrante[id] = refinada
      },
      agenteIds,
      planAnual,
      anio,
      mes,
      eventos,
      opciones,
    )
    if (aplicado) mejorado = true
  }
  return mejorado
}

/**
 * Refinado final coordinado: solo acepta movimientos que mejoran la puntuación global
 * (mínimos → findes nf → equilibrio NF festivos/conciliaciones).
 */
async function refinarCuadranteSudokuAsync(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones: OpcionesGeneracionCuadranteMensual,
) {
  const minimosSemana = opciones.minimosSemana!
  const puestos = opciones.puestos!

  for (let ronda = 0; ronda < MAX_RONDAS_REFINO_SUDOKU; ronda++) {
    await yieldToMain()
    const scoreAntes = puntuarCuadrante(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      eventos,
      opciones,
    )

    await equilibrarVariablesCobroAsync(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      eventos,
      opciones,
      true,
    )
    await yieldToMain()
    equilibrarMinimosOperativos(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      minimosSemana,
      puestos,
      eventos,
      opciones,
      true,
    )
    await yieldToMain()
    refinarFindesFilasConScore(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      eventos,
      opciones,
    )
    await yieldToMain()
    equilibrarMinimosOperativos(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      minimosSemana,
      puestos,
      eventos,
      opciones,
      true,
    )

    const scoreDespues = puntuarCuadrante(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      eventos,
      opciones,
    )
    if (scoreDespues === 0) break
    if (scoreDespues >= scoreAntes) break
  }
}

function aplicarRefinadoCuadrante(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  equilibrarCoberturaPorTurno(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    opciones,
    eventos,
  )
  equilibrarCoberturaDiaria(cuadrante, agenteIds, anio, mes)
  equilibrarCoberturaPorTurno(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    opciones,
    eventos,
  )
  equilibrarVariablesCobro(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
  )
  if (tieneContextoMinimos(opciones)) {
    equilibrarMinimosOperativos(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      opciones!.minimosSemana!,
      opciones!.puestos!,
      eventos,
      opciones,
    )
  }
  refinarReglasFindesFilas(cuadrante, agenteIds, planAnual, anio, mes)
  if (tieneContextoMinimos(opciones)) {
    equilibrarMinimosOperativos(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      opciones!.minimosSemana!,
      opciones!.puestos!,
      eventos,
      opciones,
    )
  }
}

function aplicarRefinadoFinalCuadrante(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  if (!tieneContextoMinimos(opciones)) {
    equilibrarCoberturaPorTurno(cuadrante, agenteIds, planAnual, anio, mes)
    return
  }

  // Versión síncrona (tests/scripts): una ronda rápida sin bloquear demasiado.
  const minimosSemana = opciones!.minimosSemana!
  const puestos = opciones!.puestos!
  equilibrarVariablesCobro(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
    true,
  )
  equilibrarMinimosOperativos(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    minimosSemana,
    puestos,
    eventos,
    opciones,
    true,
  )
  refinarFindesFilasConScore(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
  )
}

function tieneContextoMinimos(opciones?: OpcionesGeneracionCuadranteMensual) {
  return Boolean(opciones?.minimosSemana && opciones?.puestos?.length)
}

function contextoMetricasCuadrante(
  opciones?: OpcionesGeneracionCuadranteMensual,
): ContextoMetricasCuadrante | undefined {
  if (!tieneContextoMinimos(opciones)) return undefined
  return {
    minimosSemana: opciones!.minimosSemana,
    puestos: opciones!.puestos,
  }
}

function puntuarCuadrante(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  return puntuacionGlobalCuadrante(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    contextoMetricasCuadrante(opciones),
  )
}

function intentarMejoraGlobal(
  cuadrante: CuadranteMensual,
  idsAfectados: string[],
  aplicar: () => void,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  const ctx = contextoMetricasCuadrante(opciones)
  if (!ctx) {
    aplicar()
    return true
  }
  const backup = new Map(
    idsAfectados.map((id) => [id, [...(cuadrante[id] ?? [])]]),
  )
  const antes = puntuacionGlobalCuadrante(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    ctx,
  )
  aplicar()
  const despues = puntuacionGlobalCuadrante(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    ctx,
  )
  if (despues > antes) {
    for (const [id, fila] of backup) cuadrante[id] = fila
    return false
  }
  return true
}

async function aplicarRefinadoCuadranteAsync(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  equilibrarCoberturaPorTurno(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    opciones,
    eventos,
  )
  await yieldToMain()
  equilibrarCoberturaDiaria(cuadrante, agenteIds, anio, mes)
  await yieldToMain()
  equilibrarCoberturaPorTurno(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    opciones,
    eventos,
  )
  await yieldToMain()
  await equilibrarVariablesCobroAsync(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
  )
  await yieldToMain()
  if (tieneContextoMinimos(opciones)) {
    equilibrarMinimosOperativos(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      opciones!.minimosSemana!,
      opciones!.puestos!,
      eventos,
      opciones,
    )
    await yieldToMain()
  }
  refinarReglasFindesFilas(cuadrante, agenteIds, planAnual, anio, mes)
  await yieldToMain()
  if (tieneContextoMinimos(opciones)) {
    equilibrarMinimosOperativos(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      opciones!.minimosSemana!,
      opciones!.puestos!,
      eventos,
      opciones,
    )
    await yieldToMain()
  }
}

async function aplicarRefinadoFinalCuadranteAsync(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  if (!tieneContextoMinimos(opciones)) {
    equilibrarCoberturaPorTurno(cuadrante, agenteIds, planAnual, anio, mes)
    await yieldToMain()
    return
  }

  await refinarCuadranteSudokuAsync(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones!,
  )
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
    const findesMes = findesLaboradosEnMes(candidata, anio, mes)
    if (!findesMesCuadra(findesMes)) continue
    const partidos = countFindesPartidos(candidata, anio, mes)
    const score =
      partidos * 100 +
      extra +
      Math.max(0, findesMes - OBJETIVO_FINDES_MES) * 40
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
    const conUnico = equilibrarFindesUnicoMes(
      fila,
      anio,
      mes,
      turnoBase,
      (prueba, original) => filaAceptable(prueba, original, anio, mes, false),
    )
    if (filaAceptable(conUnico, fila, anio, mes, false)) {
      fila = conUnico
    }
    const conTopeFindes = equilibrarFindesLaboradosMes(
      fila,
      anio,
      mes,
      turnoBase,
      (prueba, original) => filaAceptable(prueba, original, anio, mes, false),
    )
    if (filaAceptable(conTopeFindes, fila, anio, mes, false)) {
      fila = conTopeFindes
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
  return (
    filaAceptableParaMinimos(pruebaA, filaA, anio, mes) &&
    filaAceptableParaMinimos(pruebaB, filaB, anio, mes)
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
  opciones?: OpcionesGeneracionCuadranteMensual,
  gateGlobal = false,
): CuadranteMensual {
  return equilibrarVariablesCobroInterno(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
    gateGlobal,
  )
}

async function equilibrarVariablesCobroAsync(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[] = [],
  opciones?: OpcionesGeneracionCuadranteMensual,
  gateGlobal = false,
): Promise<CuadranteMensual> {
  const nDias = diasDelMes(anio, mes)
  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)

  for (const [turno, ids] of grupos) {
    if (ids.length < 2) continue
    const maxIter = maxIteracionesVariables(ids.length)

    for (let iter = 0; iter < maxIter; iter++) {
      if (iter % 4 === 0) await yieldToMain()
      if (
        !equilibrarVariablesCobroPaso(
          cuadrante,
          agenteIds,
          planAnual,
          ids,
          turno,
          anio,
          mes,
          nDias,
          eventos,
          opciones,
          gateGlobal,
        )
      ) {
        break
      }
    }
  }

  return cuadrante
}

function equilibrarVariablesCobroInterno(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
  gateGlobal = false,
): CuadranteMensual {
  const nDias = diasDelMes(anio, mes)
  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)

  for (const [turno, ids] of grupos) {
    if (ids.length < 2) continue
    const maxIter = maxIteracionesVariables(ids.length)

    for (let iter = 0; iter < maxIter; iter++) {
      if (
        !equilibrarVariablesCobroPaso(
          cuadrante,
          agenteIds,
          planAnual,
          ids,
          turno,
          anio,
          mes,
          nDias,
          eventos,
          opciones,
          gateGlobal,
        )
      ) {
        break
      }
    }
  }

  return cuadrante
}

function equilibrarVariablesCobroPaso(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  ids: string[],
  turno: TurnoOperativoMes,
  anio: number,
  mes: number,
  nDias: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
  gateGlobal = false,
) {
  const puntajeVariablesAntes = puntajeVariablesGrupo(
    cuadrante,
    ids,
    anio,
    mes,
    eventos,
  )
  const scoreGlobalAntes = gateGlobal
    ? puntuarCuadrante(
        cuadrante,
        agenteIds,
        planAnual,
        anio,
        mes,
        eventos,
        opciones,
      )
    : 0
  if (puntajeVariablesAntes === 0 && (!gateGlobal || scoreGlobalAntes === 0)) {
    return false
  }

  const limitePares = Math.min(8, Math.max(3, Math.ceil(ids.length / 4)))
  const conteos = conteosVariablesGrupo(cuadrante, ids, anio, mes, eventos)
  const sumatoriosF = sumatoriosFGrupo(cuadrante, ids, anio, mes, eventos)
  const cargas = ids.map(
    (_, i) =>
      sumatoriosF[i] * 20 +
      totalConciliaciones(conteos[i]) * 15 +
      totalVariablesCobro(conteos[i]),
  )
  const orden = ids
    .map((id, i) => ({ id, i, carga: cargas[i] }))
    .sort((a, b) => b.carga - a.carga)
  const masCargados = orden.slice(0, limitePares)
  const menosCargados = orden.slice(-limitePares).reverse()

  let mejorSwap: {
    idA: string
    idB: string
    idx: number
    puntaje: number
  } | null = null

  for (const { id: idA, i } of masCargados) {
    for (const { id: idB, i: j } of menosCargados) {
      if (i === j) continue
      const filaA = cuadrante[idA]
      const filaB = cuadrante[idB]
      if (!filaA || !filaB) continue
      if (cargas[i] <= cargas[j]) continue

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
        const puntajeSwap = gateGlobal
          ? puntuarCuadrante(
              copia,
              agenteIds,
              planAnual,
              anio,
              mes,
              eventos,
              opciones,
            )
          : puntajeVariablesGrupo(copia, ids, anio, mes, eventos)
        const umbral = gateGlobal ? scoreGlobalAntes : puntajeVariablesAntes
        if (puntajeSwap >= umbral) continue

        if (!mejorSwap || puntajeSwap < mejorSwap.puntaje) {
          mejorSwap = { idA, idB, idx, puntaje: puntajeSwap }
        }
      }
    }
  }

  if (!mejorSwap) return false

  const filaA = cuadrante[mejorSwap.idA]!
  const filaB = cuadrante[mejorSwap.idB]!
  const pruebaA = [...filaA]
  const pruebaB = [...filaB]
  pruebaA[mejorSwap.idx] = 'D'
  pruebaB[mejorSwap.idx] = turno
  cuadrante[mejorSwap.idA] = pruebaA
  cuadrante[mejorSwap.idB] = pruebaB
  return true
}

export function generarCuadranteMensual(
  planAnual: PlanAnual,
  agenteIds: string[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[] = [],
  opciones?: OpcionesGeneracionCuadranteMensual,
): CuadranteMensual {
  const cuadrante = construirCuadranteInicial(planAnual, agenteIds, anio, mes)
  for (let pase = 0; pase < PASADAS_REFINO_CUADRANTE_MENSUAL; pase++) {
    aplicarRefinadoCuadrante(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      eventos,
      opciones,
    )
  }
  aplicarRefinadoFinalCuadrante(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
  )
  return cuadrante
}

function construirCuadranteInicial(
  planAnual: PlanAnual,
  agenteIds: string[],
  anio: number,
  mes: number,
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

  return cuadrante
}

async function equilibrarCuadranteGenerado(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesGeneracionCuadranteMensual,
) {
  for (let pase = 0; pase < PASADAS_REFINO_CUADRANTE_MENSUAL; pase++) {
    await aplicarRefinadoCuadranteAsync(
      cuadrante,
      agenteIds,
      planAnual,
      anio,
      mes,
      eventos,
      opciones,
    )
  }
  await aplicarRefinadoFinalCuadranteAsync(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
  )
}

/** Versión asíncrona: cede el hilo entre pasadas para no bloquear la UI. */
export async function generarCuadranteMensualAsync(
  planAnual: PlanAnual,
  agenteIds: string[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[] = [],
  opciones?: OpcionesGeneracionCuadranteMensual,
): Promise<CuadranteMensual> {
  const cuadrante = construirCuadranteInicial(planAnual, agenteIds, anio, mes)
  await yieldToMain()
  await equilibrarCuadranteGenerado(
    cuadrante,
    agenteIds,
    planAnual,
    anio,
    mes,
    eventos,
    opciones,
  )
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
