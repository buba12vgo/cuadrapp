import type { AsignacionesDiarias, TurnoAsignable } from '@/lib/calendarioPuestos'
import { diasDelMes } from '@/lib/convenio'
import {
  cuadranteDesdeFirestore,
  type CuadranteMensualFirestore,
} from '@/lib/cuadranteFirestore'
import { getCuadrante, getCuadranteJefes, saveAgente } from '@/lib/db'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import {
  esJornadaDisponible,
  esLibrePorDisponibilidad,
  NOMBRE_JORNADA_DISPONIBLE,
  NOMBRE_LIBRE_DISPONIBILIDAD,
} from '@/lib/jornadaDisponible'
import {
  anioHaCerrado,
  CODIGO_DIAS_ANO_ANTERIOR,
  cuposAnioConRollover,
  leerCuposPermisoAnio,
  saldosPermisoAgente,
  totalRestanteTrasladable,
} from '@/lib/cuposPermiso'
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
  const mapa = await cargarResumenesPermisosAnio([agente], anio, permisos)
  return mapa[agente.id] ?? resumenPermisosVacio()
}

export async function cargarResumenesPermisosAnio(
  agentes: FichaPolicia[],
  anio: number,
  permisos?: PermisoConfig[],
): Promise<Record<string, ResumenPermisosAgente>> {
  const resultado: Record<string, ResumenPermisosAgente> = {}
  for (const agente of agentes) resultado[agente.id] = resumenPermisosVacio()
  if (agentes.length === 0) return resultado

  const operativos = agentes.filter((agente) => !esRolCuadranteJefes(agente.rolBase))
  const jefes = agentes.filter((agente) => esRolCuadranteJefes(agente.rolBase))

  async function cargarGrupo(
    grupo: FichaPolicia[],
    getter: typeof getCuadrante,
  ) {
    if (grupo.length === 0) return
    const meses = await Promise.all(
      Array.from({ length: 12 }, (_, i) =>
        getter(i + 1, anio).catch(() => null),
      ),
    )
    for (let mes = 1; mes <= 12; mes++) {
      const datos = meses[mes - 1]
      if (!datos) continue
      for (const agente of grupo) {
        acumularPermisosDesdeFirestore(
          resultado[agente.id]!,
          datos,
          agente,
          anio,
          mes,
          permisos,
        )
      }
    }
  }

  await Promise.all([
    cargarGrupo(operativos, getCuadrante),
    cargarGrupo(jefes, getCuadranteJefes),
  ])
  return resultado
}

/** Devuelve solo los agentes cuyo snapshot DAA del año ha cambiado. */
export async function asegurarRolloverDaaPlantilla(
  agentes: FichaPolicia[],
  anio: number,
  permisos: PermisoConfig[],
  persistir = true,
): Promise<FichaPolicia[]> {
  const origen = anio - 1
  if (agentes.length === 0 || origen < 2020 || !anioHaCerrado(origen)) {
    return []
  }

  const resumenesOrigen = await cargarResumenesPermisosAnio(
    agentes,
    origen,
    permisos,
  )
  const cambiados: FichaPolicia[] = []
  for (const agente of agentes) {
    const saldos = saldosPermisoAgente(
      agente,
      permisos,
      origen,
      resumenesOrigen[agente.id] ?? resumenPermisosVacio(),
    )
    const daa = totalRestanteTrasladable(saldos)
    const actual = leerCuposPermisoAnio(agente, anio)[CODIGO_DIAS_ANO_ANTERIOR]
    if (actual === daa) continue

    const siguiente: FichaPolicia = {
      ...agente,
      cuposPermisoAnio: cuposAnioConRollover(agente, anio, daa),
    }
    if (!persistir) {
      cambiados.push(siguiente)
      continue
    }
    try {
      cambiados.push(await saveAgente(siguiente))
    } catch {
      cambiados.push(siguiente)
    }
  }
  return cambiados
}

export async function asegurarRolloverDaa(
  agente: FichaPolicia,
  anio: number,
  permisos: PermisoConfig[],
  persistir = true,
): Promise<FichaPolicia> {
  const cambiados = await asegurarRolloverDaaPlantilla(
    [agente],
    anio,
    permisos,
    persistir,
  )
  return cambiados[0] ?? agente
}
