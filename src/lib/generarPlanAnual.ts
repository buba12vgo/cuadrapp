import type { FichaPolicia } from '@/types'

export type TurnoAnual = 'M' | 'T' | 'N' | 'V'
export type ObjetivosGlobales = { M: number; T: number; N: number }
export type PlanAnual = Record<string, TurnoAnual[]>

const MESES = 12
const TURNOS_ACTIVOS = ['M', 'T', 'N'] as const
type TurnoActivo = (typeof TURNOS_ACTIVOS)[number]

const MES_ANCLA: Record<FichaPolicia['mesAnclaVacaciones'], number> = {
  JUNIO: 5,
  JULIO: 6,
  AGOSTO: 7,
  SEPTIEMBRE: 8,
}

type Cupos = { M: number; T: number; N: number }
type Fila = (TurnoAnual | null)[]

function distCircular(a: number, b: number) {
  const d = Math.abs(a - b)
  return Math.min(d, MESES - d)
}

function huecos(fila: Fila) {
  const meses: number[] = []
  for (let mes = 0; mes < MESES; mes++) {
    if (fila[mes] == null) meses.push(mes)
  }
  return meses
}

function puedeNoche(fila: Fila, mes: number, minDist: number) {
  if (fila[mes] != null) return false
  for (let otro = 0; otro < MESES; otro++) {
    if (fila[otro] !== 'N') continue
    if (distCircular(mes, otro) < minDist) return false
  }
  return true
}

function puedeColocarNoche(
  fila: TurnoAnual[],
  mes: number,
  minDist: number,
) {
  for (let otro = 0; otro < MESES; otro++) {
    if (otro === mes) continue
    if (fila[otro] !== 'N') continue
    if (distCircular(mes, otro) < minDist) return false
  }
  return true
}

/** Reparte `libres` meses según % M/T/N (método del resto mayor). */
export function cuposDesdePorcentajes(
  libres: number,
  objetivos: ObjetivosGlobales,
): Cupos {
  if (libres <= 0) return { M: 0, T: 0, N: 0 }
  const sumaPct = objetivos.M + objetivos.T + objetivos.N
  if (sumaPct <= 0) return { M: libres, T: 0, N: 0 }

  const exactos = {
    M: (libres * objetivos.M) / sumaPct,
    T: (libres * objetivos.T) / sumaPct,
    N: (libres * objetivos.N) / sumaPct,
  }
  const cupos: Cupos = {
    M: Math.floor(exactos.M),
    T: Math.floor(exactos.T),
    N: Math.floor(exactos.N),
  }
  let resto = libres - cupos.M - cupos.T - cupos.N
  const orden = [...TURNOS_ACTIVOS].sort((a, b) => {
    const fa = exactos[a] - cupos[a]
    const fb = exactos[b] - cupos[b]
    if (fb !== fa) return fb - fa
    return TURNOS_ACTIVOS.indexOf(a) - TURNOS_ACTIVOS.indexOf(b)
  })
  for (const turno of orden) {
    if (resto <= 0) break
    cupos[turno] += 1
    resto -= 1
  }
  return cupos
}

function cuposLaborales(
  agente: FichaPolicia,
  libres: number,
  objetivosGlobales?: ObjetivosGlobales,
): Cupos {
  const lim = agente.limitaciones

  if (libres <= 0) return { M: 0, T: 0, N: 0 }
  if (lim.soloManana) return { M: libres, T: 0, N: 0 }

  const base = objetivosGlobales
    ? cuposDesdePorcentajes(libres, objetivosGlobales)
    : {
        M: Math.max(0, agente.preferenciaAnual.objetivoM),
        T: Math.max(0, agente.preferenciaAnual.objetivoT),
        N: Math.max(0, agente.preferenciaAnual.objetivoN),
      }

  if (lim.soloMananaNoche) {
    const N = Math.min(Math.max(0, base.N), libres)
    return { M: libres - N, T: 0, N }
  }

  if (lim.exentoNoches) {
    const T = Math.min(Math.max(0, base.T), libres)
    return { M: libres - T, T, N: 0 }
  }

  let { M, T, N } = base
  const suma = M + T + N
  if (suma === 0) return { M: libres, T: 0, N: 0 }
  if (suma > libres) {
    N = Math.min(N, libres)
    T = Math.min(T, libres - N)
    M = libres - N - T
  } else if (suma < libres) {
    M += libres - suma
  }
  return { M, T, N }
}

