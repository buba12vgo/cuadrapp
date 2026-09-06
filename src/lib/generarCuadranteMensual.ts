import type { Turno, FichaPolicia } from '@/types'
import type { PlanAnual, TurnoAnual } from '@/lib/generarPlanAnual'
import { esSoloMananaYTarde } from '@/lib/limitaciones'
import {
  MAX_DIAS_CONTINUOS,
  MIN_DESCANSO_SEGUIDO,
  MIN_DESCANSO_TRAS_NOCHE,
  diasDelMes,
  diasOperativosConvenio,
  esDiaTrabajado,
  totalTrabajados,
} from '@/lib/convenio'
import {
  MAX_FINDES_CONSECUTIVOS,
  equilibrarFindesConsecutivos,
  maxFindesConsecutivosLaborados,
} from '@/lib/finesSemana'

export type CuadranteMensual = Record<string, Turno[]>

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

function indicesJornada(fila: Turno[]) {
  const indices: number[] = []
  for (let i = 0; i < fila.length; i++) {
    if (esDiaTrabajado(fila[i])) indices.push(i)
  }
  return indices
}

function contarTurnoLaboral(fila: Turno[], turno: 'M' | 'T') {
  let n = 0
  for (const valor of fila) {
    if (valor === turno) n += 1
  }
  return n
}

function tieneSecuenciaProhibidaTM(fila: Turno[]) {
  for (let i = 1; i < fila.length; i++) {
    if (fila[i - 1] === 'T' && fila[i] === 'M') return true
  }
  return false
}

function turnoLaboralEnIndice(fila: Turno[], indice: number) {
  const turno = fila[indice]
  if (turno === 'M' || turno === 'T' || turno === 'N') return turno
  return null
}

function puedeAsignarTurnoMT(fila: Turno[], indice: number, turno: 'M' | 'T') {
  if (turno === 'M' && indice > 0 && fila[indice - 1] === 'T') return false
  if (turno === 'T' && indice < fila.length - 1 && fila[indice + 1] === 'M') {
    return false
  }
  return true
}

function filaMixMTValida(fila: Turno[]) {
  if (!filaSinGraves(fila)) return false
  return !tieneSecuenciaProhibidaTM(fila)
}

/**
 * Reparte jornadas entre M y T (~50/50, p. ej. 8-9 en un mes de 17 días)
 * para agentes sin noches. Respeta T→M prohibido.
 */
export function repartirMixMananaTarde(fila: Turno[]): Turno[] {
  const indices = indicesJornada(fila)
  const n = indices.length
  if (n < 2) return fila

  const objetivoM = Math.floor(n / 2)
  const objetivoT = n - objetivoM
  const prueba = [...fila]

  function buscar(
    pos: number,
    m: number,
    t: number,
  ): Turno[] | null {
    if (pos === indices.length) {
      if (m !== objetivoM || t !== objetivoT) return null
      return filaMixMTValida(prueba) ? [...prueba] : null
    }

    const indice = indices[pos]
    for (const turno of ['M', 'T'] as const) {
      if (turno === 'M' && m >= objetivoM) continue
      if (turno === 'T' && t >= objetivoT) continue
      if (!puedeAsignarTurnoMT(prueba, indice, turno)) continue
      prueba[indice] = turno
      const solucion = buscar(
        pos + 1,
        m + (turno === 'M' ? 1 : 0),
        t + (turno === 'T' ? 1 : 0),
      )
      if (solucion) return solucion
    }
    return null
  }

  return buscar(0, 0, 0) ?? fila
}

function equilibrarMixMTEntreAgentes(
  cuadrante: CuadranteMensual,
  ids: string[],
  anio: number,
  mes: number,
) {
  const mtIds = ids.filter((id) => {
    const fila = cuadrante[id]
    if (!fila) return false
    return fila.some((turno) => turno === 'M') && fila.some((turno) => turno === 'T')
  })
  if (mtIds.length < 2) return

  const nDias = cuadrante[mtIds[0]]?.length ?? 0
  for (let iter = 0; iter < 120; iter++) {
    let cambio = false
    const cargas = mtIds.map((id) => {
      const fila = cuadrante[id]!
      return {
        id,
        m: contarTurnoLaboral(fila, 'M'),
        t: contarTurnoLaboral(fila, 'T'),
      }
    })
    cargas.sort((a, b) => b.m - a.m - (a.t - b.t))

    const masM = cargas[0]
    const masT = cargas[cargas.length - 1]
    if (!masM || !masT || masM.id === masT.id) break
    if (masM.m - masM.t <= 1 && masT.t - masM.m <= 1) break

    const filaA = cuadrante[masM.id]!
    const filaB = cuadrante[masT.id]!

    for (let dia = 0; dia < nDias; dia++) {
      if (filaA[dia] !== 'M' || filaB[dia] !== 'T') continue
      const pruebaA = [...filaA]
      const pruebaB = [...filaB]
      pruebaA[dia] = 'T'
      pruebaB[dia] = 'M'
      if (
        !filaMixMTValida(pruebaA) ||
        !filaMixMTValida(pruebaB) ||
        !filaAceptable(pruebaA, filaA, anio, mes, true) ||
        !filaAceptable(pruebaB, filaB, anio, mes, true)
      ) {
        continue
      }
      cuadrante[masM.id] = pruebaA
      cuadrante[masT.id] = pruebaB
      cambio = true
      break
    }
    if (!cambio) break
  }
}

