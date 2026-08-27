import type { DragEvent } from 'react'
import {
  abreviaturaDesdePuestos,
  minimosParaFecha,
  puestoExcluidoParaAgente,
  type AsignacionesDiarias,
  type MinimosDia,
  type MinimosSemana,
  type PuestoBase,
  type PuestoConfig,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { getPuestos } from '@/lib/puestosStore'
import type { EventoOperativo, FichaPolicia } from '@/types'

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

export function contarOcupacionPuesto(
  asignaciones: AsignacionesDiarias,
  fecha: string,
  turno: TurnoOperativo,
  puesto: PuestoBase,
  excluirAgenteId?: string,
) {
  const porAgente = asignaciones[fecha]?.[turno] ?? {}
  let total = 0
  for (const [agenteId, asignado] of Object.entries(porAgente)) {
    if (excluirAgenteId && agenteId === excluirAgenteId) continue
    if (asignado === puesto) total += 1
  }
  return total
}

function minimoPuestoTurno(
  minimos: MinimosDia,
  puesto: PuestoBase,
  turno: TurnoOperativo,
) {
  return minimos[puesto]?.[turno] ?? 0
}

/**
 * Elige puesto para un día operativo sin dejar al agente vacío.
 * - Prefiere el arrastrado si aún no cubre el mínimo.
 * - Si el mínimo del arrastrado ya está cubierto, busca otro puesto
 *   permitido que aún necesite gente.
 * - Si no hay alternativa, asigna igual el arrastrado (mejor de más que vacío).
 */
export function elegirPuestoParaDia(opts: {
  preferido: PuestoBase
  agente: FichaPolicia
  asignaciones: AsignacionesDiarias
  fecha: string
  turno: TurnoOperativo
  minimos: MinimosDia
  puestos?: PuestoConfig[]
}): PuestoBase {
  const {
    preferido,
    agente,
    asignaciones,
    fecha,
    turno,
    minimos,
    puestos = getPuestos(),
  } = opts

  const permitidos = puestosPermitidosParaAgente(agente, puestos)
  if (!permitidos.includes(preferido)) {
    // Excluido: intentar otro que necesite cobertura.
    const alternativa = permitidos.find((puesto) => {
      const ocupacion = contarOcupacionPuesto(
        asignaciones,
        fecha,
        turno,
        puesto,
        agente.id,
      )
      return ocupacion < minimoPuestoTurno(minimos, puesto, turno)
    })
    return alternativa ?? preferido
  }

  const ocupacionPreferido = contarOcupacionPuesto(
    asignaciones,
    fecha,
    turno,
    preferido,
    agente.id,
  )
  const minimoPreferido = minimoPuestoTurno(minimos, preferido, turno)

  // Solo buscamos alternativa si el mínimo (>0) ya está cubierto.
  const yaCubierto =
    minimoPreferido > 0 && ocupacionPreferido >= minimoPreferido
  if (!yaCubierto) return preferido

  // Mínimo del puesto arrastrado ya cubierto: no dejar al agente sin puesto.
  const alternativa = permitidos.find((puesto) => {
    if (puesto === preferido) return false
    const minimo = minimoPuestoTurno(minimos, puesto, turno)
    if (minimo <= 0) return false
    const ocupacion = contarOcupacionPuesto(
      asignaciones,
      fecha,
      turno,
      puesto,
      agente.id,
    )
    return ocupacion < minimo
  })

  return alternativa ?? preferido
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
  // Soltar en celda: siempre el puesto pedido; nunca se deja vacío por el mínimo.
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
  minimosDeFecha?: (fecha: string) => MinimosDia,
): { ok: true; asignaciones: AsignacionesDiarias } | { ok: false; error: string } {
  if (puestoExcluidoParaAgente(agente.puestosExcluidos, puesto, puestos)) {
    return { ok: false, error: 'Puesto excluido para este agente' }
  }

  const copia = clonarAsignaciones(asignaciones)
  for (const { fecha, turno } of fechasTurno) {
    const actual = copia[fecha]?.[turno]?.[agente.id]
    // Si ya tiene puesto, no lo quitamos.
    if (actual) continue

    if (!copia[fecha]) copia[fecha] = {}
    if (!copia[fecha][turno]) copia[fecha][turno] = {}

    const minimos = minimosDeFecha?.(fecha)
    const elegido = minimos
      ? elegirPuestoParaDia({
          preferido: puesto,
          agente,
          asignaciones: copia,
          fecha,
          turno,
          minimos,
          puestos,
        })
      : puesto

    copia[fecha][turno] = {
      ...copia[fecha][turno],
      [agente.id]: elegido,
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

export function crearMinimosDeFecha(
  eventos: EventoOperativo[],
  semana: MinimosSemana,
  puestos: PuestoConfig[] = getPuestos(),
) {
  return (fecha: string) => minimosParaFecha(fecha, eventos, semana, puestos)
}
