import type { FichaPolicia, RolPolicia } from '@/types'
import { turnosLaboralesPermitidos } from '@/lib/limitaciones'
import { mesesVacacionesEnPlan } from '@/lib/vacaciones'

export type TurnoAnual = 'M' | 'T' | 'N' | 'V'
export type CeldaPlanAnual = TurnoAnual | null
export type FilaPlanAnual = CeldaPlanAnual[]
export type ObjetivosGlobales = { M: number; T: number; N: number }
export type PlanAnual = Record<string, FilaPlanAnual>

/** Vista del plan anual: operativos o jefes de servicio. */
export type GrupoPlanAnual = 'OPERATIVO' | 'JEFE_SERVICIO'

export type OpcionesGeneracionPlanAnual = {
  /** Solo autogenera agentes de este grupo (los demás se conservan). */
  grupo?: GrupoPlanAnual
  /** Plan existente a fusionar (p. ej. al generar un grupo sin tocar el otro). */
  planBase?: PlanAnual
}

/** Meses (0-11) y agentes que no se han podido cuadrar tras autogenerar. */
export type MarcasPlanAnual = {
  /** % anual dentro de tolerancia respecto al selector. */
  anioCuadra: boolean
  /** Porcentajes reales del año (M/T/N sobre activos). */
  pctAnio: ObjetivosGlobales | null
  /** Meses cuyo % queda fuera de tolerancia. */
  mesesSinCuadrar: number[]
  /**
   * Agentes cuya fila no respeta su preferencia anual
   * (tras limitaciones / separación de noches).
   */
  agentesSinCuadrar: string[]
  /** El mix de preferencias de la plantilla no puede alcanzar el % del selector. */
  preferenciasIncompatibles: boolean
}

export type ResultadoGeneracionPlanAnual = {
  plan: PlanAnual
  marcas: MarcasPlanAnual
}

export const TOLERANCIA_PCT_PLAN = 2

const MESES = 12
const TURNOS_ACTIVOS = ['M', 'T', 'N'] as const
const MES_DICIEMBRE = 11
type TurnoActivo = (typeof TURNOS_ACTIVOS)[number]

export function filaVaciaPlanAnual(): FilaPlanAnual {
  return Array.from({ length: MESES }, () => null)
}

export function esPoliciaBolsa(rol: RolPolicia) {
  return rol === 'POLICIA_BOLSA'
}

export function grupoPlanAnual(rol: RolPolicia): GrupoPlanAnual | null {
  if (rol === 'JEFE_SERVICIO') return 'JEFE_SERVICIO'
  if (
    rol === 'POLICIA' ||
    rol === 'JEFE_EQUIPO' ||
    rol === 'POLICIA_BOLSA' ||
    rol === 'RESPONSABLE'
  ) {
    return 'OPERATIVO'
  }
  return null
}

export function agentePerteneceGrupo(
  agente: FichaPolicia,
  grupo: GrupoPlanAnual,
) {
  return grupoPlanAnual(agente.rolBase) === grupo
}