function capacidadN(fila: Fila, minDist: number) {
  let mejor = 0
  for (const invertido of [false, true]) {
    for (let fase = 0; fase < minDist; fase++) {
      const copia = [...fila]
      let n = 0
      for (let k = 0; k < MESES; k++) {
        const mes = invertido
          ? (fase - k + MESES * 2) % MESES
          : (fase + k) % MESES
        if (!puedeNoche(copia, mes, minDist)) continue
        copia[mes] = 'N'
        n += 1
      }
      mejor = Math.max(mejor, n)
    }
  }
  return mejor
}

function asignarFila(
  agente: FichaPolicia,
  objetivosGlobales?: ObjetivosGlobales,
): TurnoAnual[] {
  const fila: Fila = Array.from({ length: MESES }, () => null)
  fila[MES_ANCLA[agente.mesAnclaVacaciones]] = 'V'

  const cupos = cuposLaborales(agente, huecos(fila).length, objetivosGlobales)
  const minDists = cupos.N <= capacidadN(fila, 3) ? [3] : [2]

  for (const minDist of minDists) {
    for (const invertido of [false, true]) {
      if (cupos.N <= 0) break
      const candidatos = invertido ? [...huecos(fila)].reverse() : huecos(fila)
      for (const mes of candidatos) {
        if (cupos.N <= 0) break
        if (!puedeNoche(fila, mes, minDist)) continue
        fila[mes] = 'N'
        cupos.N -= 1
      }
    }
  }

  cupos.T += cupos.N
  cupos.N = 0

  for (const mes of huecos(fila)) {
    if (cupos.T <= 0) break
    fila[mes] = 'T'
    cupos.T -= 1
  }

  for (const mes of huecos(fila)) {
    fila[mes] = 'M'
  }

  return fila.map((turno) => turno ?? 'M')
}

function permiteTurno(agente: FichaPolicia, turno: TurnoActivo) {
  const lim = agente.limitaciones
  if (lim.soloManana) return turno === 'M'
  if (lim.soloMananaNoche) return turno === 'M' || turno === 'N'
  if (lim.exentoNoches) return turno === 'M' || turno === 'T'
  return true
}

function contarFlota(plan: PlanAnual, agentes: FichaPolicia[]): Cupos {
  const total: Cupos = { M: 0, T: 0, N: 0 }
  for (const agente of agentes) {
    for (const turno of plan[agente.id] ?? []) {
      if (turno === 'M' || turno === 'T' || turno === 'N') total[turno] += 1
    }
  }
  return total
}

function objetivosACantidades(
  totalActivos: number,
  objetivos: ObjetivosGlobales,
): Cupos {
  return cuposDesdePorcentajes(totalActivos, objetivos)
}

function puedeRecibir(
  agente: FichaPolicia,
  fila: TurnoAnual[],
  mes: number,
  turno: TurnoActivo,
) {
  if (!permiteTurno(agente, turno)) return false
  if (fila[mes] === 'V') return false
  if (turno === 'N') return puedeColocarNoche(fila, mes, 2)
  return true
}

function desviacionObjetivo(real: Cupos, objetivo: Cupos) {
  return (
    Math.abs(real.M - objetivo.M) +
    Math.abs(real.T - objetivo.T) +
    Math.abs(real.N - objetivo.N)
  )
}

