import type { DragEvent } from 'react'
import {
  ABREV_PUESTO,
  PUESTOS_BASE,
  puestoExcluidoParaAgente,
  type AsignacionesDiarias,
  type PuestoBase,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import type { FichaPolicia } from '@/types'

export const MIME_PUESTO = 'application/x-cuadrapp-puesto'

export function esTurnoOperativo(
  turno: string | undefined,
): turno is TurnoOperativo {
  return turno === 'M' || turno === 'T' || turno === 'N'
}

export function abreviaturaPuesto(
  asignaciones: AsignacionesDiarias,
  fecha: string,
  agenteId: string,
  turno: TurnoOperativo,
) {
  const puesto = asignaciones[fecha]?.[turno]?.[agenteId]
  if (!puesto) return null
  return ABREV_PUESTO[puesto]
}

export function puestosPermitidosParaAgente(agente: FichaPolicia) {
  return PUESTOS_BASE.filter(
    (puesto) => !puestoExcluidoParaAgente(agente.puestosExcluidos, puesto),
  )
}

export function leerPuestoArrastrado(dataTransfer: DataTransfer): PuestoBase | null {
  const raw = dataTransfer.getData(MIME_PUESTO)
  if (PUESTOS_BASE.includes(raw as PuestoBase)) return raw as PuestoBase
  return null
}

export function iniciarArrastrePuesto(
  event: DragEvent,
  puesto: PuestoBase,
) {
  event.dataTransfer.setData(MIME_PUESTO, puesto)
  event.dataTransfer.effectAllowed = 'copy'
}

export function permitirSoltarPuesto(event: DragEvent) {
  event.preventDefault()
  event.dataTransfer.dropEffect = 'copy'
}

function clonarAsignaciones(actual: AsignacionesDiarias): AsignacionesDiarias {
  const copia: AsignacionesDiarias = {}
  for (const [fecha, porTurno] of Object.entries(actual)) {
    copia[fecha] = {}
    for (const [turno, porAgente] of Object.entries(porTurno)) {
      copia[fecha][turno as TurnoOperativo] = { ...porAgente }
    }
  }
  return copia
}

export function asignarPuestoEnCelda(
  asignaciones: AsignacionesDiarias,
  agente: FichaPolicia,
  fecha: string,
  turno: TurnoOperativo,
  puesto: PuestoBase,
): { ok: true; asignaciones: AsignacionesDiarias } | { ok: false; error: string } {
  if (puestoExcluidoParaAgente(agente.puestosExcluidos, puesto)) {
    return { ok: false, error: 'Puesto excluido para este agente' }
  }

  const copia = clonarAsignaciones(asignaciones)
  if (!copia[fecha]) copia[fecha] = {}
  if (!copia[fecha][turno]) copia[fecha][turno] = {}
  copia[fecha][turno] = {
    ...copia[fecha][turno],
    [agente.id]: puesto,
  }
  return { ok: true, asignaciones: copia }
}

export function asignarPuestoMesAgente(
  asignaciones: AsignacionesDiarias,
  agente: FichaPolicia,
  puesto: PuestoBase,
  fechasTurno: Array<{ fecha: string; turno: TurnoOperativo }>,
): { ok: true; asignaciones: AsignacionesDiarias } | { ok: false; error: string } {
  if (puestoExcluidoParaAgente(agente.puestosExcluidos, puesto)) {
    return { ok: false, error: 'Puesto excluido para este agente' }
  }

  const copia = clonarAsignaciones(asignaciones)
  for (const { fecha, turno } of fechasTurno) {
    const yaAsignado = copia[fecha]?.[turno]?.[agente.id]
    if (yaAsignado) continue

    if (!copia[fecha]) copia[fecha] = {}
    if (!copia[fecha][turno]) copia[fecha][turno] = {}
    copia[fecha][turno] = {
      ...copia[fecha][turno],
      [agente.id]: puesto,
    }
  }
  return { ok: true, asignaciones: copia }
}

export function fechasOperativasAgenteMes(
  cuadrante: CuadranteMensual,
  agenteId: string,
  anio: number,
  mes: number,
  nDias: number,
  isoFecha: (anio: number, mes: number, dia: number) => string,
) {
  const fechas: Array<{ fecha: string; turno: TurnoOperativo; dia: number }> =
    []
  const fila = cuadrante[agenteId] ?? []
  for (let dia = 1; dia <= nDias; dia++) {
    const turno = fila[dia - 1]
    if (!esTurnoOperativo(turno)) continue
    fechas.push({ fecha: isoFecha(anio, mes, dia), turno, dia })
  }
  return fechas
}