function clonarPlan(plan: PlanAnual): PlanAnual {
  const copia: PlanAnual = {}
  for (const [id, fila] of Object.entries(plan)) {
    copia[id] = [...fila]
  }
  return copia
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

function puedeColocarNoche(fila: FilaPlanAnual, mes: number, minDist: number) {
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

/** Cupos desde la preferencia de la ficha, aplicando limitaciones. */
function cuposLaborales(agente: FichaPolicia, libres: number): Cupos {
  const lim = agente.limitaciones
  let M = lim.M ? Math.max(0, agente.preferenciaAnual.objetivoM) : 0
  let T = lim.T ? Math.max(0, agente.preferenciaAnual.objetivoT) : 0
  let N = lim.N ? Math.max(0, agente.preferenciaAnual.objetivoN) : 0

  if (libres <= 0) return { M: 0, T: 0, N: 0 }

  const permitidos = turnosLaboralesPermitidos(lim)
  if (permitidos.length === 0) return { M: 0, T: 0, N: 0 }
  if (permitidos.length === 1) {
    const turno = permitidos[0]
    return { M: turno === 'M' ? libres : 0, T: turno === 'T' ? libres : 0, N: turno === 'N' ? libres : 0 }
  }

  if (lim.M && lim.N && !lim.T) {
    N = Math.min(Math.max(0, N), libres)
    return { M: libres - N, T: 0, N }
  }

  if (lim.M && lim.T && !lim.N) {
    T = Math.min(Math.max(0, T), libres)
    return { M: libres - T, T, N: 0 }
  }

  if (lim.T && lim.N && !lim.M) {
    N = Math.min(Math.max(0, N), libres)
    return { M: 0, T: libres - N, N }
  }

  const suma = M + T + N
  if (suma === 0) {
    const reparto = cuposDesdePorcentajes(libres, { M: 34, T: 33, N: 33 })
    return {
      M: lim.M ? reparto.M : 0,
      T: lim.T ? reparto.T : 0,
      N: lim.N ? reparto.N : 0,
    }
  }
  if (suma > libres) {
    N = lim.N ? Math.min(N, libres) : 0
    T = lim.T ? Math.min(T, libres - N) : 0
    M = lim.M ? libres - N - T : 0
  } else if (suma < libres) {
    if (lim.M) M += libres - suma
    else if (lim.T) T += libres - suma
    else if (lim.N) N += libres - suma
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

function asignarFila(agente: FichaPolicia, anio: number): TurnoAnual[] {
  const fila: Fila = Array.from({ length: MESES }, () => null)
  for (const mes of mesesVacacionesEnPlan(
    agente,
    anio,
    vacacionesObjetivo(agente),
  )) {
    fila[mes] = 'V'
  }

  const cupos = cuposLaborales(agente, huecos(fila).length)
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

  // N no colocables por separación → pasan a T (se marcará la ficha).
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
  return agente.limitaciones[turno]
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

function contarFila(fila: FilaPlanAnual): Cupos & { V: number } {
  const t = { M: 0, T: 0, N: 0, V: 0 }
  for (const turno of fila) {
    if (turno) t[turno] += 1
  }
  return t
}

function pctDesdeCupos(cupos: Cupos): ObjetivosGlobales | null {
  const activos = cupos.M + cupos.T + cupos.N
  if (activos <= 0) return null
  return {
    M: (cupos.M / activos) * 100,
    T: (cupos.T / activos) * 100,
    N: (cupos.N / activos) * 100,
  }
}

function dentroTolerancia(real: number, objetivo: number) {
  return Math.abs(real - objetivo) <= TOLERANCIA_PCT_PLAN
}

function cuadraPorcentajes(
  real: ObjetivosGlobales | null,
  objetivo: ObjetivosGlobales,
) {
  if (!real) return false
  return (
    dentroTolerancia(real.M, objetivo.M) &&
    dentroTolerancia(real.T, objetivo.T) &&
    dentroTolerancia(real.N, objetivo.N)
  )
}

function desviacionObjetivo(real: Cupos, objetivo: Cupos) {
  return (
    Math.abs(real.M - objetivo.M) +
    Math.abs(real.T - objetivo.T) +
    Math.abs(real.N - objetivo.N)
  )
}

function conteoMes(plan: PlanAnual, ids: string[], mes: number): Cupos {
  const conteo: Cupos = { M: 0, T: 0, N: 0 }
  for (const id of ids) {
    const turno = plan[id]?.[mes]
    if (turno === 'M' || turno === 'T' || turno === 'N') conteo[turno] += 1
  }
  return conteo
}

function desviacionMeses(
  plan: PlanAnual,
  ids: string[],
  objetivos: ObjetivosGlobales,
) {
  let total = 0
  for (let mes = 0; mes < MESES; mes++) {
    const conteo = conteoMes(plan, ids, mes)
    const activos = conteo.M + conteo.T + conteo.N
    if (activos <= 0) continue
    total += desviacionObjetivo(
      conteo,
      cuposDesdePorcentajes(activos, objetivos),
    )
  }
  return total
}

/**
 * Intercambia dos meses del mismo agente (preserva sus cupos M/T/N).
 */
function intentarSwapMismaFila(
  plan: PlanAnual,
  agentesById: Map<string, FichaPolicia>,
  id: string,
  mesA: number,
  mesB: number,
) {
  if (mesA === mesB) return false
  const fila = plan[id]
  const agente = agentesById.get(id)
  if (!fila || !agente) return false
  const turnoA = fila[mesA]
  const turnoB = fila[mesB]
  if (turnoA === 'V' || turnoB === 'V' || turnoA === turnoB) return false
  if (turnoA !== 'M' && turnoA !== 'T' && turnoA !== 'N') return false
  if (turnoB !== 'M' && turnoB !== 'T' && turnoB !== 'N') return false
  if (!permiteTurno(agente, turnoB) || !permiteTurno(agente, turnoA)) {
    return false
  }

  const copia = [...fila]
  copia[mesA] = turnoB
  copia[mesB] = turnoA
  if (turnoB === 'N' && !puedeColocarNoche(copia, mesA, 2)) return false
  if (turnoA === 'N' && !puedeColocarNoche(copia, mesB, 2)) return false

  plan[id] = copia
  return true
}

/**
 * Ciclo de 2×2 entre dos agentes: A(m1)=X, A(m2)=Y y B(m1)=Y, B(m2)=X.
 * Tras el doble swap ambos conservan sus cupos.
 */
function intentarDobleSwapPreservandoCupos(
  plan: PlanAnual,
  agentesById: Map<string, FichaPolicia>,
  idA: string,
  idB: string,
  mes1: number,
  mes2: number,
) {
  if (idA === idB || mes1 === mes2) return false
  const filaA = plan[idA]
  const filaB = plan[idB]
  const agenteA = agentesById.get(idA)
  const agenteB = agentesById.get(idB)
  if (!filaA || !filaB || !agenteA || !agenteB) return false

  const a1 = filaA[mes1]
  const a2 = filaA[mes2]
  const b1 = filaB[mes1]
  const b2 = filaB[mes2]
  if (a1 === 'V' || a2 === 'V' || b1 === 'V' || b2 === 'V') return false
  if (a1 !== b2 || a2 !== b1) return false
  if (a1 === a2) return false
  if (a1 !== 'M' && a1 !== 'T' && a1 !== 'N') return false
  if (a2 !== 'M' && a2 !== 'T' && a2 !== 'N') return false

  const copiaA = [...filaA]
  const copiaB = [...filaB]
  copiaA[mes1] = a2
  copiaA[mes2] = a1
  copiaB[mes1] = b2
  copiaB[mes2] = b1

  for (const [agente, copia, mes, turno] of [
    [agenteA, copiaA, mes1, a2],
    [agenteA, copiaA, mes2, a1],
    [agenteB, copiaB, mes1, b2],
    [agenteB, copiaB, mes2, b1],
  ] as const) {
    if (!permiteTurno(agente, turno as TurnoActivo)) return false
    if (
      turno === 'N' &&
      !puedeColocarNoche(copia, mes as number, 2)
    ) {
      return false
    }
  }

  plan[idA] = copiaA
  plan[idB] = copiaB
  return true
}

/**
 * Reordena meses sin cambiar los cupos de cada ficha, para acercar el % mensual
 * al selector. El % anual queda fijado por la suma de preferencias.
 */
function equilibrarMesesPreservandoPreferencias(
  plan: PlanAnual,
  agentes: FichaPolicia[],
  objetivos: ObjetivosGlobales,
) {
  if (agentes.length === 0) return

  const agentesById = new Map(agentes.map((agente) => [agente.id, agente]))
  const ids = agentes.map((agente) => agente.id)

  for (let pase = 0; pase < 20; pase++) {
    let mejorado = false
    const devAntes = desviacionMeses(plan, ids, objetivos)

    for (let mes = 0; mes < MESES; mes++) {
      const conteo = conteoMes(plan, ids, mes)
      const activos = conteo.M + conteo.T + conteo.N
      if (activos <= 0) continue
      const objetivoMes = cuposDesdePorcentajes(activos, objetivos)
      if (desviacionObjetivo(conteo, objetivoMes) === 0) continue

      for (const surplus of TURNOS_ACTIVOS) {
        for (const deficit of TURNOS_ACTIVOS) {
          if (surplus === deficit) continue
          if (conteo[surplus] <= objetivoMes[surplus]) continue
          if (conteo[deficit] >= objetivoMes[deficit]) continue

          // 1) Mismo agente: intercambiar surplus@mes con deficit@otroMes
          for (const id of ids) {
            if (plan[id]?.[mes] !== surplus) continue
            for (let mesB = 0; mesB < MESES; mesB++) {
              if (mesB === mes) continue
              if (plan[id]?.[mesB] !== deficit) continue
              if (!intentarSwapMismaFila(plan, agentesById, id, mes, mesB)) {
                continue
              }
              const devDesp = desviacionMeses(plan, ids, objetivos)
              if (devDesp >= devAntes) {
                intentarSwapMismaFila(plan, agentesById, id, mes, mesB)
                continue
              }
              conteo[surplus] -= 1
              conteo[deficit] += 1
              mejorado = true
              break
            }
            if (conteo[surplus] <= objetivoMes[surplus]) break
          }

          // 2) Doble swap entre dos agentes (preserva cupos de ambos)
          if (conteo[surplus] > objetivoMes[surplus]) {
            for (const idA of ids) {
              if (plan[idA]?.[mes] !== surplus) continue
              for (let mesB = 0; mesB < MESES; mesB++) {
                if (mesB === mes) continue
                if (plan[idA]?.[mesB] !== deficit) continue
                for (const idB of ids) {
                  if (idB === idA) continue
                  if (plan[idB]?.[mes] !== deficit) continue
                  if (plan[idB]?.[mesB] !== surplus) continue
                  if (
                    !intentarDobleSwapPreservandoCupos(
                      plan,
                      agentesById,
                      idA,
                      idB,
                      mes,
                      mesB,
                    )
                  ) {
                    continue
                  }
                  const devDesp = desviacionMeses(plan, ids, objetivos)
                  if (devDesp >= devAntes) {
                    intentarDobleSwapPreservandoCupos(
                      plan,
                      agentesById,
                      idA,
                      idB,
                      mes,
                      mesB,
                    )
                    continue
                  }
                  conteo[surplus] -= 1
                  conteo[deficit] += 1
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
    }

    if (!mejorado) break
  }
}

function cuposEsperadosTrasLimitaciones(agente: FichaPolicia): Cupos {
  return cuposLaborales(agente, MESES - 1)
}

function filaRespetaPreferencia(agente: FichaPolicia, fila: FilaPlanAnual) {
  const real = contarFila(fila)
  const esperado = cuposEsperadosTrasLimitaciones(agente)
  // Tras limitaciones el objetivo de V puede ser 1 fijo en generación.
  return (
    real.M === esperado.M && real.T === esperado.T && real.N === esperado.N
  )
}

function preferenciasAlcanzanObjetivo(
  agentes: FichaPolicia[],
  objetivos: ObjetivosGlobales,
) {
  const suma: Cupos = { M: 0, T: 0, N: 0 }
  for (const agente of agentes) {
    const cupos = cuposEsperadosTrasLimitaciones(agente)
    suma.M += cupos.M
    suma.T += cupos.T
    suma.N += cupos.N
  }
  const pct = pctDesdeCupos(suma)
  return {
    pct,
    cuadra: cuadraPorcentajes(pct, objetivos),
  }
}

export function calcularMarcas(
  plan: PlanAnual,
  agentes: FichaPolicia[],
  objetivos: ObjetivosGlobales,
): MarcasPlanAnual {
  const flota = contarFlota(plan, agentes)
  const pctAnio = pctDesdeCupos(flota)
  const anioCuadra = cuadraPorcentajes(pctAnio, objetivos)

  const mesesSinCuadrar: number[] = []
  for (let mes = 0; mes < MESES; mes++) {
    const conteo = conteoMes(
      plan,
      agentes.map((a) => a.id),
      mes,
    )
    const activos = conteo.M + conteo.T + conteo.N
    if (activos <= 0) {
      mesesSinCuadrar.push(mes)
      continue
    }
    const pctMes = pctDesdeCupos(conteo)
    if (!cuadraPorcentajes(pctMes, objetivos)) mesesSinCuadrar.push(mes)
  }

  const agentesSinCuadrar = agentes
    .filter((agente) => {
      const fila = plan[agente.id]
      if (!fila) return true
      return !filaRespetaPreferencia(agente, fila)
    })
    .map((agente) => agente.id)

  const compat = preferenciasAlcanzanObjetivo(agentes, objetivos)

  return {
    anioCuadra,
    pctAnio,
    mesesSinCuadrar,
    agentesSinCuadrar,
    preferenciasIncompatibles: !compat.cuadra,
  }
}

export function diciembreNProhibido(
  agenteId: string,
  planAnioAnterior?: PlanAnual,
) {
  return planAnioAnterior?.[agenteId]?.[MES_DICIEMBRE] === 'N'
}

function evitarDiciembreNRepetido(
  agente: FichaPolicia,
  fila: FilaPlanAnual,
  planAnioAnterior?: PlanAnual,
) {
  if (fila[MES_DICIEMBRE] !== 'N') return
  if (!diciembreNProhibido(agente.id, planAnioAnterior)) return

  const alternativas: TurnoAnual[] = []
  if (agente.limitaciones.M) alternativas.push('M')
  if (agente.limitaciones.T) alternativas.push('T')
  fila[MES_DICIEMBRE] = alternativas[0] ?? 'M'
}

export function validarTurnoEnPlan(
  agente: FichaPolicia,
  fila: FilaPlanAnual,
  mes: number,
  turno: TurnoAnual,
  planAnioAnterior?: PlanAnual,
): string | null {
  if (turno === 'V') return null
  if (turno === 'M' || turno === 'T' || turno === 'N') {
    if (!permiteTurno(agente, turno)) {
      return `El agente no puede hacer turno ${turno}`
    }
    if (turno === 'N' && !puedeColocarNoche(fila, mes, 2)) {
      return 'Separación insuficiente entre noches en el plan anual'
    }
    if (
      mes === MES_DICIEMBRE &&
      turno === 'N' &&
      diciembreNProhibido(agente.id, planAnioAnterior)
    ) {
      return 'No puede repetir noche en diciembre respecto al año anterior'
    }
  }
  return null
}

function agentesAutogenerables(
  agentes: FichaPolicia[],
  grupo?: GrupoPlanAnual,
) {
  return agentes.filter((agente) => {
    if (esPoliciaBolsa(agente.rolBase)) return false
    if (!grupo) return true
    return agentePerteneceGrupo(agente, grupo)
  })
}

export function generarPlanAnual(
  agentes: FichaPolicia[],
  objetivosGlobales?: ObjetivosGlobales,
  anio = new Date().getFullYear(),
  planAnioAnterior?: PlanAnual,
  opciones?: OpcionesGeneracionPlanAnual,
): ResultadoGeneracionPlanAnual {
  if (!opciones?.grupo) {
    const operativo = generarPlanAnual(
      agentes,
      objetivosGlobales,
      anio,
      planAnioAnterior,
      { ...opciones, grupo: 'OPERATIVO' },
    )
    return generarPlanAnual(
      agentes,
      objetivosGlobales,
      anio,
      planAnioAnterior,
      { ...opciones, grupo: 'JEFE_SERVICIO', planBase: operativo.plan },
    )
  }

  const plan: PlanAnual = opciones.planBase
    ? clonarPlan(opciones.planBase)
    : {}
  const objetivos = objetivosGlobales ?? { M: 34, T: 33, N: 33 }
  const agentesGenerar = agentesAutogenerables(agentes, opciones.grupo)

  for (const agente of agentesGenerar) {
    const fila = asignarFila(agente, anio)
    evitarDiciembreNRepetido(agente, fila, planAnioAnterior)
    plan[agente.id] = fila
  }

  for (const agente of agentes) {
    if (!esPoliciaBolsa(agente.rolBase)) continue
    if (!plan[agente.id]) {
      plan[agente.id] = filaVaciaPlanAnual()
    }
  }

  equilibrarMesesPreservandoPreferencias(plan, agentesGenerar, objetivos)
  for (const agente of agentesGenerar) {
    const fila = plan[agente.id]
    if (fila) evitarDiciembreNRepetido(agente, fila, planAnioAnterior)
  }

  return {
    plan,
    marcas: calcularMarcas(plan, agentesGenerar, objetivos),
  }
}

export function cicloRotacion(agente: FichaPolicia): TurnoAnual[] {
  const ciclo: TurnoAnual[] = []
  if (agente.limitaciones.M) ciclo.push('M')
  if (agente.limitaciones.T) ciclo.push('T')
  if (agente.limitaciones.N) ciclo.push('N')
  ciclo.push('V')
  return ciclo.length > 1 ? ciclo : ['M', 'T', 'N', 'V']
}

export function siguienteTurno(
  agente: FichaPolicia,
  actual: TurnoAnual | null,
): TurnoAnual {
  const ciclo = cicloRotacion(agente)
  if (!actual) return ciclo[0]
  const indice = ciclo.indexOf(actual)
  if (indice < 0) return ciclo[0]
  return ciclo[(indice + 1) % ciclo.length]
}

export function vacacionesObjetivo(agente: FichaPolicia) {
  const { objetivoM, objetivoT, objetivoN } = agente.preferenciaAnual
  return 12 - objetivoM - objetivoT - objetivoN
}