function intentarIntercambio(
  plan: PlanAnual,
  agentesById: Map<string, FichaPolicia>,
  idA: string,
  mesA: number,
  idB: string,
  mesB: number,
) {
  const filaA = plan[idA]
  const filaB = plan[idB]
  if (!filaA || !filaB) return false
  const turnoA = filaA[mesA]
  const turnoB = filaB[mesB]
  if (turnoA === 'V' || turnoB === 'V') return false
  if (turnoA === turnoB) return false
  if (turnoA !== 'M' && turnoA !== 'T' && turnoA !== 'N') return false
  if (turnoB !== 'M' && turnoB !== 'T' && turnoB !== 'N') return false

  const agenteA = agentesById.get(idA)
  const agenteB = agentesById.get(idB)
  if (!agenteA || !agenteB) return false

  // Simular intercambio
  const copiaA = [...filaA]
  const copiaB = idA === idB ? copiaA : [...filaB]
  copiaA[mesA] = turnoB
  copiaB[mesB] = turnoA

  if (!puedeRecibir(agenteA, copiaA, mesA, turnoB)) return false
  if (!puedeRecibir(agenteB, copiaB, mesB, turnoA)) return false

  plan[idA] = copiaA
  if (idA !== idB) plan[idB] = copiaB
  return true
}

function intentarConversion(
  plan: PlanAnual,
  agentesById: Map<string, FichaPolicia>,
  id: string,
  mes: number,
  destino: TurnoActivo,
) {
  const fila = plan[id]
  const agente = agentesById.get(id)
  if (!fila || !agente) return false
  const actual = fila[mes]
  if (actual !== 'M' && actual !== 'T' && actual !== 'N') return false
  if (actual === destino) return false
  if (!permiteTurno(agente, destino)) return false
  if (destino === 'N' && !puedeColocarNoche(fila, mes, 2)) return false

  const copia = [...fila]
  copia[mes] = destino
  plan[id] = copia
  return true
}

/**
 * Reajusta el plan con conversiones e intercambios para acercar el mix M/T/N
 * al objetivo global (año) y, en la medida de lo posible, por mes.
 */
