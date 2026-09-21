import type { AsignacionesDiarias, TurnoAsignable } from '@/lib/calendarioPuestos'
import { diasDelMes } from '@/lib/convenio'
import {
  cuadranteDesdeFirestore,
  type CuadranteMensualFirestore,
} from '@/lib/cuadranteFirestore'
import { getCuadrante, getCuadranteJefes } from '@/lib/db'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import {
  esJornadaDisponible,
  esLibrePorDisponibilidad,
  NOMBRE_JORNADA_DISPONIBLE,
  NOMBRE_LIBRE_DISPONIBILIDAD,
} from '@/lib/jornadaDisponible'
import type { PermisoConfig } from '@/lib/permisos'
import { esRolCuadranteJefes } from '@/lib/rolesCuadrante'
import type { FichaPolicia, Turno } from '@/types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

export type ResumenPermisosAgente = {
  porTipo: Record<string, number>
  jornadaDisponible: number
}

export function resumenPermisosVacio(): ResumenPermisosAgente {
  return { porTipo: {}, jornadaDisponible: 0 }
}

export function diasTipoPermiso(
  resumen: ResumenPermisosAgente,
  nombre: string,
) {
  return resumen.porTipo[nombre] ?? 0
}

export function diasLibreDisponibilidad(resumen: ResumenPermisosAgente) {
  const porNombre = resumen.porTipo[NOMBRE_LIBRE_DISPONIBILIDAD] ?? 0
  if (porNombre > 0) return porNombre
  let extra = 0
  for (const [nombre, dias] of Object.entries(resumen.porTipo)) {
    if (esLibrePorDisponibilidad(nombre)) extra += dias
  }
  return extra
}

export function saldoLibreDisponibilidad(resumen: ResumenPermisosAgente) {
  return resumen.jornadaDisponible - diasLibreDisponibilidad(resumen)
}

function sumarTipo(resumen: ResumenPermisosAgente, nombre: string, n = 1) {
  resumen.porTipo[nombre] = (resumen.porTipo[nombre] ?? 0) + n
}

export function acumularPermisosMes(
  resumen: ResumenPermisosAgente,
  fila: Turno[],
  asignaciones: AsignacionesDiarias,
  agenteId: string,
  anio: number,
  mes: number,
) {
  const nDias = fila.length
  for (let dia = 1; dia <= nDias; dia++) {
    const turno = fila[dia - 1]
    if (!turno) continue
    const fecha = isoFecha(anio, mes, dia)
    const asignable = turno as TurnoAsignable
    const asignado = asignaciones[fecha]?.[asignable]?.[agenteId]

    if (turno === 'P') {
      sumarTipo(resumen, asignado || 'Permiso')
      continue
    }

    if (
      (turno === 'M' || turno === 'T' || turno === 'N' || turno === 'MT') &&
      esJornadaDisponible(asignado)
    ) {
      resumen.jornadaDisponible += 1
    }
  }
}

export function acumularPermisosDesdeFirestore(
  resumen: ResumenPermisosAgente,
  datos: CuadranteMensualFirestore,
  agente: FichaPolicia,
  anio: number,
  mes: number,
  permisos?: PermisoConfig[],
) {
  const nDias = diasDelMes(anio, mes)
  const { cuadrante, asignaciones } = cuadranteDesdeFirestore(
    datos,
    [agente],
    anio,
    mes,
    nDias,
    { permisos },
  )
  acumularPermisosMes(
    resumen,
    cuadrante[agente.id] ?? [],
    asignaciones,
    agente.id,
    anio,
    mes,
  )
}

export function tiposPermisoEnResumen(
  catalogo: PermisoConfig[],
  resumen: ResumenPermisosAgente,
) {
  const vistos = new Set(catalogo.map((permiso) => permiso.nombre))
  const extra = Object.keys(resumen.porTipo).filter(
    (nombre) =>
      !vistos.has(nombre) && nombre !== NOMBRE_JORNADA_DISPONIBLE,
  )
  return { catalogo, extra }
}

export function filasCuadranteAgente(
  agente: FichaPolicia,
  cuadranteOperativo: CuadranteMensual | undefined,
  cuadranteJefes: CuadranteMensual | undefined,
) {
  if (esRolCuadranteJefes(agente.rolBase)) {
    return cuadranteJefes?.[agente.id] ?? []
  }
  return cuadranteOperativo?.[agente.id] ?? []
}

export function asignacionesCuadranteAgente(
  agente: FichaPolicia,
  asignacionesOperativo: AsignacionesDiarias | undefined,
  asignacionesJefes: AsignacionesDiarias | undefined,
) {
  if (esRolCuadranteJefes(agente.rolBase)) {
    return asignacionesJefes ?? {}
  }
  return asignacionesOperativo ?? {}
}

export async function cargarResumenPermisosAgente(
  agente: FichaPolicia,
  anio: number,
  permisos?: PermisoConfig[],
): Promise<ResumenPermisosAgente> {
  const resumen = resumenPermisosVacio()
  const jefes = esRolCuadranteJefes(agente.rolBase)
  const meses = await Promise.all(
    Array.from({ length: 12 }, (_, i) => {
      const mes = i + 1
      return (jefes ? getCuadranteJefes(mes, anio) : getCuadrante(mes, anio)).catch(
        () => null,
      )
    }),
  )
  for (let mes = 1; mes <= 12; mes++) {
    const datos = meses[mes - 1]
    if (!datos) continue
    acumularPermisosDesdeFirestore(resumen, datos, agente, anio, mes, permisos)
  }
  return resumen
}
