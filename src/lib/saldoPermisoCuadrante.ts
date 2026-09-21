import {
  esTurnoAsignable,
  quitarAsignacionCelda,
} from '@/lib/asignacionPuestos'
import type { AsignacionesDiarias } from '@/lib/calendarioPuestos'
import {
  acumularPermisosMes,
  resumenPermisosVacio,
  type ResumenPermisosAgente,
} from '@/lib/conteoPermisos'
import {
  mensajeSinSaldo,
  restanParaAsignar,
} from '@/lib/cuposPermiso'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import type { PermisoConfig } from '@/lib/permisos'
import type { FichaPolicia, Turno } from '@/types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

export function resumenMesAgente(
  fila: Turno[],
  asignaciones: AsignacionesDiarias,
  agenteId: string,
  anio: number,
  mes: number,
): ResumenPermisosAgente {
  const resumen = resumenPermisosVacio()
  acumularPermisosMes(resumen, fila, asignaciones, agenteId, anio, mes)
  return resumen
}

export function resumenesMesCuadrante(
  agentes: { id: string }[],
  cuadrante: CuadranteMensual,
  asignaciones: AsignacionesDiarias,
  anio: number,
  mes: number,
): Record<string, ResumenPermisosAgente> {
  const mapa: Record<string, ResumenPermisosAgente> = {}
  for (const agente of agentes) {
    mapa[agente.id] = resumenMesAgente(
      cuadrante[agente.id] ?? [],
      asignaciones,
      agente.id,
      anio,
      mes,
    )
  }
  return mapa
}

export function resumenAnioAjustadoAlMes(
  anio: ResumenPermisosAgente,
  mesCargado: ResumenPermisosAgente,
  mesLocal: ResumenPermisosAgente,
): ResumenPermisosAgente {
  const nombres = new Set([
    ...Object.keys(anio.porTipo),
    ...Object.keys(mesCargado.porTipo),
    ...Object.keys(mesLocal.porTipo),
  ])
  const porTipo: Record<string, number> = {}
  for (const nombre of nombres) {
    porTipo[nombre] =
      (anio.porTipo[nombre] ?? 0) -
      (mesCargado.porTipo[nombre] ?? 0) +
      (mesLocal.porTipo[nombre] ?? 0)
  }
  return {
    porTipo,
    jornadaDisponible:
      anio.jornadaDisponible -
      mesCargado.jornadaDisponible +
      mesLocal.jornadaDisponible,
  }
}

function filaConPermiso(fila: Turno[], dia: number, nDias: number): Turno[] {
  const siguiente = fila.length
    ? [...fila]
    : Array.from({ length: nDias }, () => 'D' as Turno)
  siguiente[dia - 1] = 'P'
  return siguiente
}

function asignacionesConPermisoCelda(
  asignaciones: AsignacionesDiarias,
  agenteId: string,
  fecha: string,
  turnoActual: Turno,
  permiso: string,
): AsignacionesDiarias {
  let siguiente = asignaciones
  if (turnoActual !== 'P' && esTurnoAsignable(turnoActual)) {
    siguiente = quitarAsignacionCelda(siguiente, agenteId, fecha, turnoActual)
  }
  return {
    ...siguiente,
    [fecha]: {
      ...(siguiente[fecha] ?? {}),
      P: {
        ...(siguiente[fecha]?.P ?? {}),
        [agenteId]: permiso,
      },
    },
  }
}

function asignacionesConPermisoMes(
  asignaciones: AsignacionesDiarias,
  fila: Turno[],
  agenteId: string,
  anio: number,
  mes: number,
  permiso: string,
): AsignacionesDiarias {
  const copia: AsignacionesDiarias = { ...asignaciones }
  for (let dia = 1; dia <= fila.length; dia++) {
    if (fila[dia - 1] !== 'P') continue
    const fecha = isoFecha(anio, mes, dia)
    copia[fecha] = {
      ...(copia[fecha] ?? {}),
      P: {
        ...(copia[fecha]?.P ?? {}),
        [agenteId]: permiso,
      },
    }
  }
  return copia
}

export function mensajeSiSinSaldoPermiso(
  agente: FichaPolicia,
  permisos: PermisoConfig[],
  anio: number,
  resumenAnio: ResumenPermisosAgente,
  mesCargado: ResumenPermisosAgente,
  mesLocal: ResumenPermisosAgente,
  nombrePermiso: string,
): string | null {
  const resumen = resumenAnioAjustadoAlMes(resumenAnio, mesCargado, mesLocal)
  const { restan, saldo } = restanParaAsignar(
    agente,
    permisos,
    anio,
    resumen,
    nombrePermiso,
  )
  if (restan == null || restan >= 0) return null
  return saldo ? mensajeSinSaldo(saldo) : `No quedan días de ${nombrePermiso}.`
}

export function mensajeSiNoPuedeAsignarCelda(opts: {
  agente: FichaPolicia
  permisos: PermisoConfig[]
  anio: number
  mes: number
  nDias: number
  dia: number
  fecha: string
  turnoActual: Turno
  permiso: string
  cuadrante: CuadranteMensual
  asignaciones: AsignacionesDiarias
  resumenAnio: ResumenPermisosAgente
  mesCargado: ResumenPermisosAgente
}): string | null {
  const actual =
    opts.turnoActual === 'P'
      ? opts.asignaciones[opts.fecha]?.P?.[opts.agente.id]
      : undefined
  if (actual === opts.permiso) return null

  const fila = filaConPermiso(
    opts.cuadrante[opts.agente.id] ?? [],
    opts.dia,
    opts.nDias,
  )
  const asignaciones = asignacionesConPermisoCelda(
    opts.asignaciones,
    opts.agente.id,
    opts.fecha,
    opts.turnoActual,
    opts.permiso,
  )
  return mensajeSiSinSaldoPermiso(
    opts.agente,
    opts.permisos,
    opts.anio,
    opts.resumenAnio,
    opts.mesCargado,
    resumenMesAgente(fila, asignaciones, opts.agente.id, opts.anio, opts.mes),
    opts.permiso,
  )
}

export function mensajeSiNoPuedeAsignarMes(opts: {
  agente: FichaPolicia
  permisos: PermisoConfig[]
  anio: number
  mes: number
  permiso: string
  cuadrante: CuadranteMensual
  asignaciones: AsignacionesDiarias
  resumenAnio: ResumenPermisosAgente
  mesCargado: ResumenPermisosAgente
}): string | null {
  const fila = opts.cuadrante[opts.agente.id] ?? []
  const asignaciones = asignacionesConPermisoMes(
    opts.asignaciones,
    fila,
    opts.agente.id,
    opts.anio,
    opts.mes,
    opts.permiso,
  )
  return mensajeSiSinSaldoPermiso(
    opts.agente,
    opts.permisos,
    opts.anio,
    opts.resumenAnio,
    opts.mesCargado,
    resumenMesAgente(fila, asignaciones, opts.agente.id, opts.anio, opts.mes),
    opts.permiso,
  )
}
