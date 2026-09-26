import type { AsignacionesDiarias, TurnoAsignable } from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { esJornadaDisponible } from '@/lib/jornadaDisponible'
import type { Turno } from '@/types'

export type TipoSolicitud = 'PERMISO' | 'CAMBIO_DIA' | 'CAMBIO_MES' | 'VACACIONES'
export type EstadoSolicitud = 'PENDIENTE' | 'ACEPTADA' | 'RECHAZADA'

export type Solicitud = {
  id: string
  tipo: TipoSolicitud
  estado: EstadoSolicitud
  agenteId: string
  placa: string
  nombreAgente: string
  /** Día principal (YYYY-MM-DD). En un cambio de mes, el día 1 de ese mes. */
  fecha: string
  fechaFin?: string
  /** Mes destino YYYY-MM, en cambios de mes. */
  mesDestino?: string
  detalle?: string
  permisoCodigo?: string
  permisoNombre?: string
  creadaEn: string
  resueltaEn?: string
  /** NO_CUBRIR o el id del agente que se queda el puesto. */
  cobertura?: string
  coberturaNombre?: string
}

export const TIPOS_SOLICITUD: Array<{
  tipo: TipoSolicitud
  label: string
  hint: string
}> = [
  {
    tipo: 'PERMISO',
    label: 'Peticiones de permiso',
    hint: 'Un día y el concepto, si te queda saldo',
  },
  {
    tipo: 'CAMBIO_DIA',
    label: 'Cambios de días',
    hint: 'El día que quieres cambiar y el día propuesto',
  },
  {
    tipo: 'CAMBIO_MES',
    label: 'Cambios de mes',
    hint: 'El mes que tienes y el mes que propones',
  },
  {
    tipo: 'VACACIONES',
    label: 'Cambio de vacaciones',
    hint: 'El periodo de vacaciones que quieres mover',
  },
]

export const ETIQUETA_TIPO: Record<TipoSolicitud, string> = {
  PERMISO: 'Permiso',
  CAMBIO_DIA: 'Cambio de día',
  CAMBIO_MES: 'Cambio de mes',
  VACACIONES: 'Vacaciones',
}

export const ETIQUETA_ESTADO: Record<EstadoSolicitud, string> = {
  PENDIENTE: 'Pendiente',
  ACEPTADA: 'Aceptada',
  RECHAZADA: 'Rechazada',
}

const TURNOS_SERVICIO = new Set<Turno>(['M', 'T', 'N', 'MT'])

function esTurnoServicio(turno: Turno | null | undefined): turno is 'M' | 'T' | 'N' | 'MT' {
  return turno != null && TURNOS_SERVICIO.has(turno)
}

const TURNO_LABEL: Record<string, string> = {
  M: 'mañana',
  T: 'tarde',
  N: 'noche',
  MT: 'mañana-tarde',
}

export function etiquetaTurnoServicio(turno: string) {
  return TURNO_LABEL[turno] ?? turno
}

export function ordenarSolicitudes(lista: readonly Solicitud[]) {
  return [...lista].sort((a, b) => {
    const porDia = a.fecha.localeCompare(b.fecha)
    if (porDia !== 0) return porDia
    return a.creadaEn.localeCompare(b.creadaEn)
  })
}

export type CompaneroCobertura = {
  id: string
  placa: string
  nombre: string
  puesto: string
}

export type ContextoCobertura = {
  turno: Turno | null
  puestoLibre: string | null
  candidatos: CompaneroCobertura[]
}

function clonarAsignaciones(origen: AsignacionesDiarias): AsignacionesDiarias {
  const copia: AsignacionesDiarias = {}
  for (const [fecha, porTurno] of Object.entries(origen)) {
    copia[fecha] = {}
    for (const [turno, porAgente] of Object.entries(porTurno ?? {})) {
      copia[fecha]![turno as TurnoAsignable] = { ...porAgente }
    }
  }
  return copia
}

function clonarCuadrante(origen: CuadranteMensual): CuadranteMensual {
  const copia: CuadranteMensual = {}
  for (const [id, fila] of Object.entries(origen)) copia[id] = [...fila]
  return copia
}

/** Compañeros del mismo turno, en otro puesto, que pueden cubrir el hueco. */
export function contextoCobertura(opts: {
  cuadrante: CuadranteMensual
  asignaciones: AsignacionesDiarias
  fecha: string
  dia: number
  agenteId: string
  nombres: ReadonlyMap<string, { placa: string; nombre: string }>
}): ContextoCobertura {
  const turno = opts.cuadrante[opts.agenteId]?.[opts.dia - 1] ?? null
  if (!esTurnoServicio(turno)) {
    return { turno, puestoLibre: null, candidatos: [] }
  }
  const propio = opts.asignaciones[opts.fecha]?.[turno]?.[opts.agenteId] ?? null
  if (!propio || esJornadaDisponible(propio)) {
    return { turno, puestoLibre: null, candidatos: [] }
  }
  const candidatos: CompaneroCobertura[] = []
  for (const [id, fila] of Object.entries(opts.cuadrante)) {
    if (id === opts.agenteId) continue
    if (fila[opts.dia - 1] !== turno) continue
    const puesto = opts.asignaciones[opts.fecha]?.[turno]?.[id]
    if (!puesto || esJornadaDisponible(puesto) || puesto === propio) continue
    const ficha = opts.nombres.get(id)
    if (!ficha) continue
    candidatos.push({ id, placa: ficha.placa, nombre: ficha.nombre, puesto })
  }
  candidatos.sort((a, b) =>
    a.placa.localeCompare(b.placa, 'es', { numeric: true }),
  )
  return { turno, puestoLibre: propio, candidatos }
}

/**
 * Pasa el día del agente a permiso y, si hay cobertura, deja ese puesto
 * en el compañero elegido.
 */
export function aplicarPermisoEnCuadrante(opts: {
  cuadrante: CuadranteMensual
  asignaciones: AsignacionesDiarias
  fecha: string
  dia: number
  agenteId: string
  permisoNombre: string
  coberturaId?: string | null
}): { cuadrante: CuadranteMensual; asignaciones: AsignacionesDiarias } {
  const cuadrante = clonarCuadrante(opts.cuadrante)
  const asignaciones = clonarAsignaciones(opts.asignaciones)
  const fila = cuadrante[opts.agenteId]
  if (!fila || opts.dia < 1 || opts.dia > fila.length) {
    return { cuadrante, asignaciones }
  }
  const turno = fila[opts.dia - 1]
  const puesto = esTurnoServicio(turno)
    ? asignaciones[opts.fecha]?.[turno]?.[opts.agenteId]
    : undefined
  fila[opts.dia - 1] = 'P'
  if (esTurnoServicio(turno) && asignaciones[opts.fecha]?.[turno]) {
    delete asignaciones[opts.fecha]![turno]![opts.agenteId]
  }
  if (!asignaciones[opts.fecha]) asignaciones[opts.fecha] = {}
  if (!asignaciones[opts.fecha]!.P) asignaciones[opts.fecha]!.P = {}
  asignaciones[opts.fecha]!.P![opts.agenteId] = opts.permisoNombre
  if (
    opts.coberturaId &&
    puesto &&
    !esJornadaDisponible(puesto) &&
    esTurnoServicio(turno)
  ) {
    if (!asignaciones[opts.fecha]![turno]) asignaciones[opts.fecha]![turno] = {}
    asignaciones[opts.fecha]![turno]![opts.coberturaId] = puesto
  }
  return { cuadrante, asignaciones }
}