function filaTieneJornadas(fila: Turno[]) {
  return indicesJornada(fila).length > 0
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
    !permitirFindes &&
    maxFindesConsecutivosLaborados(prueba, anio, mes) > MAX_FINDES_CONSECUTIVOS
  ) {
    return false
  }
  return true
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
    return fila != null && filaTieneJornadas(fila)
  })

  const intentarMover = (
    diasBajos: number[],
    diasAltos: number[],
    cobertura: number[],
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
        if (cobertura[alto] - cobertura[bajo] < 2) continue
        for (const id of ids) {
          const fila = cuadrante[id]
          if (!fila) continue
          if (!esDiaTrabajado(fila[alto]) || fila[bajo] !== 'D') continue
          const turnoCelda = turnoLaboralEnIndice(fila, alto)
          if (!turnoCelda) continue
          const priorizaCero = cobertura[bajo] === 0 ? 1000 : 0
          candidatos.push({
            id,
            alto,
            bajo,
            score:
              priorizaCero +
              (cobertura[alto] - cobertura[bajo]) * 20 +
              puntuacionCandidato(fila, alto, bajo),
          })
        }
      }
    }
    candidatos.sort((a, b) => b.score - a.score)
    for (const cand of candidatos) {
      const fila = cuadrante[cand.id]
      if (!fila) continue
      const turno = turnoLaboralEnIndice(fila, cand.alto)
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
    for (let iter = 0; iter < 300; iter++) {
      const cobertura = coberturaPorDia(cuadrante, ids, nDias)
      const minimo = Math.min(...cobertura)
      const maximo = Math.max(...cobertura)
      if (maximo - minimo <= 1) break

      const extremos = intentarMover(
        diasPorCobertura(cobertura, (v) => v === minimo),
        diasPorCobertura(cobertura, (v) => v === maximo),
        cobertura,
        permitirFindes,
      )
      if (extremos) continue

      const ampliados = intentarMover(
        diasPorCobertura(cobertura, (v) => v <= minimo + 1),
        diasPorCobertura(cobertura, (v) => v >= maximo - 1),
        cobertura,
        permitirFindes,
      )
      if (ampliados) continue

      const todosBajos = diasPorCobertura(cobertura, (v) => v < maximo - 1)
      const todosAltos = diasPorCobertura(cobertura, (v) => v > minimo + 1)
      if (!intentarMover(todosBajos, todosAltos, cobertura, permitirFindes)) {
        break
      }
    }
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
  if (!filaSinGraves(fila)) {
    for (let extra = 1; extra < 16; extra++) {
      const candidata = construirFila(
        turnoBase,
        nDias,
        nLaborables,
        minEntre,
        offsetDescansoInicial + extra,
      )
      if (filaSinGraves(candidata)) {
        fila = candidata
        break
      }
    }
  }

  if (turnoBase === 'M' || turnoBase === 'T' || turnoBase === 'N') {
    const conFindes = equilibrarFindesConsecutivos(fila, anio, mes, turnoBase)
    if (filaSinGraves(conFindes)) return conFindes
  }
  return fila
}

export function generarCuadranteMensual(
  planAnual: PlanAnual,
  agentes: FichaPolicia[],
  anio: number,
  mes: number,
): CuadranteMensual {
  const agentePorId = new Map(agentes.map((agente) => [agente.id, agente]))
  const agenteIds = agentes.map((agente) => agente.id)
  const cuadrante: CuadranteMensual = {}

  agenteIds.forEach((id, indice) => {
    const turnoBase = planAnual[id]?.[mes - 1]
    if (!turnoBase) {
      const nDias = diasDelMes(anio, mes)
      cuadrante[id] = Array.from({ length: nDias }, () => 'D')
      return
    }

    let fila = generarFilaMensual(turnoBase, anio, mes, indice)
    const agente = agentePorId.get(id)
    if (
      agente &&
      esSoloMananaYTarde(agente.limitaciones) &&
      turnoBase !== 'V'
    ) {
      fila = repartirMixMananaTarde(fila)
    }
    cuadrante[id] = fila
  })

  equilibrarMixMTEntreAgentes(cuadrante, agenteIds, anio, mes)
  return equilibrarCoberturaDiaria(cuadrante, agenteIds, anio, mes)
}

export function siguienteTurnoDia(actual: Turno): Turno {
  const ciclo: Turno[] = ['M', 'T', 'N', 'L', 'D', 'V']
  const indice = ciclo.indexOf(actual)
  return ciclo[(indice + 1) % ciclo.length]
}

export function maxDiasContinuos(fila: Turno[]) {
  return maxDiasContinuosFila(fila)
}
