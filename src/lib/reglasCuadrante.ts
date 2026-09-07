import type { Turno } from '@/types'
import {
  MAX_DIAS_CONTINUOS,
  MIN_DESCANSO_TRAS_NOCHE,
  esDiaTrabajado,
  esDescanso,
} from '@/lib/convenio'
import {
  MAX_FINDES_CONSECUTIVOS,
  MAX_FINDES_MES,
  esFindePartidoEnDia,
  finDeSemanaLaboradoEnDia,
  findesLaboradosEnMes,
  maxFindesConsecutivosLaborados,
} from '@/lib/finesSemana'

export type CodigoRegla =
  | 'FATIGA'
  | 'DESCANSO_SUELTO'
  | 'TRABAJO_SUELTO'
  | 'T_M'
  | 'N_T'
  | 'SALIDA_NOCHE'
  | 'FINDES_CONSECUTIVOS'
  | 'FINDES_MES_EXCESO'
  | 'FINDE_PARTIDO'

export const MENSAJE_REGLA: Record<CodigoRegla, string> = {
  FATIGA: 'Más de 5 días seguidos de trabajo',
  DESCANSO_SUELTO: 'Descanso suelto (mínimo 2 D contiguos)',
  TRABAJO_SUELTO: 'Jornada suelta (mínimo 2 días de trabajo seguidos)',
  T_M: 'T→M prohibido (menos de 12 h)',
  N_T: 'N→T prohibido (menos de 12 h)',
  SALIDA_NOCHE: 'Saliente de noche insuficiente (N + 3 D antes de M)',
  FINDES_CONSECUTIVOS: 'Más de 2 fines de semana seguidos trabajados',
  FINDES_MES_EXCESO: 'Más de 3 fines de semana trabajados en el mes',
  FINDE_PARTIDO: 'Finde partido (sábado y domingo deben ir juntos)',
}

export type ContextoReglasCuadrante = {
  anio: number
  mes: number
  /** Últimos días del mes anterior (orden cronológico) para este agente. */
  colaMesAnterior?: Turno[]
}

function diaAnteriorEsTrabajo(
  fila: Turno[],
  dia: number,
  colaMesAnterior?: Turno[],
) {
  if (dia > 0) return esDiaTrabajado(fila[dia - 1])
  if (!colaMesAnterior?.length) return false
  return esDiaTrabajado(colaMesAnterior[colaMesAnterior.length - 1])
}

function diaSiguienteEsTrabajo(fila: Turno[], dia: number) {
  if (dia < fila.length - 1) return esDiaTrabajado(fila[dia + 1])
  return false
}

function diaAnteriorEsDescanso(
  fila: Turno[],
  dia: number,
  colaMesAnterior?: Turno[],
) {
  if (dia > 0) return esDescanso(fila[dia - 1])
  if (!colaMesAnterior?.length) return false
  return esDescanso(colaMesAnterior[colaMesAnterior.length - 1])
}

function diaSiguienteEsDescanso(fila: Turno[], dia: number) {
  if (dia < fila.length - 1) return esDescanso(fila[dia + 1])
  return false
}

function descansoTrasUltimaNoche(
  fila: Turno[],
  diaM: number,
  colaMesAnterior?: Turno[],
) {
  let descanso = 0
  for (let i = diaM - 1; i >= 0; i--) {
    const turno = fila[i]
    if (turno === 'D' || turno === 'V') {
      descanso += 1
      continue
    }
    if (turno === 'N') return descanso
    return null
  }
  if (colaMesAnterior) {
    for (let i = colaMesAnterior.length - 1; i >= 0; i--) {
      const turno = colaMesAnterior[i]
      if (turno === 'D' || turno === 'V') {
        descanso += 1
        continue
      }
      if (turno === 'N') return descanso
      return null
    }
  }
  return null
}

/**
 * Racha de jornadas M/T/N hacia atrás. Solo enlaza con el mes anterior si la
 * racha llega al día 1 del mes (sin descanso intermedio en el borde).
 */
function rachaTrabajoHaciaAtras(
  fila: Turno[],
  dia: number,
  colaMesAnterior?: Turno[],
) {
  let racha = 0
  for (let i = dia; i >= 0 && esDiaTrabajado(fila[i]); i--) racha += 1
  if (colaMesAnterior?.length && racha === dia + 1) {
    for (
      let i = colaMesAnterior.length - 1;
      i >= 0 && esDiaTrabajado(colaMesAnterior[i]);
      i--
    ) {
      racha += 1
    }
  }
  return racha
}

function turnoPrevioDia(
  fila: Turno[],
  dia: number,
  colaMesAnterior?: Turno[],
): Turno | undefined {
  if (dia > 0) return fila[dia - 1]
  if (!colaMesAnterior?.length) return undefined
  return colaMesAnterior[colaMesAnterior.length - 1]
}

export function infraccionesCelda(
  fila: Turno[],
  dia: number,
  contexto?: ContextoReglasCuadrante,
) {
  const infracciones: CodigoRegla[] = []
  const turno = fila[dia]
  if (!turno) return infracciones

  const cola = contexto?.colaMesAnterior

  if (esDiaTrabajado(turno)) {
    const racha = rachaTrabajoHaciaAtras(fila, dia, cola)
    if (racha > MAX_DIAS_CONTINUOS) infracciones.push('FATIGA')
    const previoTrabajo = diaAnteriorEsTrabajo(fila, dia, cola)
    const siguienteTrabajo = diaSiguienteEsTrabajo(fila, dia)
    if (!previoTrabajo && !siguienteTrabajo) {
      infracciones.push('TRABAJO_SUELTO')
    }
  }

  if (turno === 'D') {
    const previoD = diaAnteriorEsDescanso(fila, dia, cola)
    const siguienteD = diaSiguienteEsDescanso(fila, dia)
    if (!previoD && !siguienteD) infracciones.push('DESCANSO_SUELTO')
  }

  const previo = turnoPrevioDia(fila, dia, cola)
  if (previo === 'T' && turno === 'M') infracciones.push('T_M')
  if (previo === 'N' && turno === 'T') infracciones.push('N_T')

  if (turno === 'M') {
    const descanso = descansoTrasUltimaNoche(fila, dia, cola)
    if (descanso != null && descanso < MIN_DESCANSO_TRAS_NOCHE) {
      infracciones.push('SALIDA_NOCHE')
    }
  }

  if (
    contexto &&
    esFindePartidoEnDia(fila, contexto.anio, contexto.mes, dia + 1)
  ) {
    infracciones.push('FINDE_PARTIDO')
  }

  if (
    contexto &&
    finDeSemanaLaboradoEnDia(fila, contexto.anio, contexto.mes, dia + 1)
  ) {
    if (
      findesLaboradosEnMes(fila, contexto.anio, contexto.mes) > MAX_FINDES_MES
    ) {
      infracciones.push('FINDES_MES_EXCESO')
    }
    if (
      maxFindesConsecutivosLaborados(fila, contexto.anio, contexto.mes) >
      MAX_FINDES_CONSECUTIVOS
    ) {
      infracciones.push('FINDES_CONSECUTIVOS')
    }
  }

  return infracciones
}

export function mensajesInfraccion(
  fila: Turno[],
  dia: number,
  contexto?: ContextoReglasCuadrante,
) {
  return infraccionesCelda(fila, dia, contexto).map(
    (codigo) => MENSAJE_REGLA[codigo],
  )
}

export function filaTieneInfracciones(
  fila: Turno[],
  contexto?: ContextoReglasCuadrante,
) {
  return fila.some(
    (_, dia) => infraccionesCelda(fila, dia, contexto).length > 0,
  )
}
