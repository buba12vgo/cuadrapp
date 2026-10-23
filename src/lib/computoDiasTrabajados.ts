import type { Turno } from '@/types'

/** Jornadas anuales de referencia por trabajador. */
export const JORNADAS_ANUALES_REFERENCIA = 186

export type ComputoDiasTrabajados = {
  trabajados: number
  permisos: number
  total: number
  referencia: number
  diferencia: number
}

export function computoDiasTrabajadosVacio(): ComputoDiasTrabajados {
  return cerrarComputoDias({ trabajados: 0, permisos: 0 })
}

/**
 * M, T y N son una jornada. M-T (jefes) son dos.
 * Descanso, vacaciones y permisos no suman aquí.
 */
export function jornadasDeTurno(turno: Turno | undefined) {
  if (turno === 'MT') return 2
  if (turno === 'M' || turno === 'T' || turno === 'N') return 1
  return 0
}

/** Cualquier permiso del cuadrante, incluido el libre por disponibilidad. */
export function esPermisoComputable(turno: Turno | undefined) {
  return turno === 'P' || turno === 'L'
}

export function acumularComputoTurno(
  parcial: { trabajados: number; permisos: number },
  turno: Turno | undefined,
  sumaPermiso = true,
) {
  if (esPermisoComputable(turno)) {
    if (sumaPermiso) parcial.permisos += 1
  } else parcial.trabajados += jornadasDeTurno(turno)
}

export function cerrarComputoDias(parcial: {
  trabajados: number
  permisos: number
}): ComputoDiasTrabajados {
  const total = parcial.trabajados + parcial.permisos
  return {
    trabajados: parcial.trabajados,
    permisos: parcial.permisos,
    total,
    referencia: JORNADAS_ANUALES_REFERENCIA,
    diferencia: total - JORNADAS_ANUALES_REFERENCIA,
  }
}

export function computoDesdeFilas(filas: readonly (readonly Turno[])[]) {
  const parcial = { trabajados: 0, permisos: 0 }
  for (const fila of filas) {
    for (const turno of fila) acumularComputoTurno(parcial, turno)
  }
  return cerrarComputoDias(parcial)
}

export function computoDesdeContadores(trabajados: number, permisos: number) {
  return cerrarComputoDias({ trabajados, permisos })
}

/**
 * Cuadrante sintético de la vista previa (sin Firestore).
 * Ocho jornadas al mes, un permiso, un libre y una vacación que no cuenta.
 */
export function filasEjemploComputoAnual(
  jefe: boolean,
  extraPermisos: number,
): Turno[][] {
  const turnoTrabajo: Turno = jefe ? 'MT' : 'M'
  const extras = Math.max(0, extraPermisos)
  return Array.from({ length: 12 }, (_, mes) => {
    const nDias = mes === 1 ? 28 : 30
    const fila: Turno[] = Array.from({ length: nDias }, () => 'D')
    for (let i = 0; i < 8; i++) fila[i] = turnoTrabajo
    fila[8] = 'P'
    fila[9] = 'L'
    fila[10] = 'V'
    if (mes === 0) {
      for (let i = 0; i < extras && 11 + i < nDias; i++) fila[11 + i] = 'P'
    }
    return fila
  })
}
