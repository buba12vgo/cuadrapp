import type { Turno } from '@/types'
import {
  MAX_DIAS_CONTINUOS,
  MIN_DESCANSO_TRAS_NOCHE,
  esDiaTrabajado,
} from '@/lib/convenio'

export type CodigoRegla =
  | 'FATIGA'
  | 'DESCANSO_SUELTO'
  | 'T_M'
  | 'N_T'
  | 'SALIDA_NOCHE'

export const MENSAJE_REGLA: Record<CodigoRegla, string> = {
  FATIGA: 'Más de 5 días seguidos de trabajo',
  DESCANSO_SUELTO: 'Descanso suelto (mínimo 2 D contiguos)',
  T_M: 'T→M prohibido (menos de 12 h)',
  N_T: 'N→T prohibido (menos de 12 h)',
  SALIDA_NOCHE: 'Saliente de noche insuficiente (N + 3 D antes de M)',
}

function descansoTrasUltimaNoche(fila: Turno[], diaM: number) {
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
  return null
}

export function infraccionesCelda(fila: Turno[], dia: number): CodigoRegla[] {
  const infracciones: CodigoRegla[] = []
  const turno = fila[dia]
  if (!turno) return infracciones

  if (esDiaTrabajado(turno)) {
    let racha = 0
    for (let i = dia; i >= 0 && esDiaTrabajado(fila[i]); i--) racha += 1
    if (racha > MAX_DIAS_CONTINUOS) infracciones.push('FATIGA')
  }

  if (turno === 'D') {
    const previoD = dia > 0 && fila[dia - 1] === 'D'
    const siguienteD = dia < fila.length - 1 && fila[dia + 1] === 'D'
    if (!previoD && !siguienteD) infracciones.push('DESCANSO_SUELTO')
  }

  if (dia > 0) {
    const previo = fila[dia - 1]
    if (previo === 'T' && turno === 'M') infracciones.push('T_M')
    if (previo === 'N' && turno === 'T') infracciones.push('N_T')
  }

  if (turno === 'M') {
    const descanso = descansoTrasUltimaNoche(fila, dia)
    if (descanso != null && descanso < MIN_DESCANSO_TRAS_NOCHE) {
      infracciones.push('SALIDA_NOCHE')
    }
  }

  return infracciones
}

export function mensajesInfraccion(fila: Turno[], dia: number) {
  return infraccionesCelda(fila, dia).map((codigo) => MENSAJE_REGLA[codigo])
}

export function filaTieneInfracciones(fila: Turno[]) {
  return fila.some((_, dia) => infraccionesCelda(fila, dia).length > 0)
}
