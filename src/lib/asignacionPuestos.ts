import type { DragEvent } from 'react'
import {
  abreviaturaDesdePuestos,
  puestoExcluidoParaAgente,
  type AsignacionesDiarias,
  type PuestoBase,
  type PuestoConfig,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { getPuestos } from '@/lib/puestosStore'
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
  puestos: PuestoConfig[] = getPuestos(),
) {
  const puesto = asignaciones[fecha]?.[turno]?.[agenteId]
  if (!puesto) return null
  return abreviaturaDesdePuestos(puestos, puesto)
}

export function puestosPermitidosParaAgente(
  agente: FichaPolicia,
  puestos: PuestoConfig[] = getPuestos(),
) {
  return puestos
    .filter(
      (puesto) =>
        !puestoExcluidoParaAgente(
          agente.puestosExcluidos,
          puesto.nombre,
          puestos,
        ),
    )
    .map((puesto) => puesto.nombre)
}

export function leerPuestoArrastrado(
  dataTransfer: DataTransfer,
  puestos: PuestoConfig[] = getPuestos(),
): PuestoBase | null {
  const raw = dataTransfer.getData(MIME_PUESTO)
  if (puestos.some((puesto) => puesto.nombre === raw)) return raw
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
  puestos: PuestoConfig[] = getPuestos(),
): { ok: true; asignaciones: AsignacionesDiarias } | { ok: false; error: string } {
  if (puestoExcluidoParaAgente(agente.puestosExcluidos, puesto, puestos)) {
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
  puestos: PuestoConfig[] = getPuestos(),
): { ok: true; asignaciones: AsignacionesDiarias } | { ok: false; error: string } {
  if (puestoExcluidoParaAgente(agente.puestosExcluidos, puesto, puestos)) {
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
