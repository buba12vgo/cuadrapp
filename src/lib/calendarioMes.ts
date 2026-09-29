import {
  esTurnoAsignable,
  esTurnoPermiso,
  etiquetaTurno,
} from '@/lib/asignacionPuestos'
import type { AsignacionesDiarias, PuestoConfig } from '@/lib/calendarioPuestos'
import { diasDelMes } from '@/lib/convenio'
import type { PermisoConfig } from '@/lib/permisos'
import type { Turno } from '@/types'

/** Rejilla lunes-domingo del mes; `null` rellena los huecos. */
export function celdasMesCalendario(anio: number, mes: number) {
  const nDias = diasDelMes(anio, mes)
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7
  const celdas: (number | null)[] = Array.from({ length: offset }, () => null)
  for (let dia = 1; dia <= nDias; dia++) celdas.push(dia)
  while (celdas.length % 7 !== 0) celdas.push(null)
  return celdas
}

export function detalleDiaCalendarioJefe(
  turno: Turno,
  fecha: string,
  agenteId: string,
  asignaciones: AsignacionesDiarias,
  _puestos: PuestoConfig[],
  _permisos: PermisoConfig[],
) {
  if (!esTurnoAsignable(turno)) {
    return {
      etiqueta: etiquetaTurno(turno),
      detalle: null as string | null,
    }
  }
  const nombre = asignaciones[fecha]?.[turno]?.[agenteId] ?? null
  return {
    etiqueta: esTurnoPermiso(turno) ? 'P' : etiquetaTurno(turno),
    detalle: nombre,
  }
}
