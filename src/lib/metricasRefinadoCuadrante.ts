import type { Turno, EventoOperativo } from '@/types'
import type { PlanAnual } from '@/lib/generarPlanAnual'
import type { MinimosSemana, PuestoConfig } from '@/lib/calendarioPuestos'
import {
  minimosParaFecha,
  totalMinimosTurno,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import { diasDelMes } from '@/lib/convenio'
import {
  countFindesPartidos,
  findesLaboradosEnMes,
  findesMesCuadra,
  MAX_FINDES_CONSECUTIVOS,
  MAX_FINDES_MES,
  OBJETIVO_FINDES_MES,
  maxFindesConsecutivosLaborados,
} from '@/lib/finesSemana'
import {
  contarVariablesCobroAgente,
  puntajeEquilibrioVariablesMensual,
  sumatorioFMensual,
} from '@/lib/variablesCobro'

export const PESO_DEFICIT_MINIMO = 50_000
export const PESO_FINDES_NF = 3_000
export const PESO_FINDES_CONSEC = 1_000
export const PESO_FINDE_PARTIDO = 500
export const PESO_VARIABLES = 1

type CuadranteMensual = Record<string, Turno[]>

function isoFechaCuadrante(anio: number, mes: number, dia: number) {
  return `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`
}

type TurnoOperativoMes = 'M' | 'T' | 'N'

function turnoOperativoMes(
  turno: string | null | undefined,
): TurnoOperativoMes | null {
  if (turno === 'M' || turno === 'T' || turno === 'N') return turno
  return null
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

/** Suma de huecos por debajo del mínimo operativo M/T/N del mes. */
export function contarDeficitsMinimosCuadrante(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  minimosSemana: MinimosSemana,
  puestos: PuestoConfig[],
  eventos: EventoOperativo[],
) {
  const nDias = diasDelMes(anio, mes)
  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)
  let total = 0
  for (const turno of ['M', 'T', 'N'] as TurnoOperativo[]) {
    const ids = grupos.get(turno) ?? []
    for (let dia = 0; dia < nDias; dia++) {
      const minimos = minimosParaFecha(
        isoFechaCuadrante(anio, mes, dia + 1),
        eventos,
        minimosSemana,
        puestos,
      )
      const minimo = totalMinimosTurno(minimos, turno, puestos)
      const deficit = minimo - conteoTurnoDia(cuadrante, ids, dia, turno)
      if (deficit > 0) total += deficit
    }
  }
  return total
}

/** Penalización por nf, rachas y findes partidos en una fila. */
export function penalizacionFindesFila(
  fila: Turno[],
  anio: number,
  mes: number,
) {
  let penalizacion = 0
  const nf = findesLaboradosEnMes(fila, anio, mes)
  if (!findesMesCuadra(nf)) {
    if (nf < OBJETIVO_FINDES_MES) {
      penalizacion += PESO_FINDES_NF * (OBJETIVO_FINDES_MES - nf)
    } else if (nf > MAX_FINDES_MES) {
      penalizacion += PESO_FINDES_NF * (nf - MAX_FINDES_MES)
    }
  } else if (nf > OBJETIVO_FINDES_MES) {
    penalizacion += 150
  }
  if (
    maxFindesConsecutivosLaborados(fila, anio, mes) > MAX_FINDES_CONSECUTIVOS
  ) {
    penalizacion += PESO_FINDES_CONSEC
  }
  penalizacion += countFindesPartidos(fila, anio, mes) * PESO_FINDE_PARTIDO
  return penalizacion
}

export type ContextoMetricasCuadrante = {
  minimosSemana?: MinimosSemana
  puestos?: PuestoConfig[]
}

/**
 * Puntuación global del cuadrante (menor = mejor).
 * Prioriza: mínimos operativos → findes (nf) → equilibrio NF (festivos + conciliaciones).
 */
export function puntuacionGlobalCuadrante(
  cuadrante: CuadranteMensual,
  agenteIds: string[],
  planAnual: PlanAnual,
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  contexto?: ContextoMetricasCuadrante,
) {
  const nDias = diasDelMes(anio, mes)
  let total = 0

  if (contexto?.minimosSemana && contexto.puestos?.length) {
    total +=
      contarDeficitsMinimosCuadrante(
        cuadrante,
        agenteIds,
        planAnual,
        anio,
        mes,
        contexto.minimosSemana,
        contexto.puestos,
        eventos,
      ) * PESO_DEFICIT_MINIMO
  }

  const grupos = agentesPorTurnoMes(cuadrante, agenteIds, planAnual, mes, nDias)
  for (const ids of grupos.values()) {
    for (const id of ids) {
      const fila = cuadrante[id]
      if (!fila) continue
      total += penalizacionFindesFila(fila, anio, mes)
    }
    const conteos = ids.map((id) =>
      contarVariablesCobroAgente(cuadrante[id] ?? [], anio, mes, eventos),
    )
    const sumatoriosF = ids.map((id) =>
      sumatorioFMensual(cuadrante[id] ?? [], anio, mes, eventos),
    )
    total +=
      puntajeEquilibrioVariablesMensual(conteos, sumatoriosF) * PESO_VARIABLES
  }

  return total
}