function equilibrarObjetivosGlobales(
  plan: PlanAnual,
  agentes: FichaPolicia[],
  objetivos: ObjetivosGlobales,
) {
  if (agentes.length === 0) return

  const agentesById = new Map(agentes.map((agente) => [agente.id, agente]))
  const ids = agentes.map((agente) => agente.id)

  const realInicial = contarFlota(plan, agentes)
  const totalActivos = realInicial.M + realInicial.T + realInicial.N
  if (totalActivos <= 0) return
  const objetivoAnio = objetivosACantidades(totalActivos, objetivos)

  // 1) Conversiones directas: cambian el mix anual (M↔T↔N).
  for (let pase = 0; pase < 6; pase++) {
    const real = contarFlota(plan, agentes)
    if (desviacionObjetivo(real, objetivoAnio) === 0) break
    let mejorado = false

    for (const surplus of TURNOS_ACTIVOS) {
      for (const deficit of TURNOS_ACTIVOS) {
        if (surplus === deficit) continue
        while (
          real[surplus] > objetivoAnio[surplus] &&
          real[deficit] < objetivoAnio[deficit]
        ) {
          let convertido = false
          for (const id of ids) {
            const fila = plan[id]
            if (!fila) continue
            for (let mes = 0; mes < MESES; mes++) {
              if (fila[mes] !== surplus) continue
              if (intentarConversion(plan, agentesById, id, mes, deficit)) {
                real[surplus] -= 1
                real[deficit] += 1
                convertido = true
                mejorado = true
                break
              }
            }
            if (convertido) break
          }
          if (!convertido) break
        }
      }
    }
    if (!mejorado) break
  }

  // 2) Intercambios entre meses: redistribuyen el mix mensual sin empeorar el año.
  for (let pase = 0; pase < 12; pase++) {
    let mejorado = false
    const realAnio = contarFlota(plan, agentes)

    for (let mes = 0; mes < MESES; mes++) {
      const conteo: Cupos = { M: 0, T: 0, N: 0 }
      for (const id of ids) {
        const turno = plan[id]?.[mes]
        if (turno === 'M' || turno === 'T' || turno === 'N') conteo[turno] += 1
      }
      const activosMes = conteo.M + conteo.T + conteo.N
      if (activosMes <= 0) continue
      const objetivoMes = cuposDesdePorcentajes(activosMes, objetivos)
      if (desviacionObjetivo(conteo, objetivoMes) === 0) continue

      for (const surplus of TURNOS_ACTIVOS) {
        for (const deficit of TURNOS_ACTIVOS) {
          if (surplus === deficit) continue
          if (conteo[surplus] <= objetivoMes[surplus]) continue
          if (conteo[deficit] >= objetivoMes[deficit]) continue

          for (const idA of ids) {
            if (plan[idA]?.[mes] !== surplus) continue
            for (const idB of ids) {
              for (let mesB = 0; mesB < MESES; mesB++) {
                if (mesB === mes) continue
                if (plan[idB]?.[mesB] !== deficit) continue

                // ¿El mesB se beneficia o al menos no se destroza demasiado?
                const conteoB: Cupos = { M: 0, T: 0, N: 0 }
                for (const id of ids) {
                  const turno = plan[id]?.[mesB]
                  if (turno === 'M' || turno === 'T' || turno === 'N') {
                    conteoB[turno] += 1
                  }
                }
                const activosB = conteoB.M + conteoB.T + conteoB.N
                const objetivoB = cuposDesdePorcentajes(activosB, objetivos)
                const devBAntes = desviacionObjetivo(conteoB, objetivoB)
                const devMesAntes = desviacionObjetivo(conteo, objetivoMes)

                if (
                  !intentarIntercambio(plan, agentesById, idA, mes, idB, mesB)
                ) {
                  continue
                }

                const despuesAnio = contarFlota(plan, agentes)
                if (
                  desviacionObjetivo(despuesAnio, objetivoAnio) >
                  desviacionObjetivo(realAnio, objetivoAnio)
                ) {
                  intentarIntercambio(plan, agentesById, idA, mes, idB, mesB)
                  continue
                }

                const conteoDesp: Cupos = {
                  M: conteo.M,
                  T: conteo.T,
                  N: conteo.N,
                }
                conteoDesp[surplus] -= 1
                conteoDesp[deficit] += 1
                const conteoBDesp: Cupos = {
                  M: conteoB.M,
                  T: conteoB.T,
                  N: conteoB.N,
                }
                conteoBDesp[deficit] -= 1
                conteoBDesp[surplus] += 1
                const devMesDesp = desviacionObjetivo(conteoDesp, objetivoMes)
                const devBDesp = desviacionObjetivo(conteoBDesp, objetivoB)

                // Aceptar si mejora el mes actual y no empeora la suma de desviaciones.
                if (
                  devMesDesp + devBDesp > devMesAntes + devBAntes ||
                  devMesDesp >= devMesAntes
                ) {
                  intentarIntercambio(plan, agentesById, idA, mes, idB, mesB)
                  continue
                }

                conteo[surplus] -= 1
                conteo[deficit] += 1
                Object.assign(realAnio, despuesAnio)
                mejorado = true
                break
              }
              if (conteo[surplus] <= objetivoMes[surplus]) break
            }
            if (conteo[surplus] <= objetivoMes[surplus]) break
          }
        }
      }
    }

    if (!mejorado) break
  }
}

export function generarPlanAnual(
  agentes: FichaPolicia[],
  objetivosGlobales?: ObjetivosGlobales,
): PlanAnual {
  const plan: PlanAnual = {}
  for (const agente of agentes) {
    plan[agente.id] = asignarFila(agente, objetivosGlobales)
  }
  if (objetivosGlobales) {
    equilibrarObjetivosGlobales(plan, agentes, objetivosGlobales)
  }
  return plan
}

export function cicloRotacion(agente: FichaPolicia): TurnoAnual[] {
  if (agente.limitaciones.soloManana) return ['M', 'V']
  if (agente.limitaciones.soloMananaNoche) return ['M', 'N', 'V']
  if (agente.limitaciones.exentoNoches) return ['M', 'T', 'V']
  return ['M', 'T', 'N', 'V']
}

export function siguienteTurno(agente: FichaPolicia, actual: TurnoAnual) {
  const ciclo = cicloRotacion(agente)
  const indice = ciclo.indexOf(actual)
  if (indice < 0) return ciclo[0]
  return ciclo[(indice + 1) % ciclo.length]
}

export function vacacionesObjetivo(agente: FichaPolicia) {
  const { objetivoM, objetivoT, objetivoN } = agente.preferenciaAnual
  return 12 - objetivoM - objetivoT - objetivoN
}
