import {
  ABREV_LIBRE_DISPONIBILIDAD,
  CODIGO_LIBRE_DISPONIBILIDAD,
  NOMBRE_LIBRE_DISPONIBILIDAD,
} from '@/lib/jornadaDisponible'
import {
  ABREV_DIAS_ANO_ANTERIOR,
  CODIGO_DIAS_ANO_ANTERIOR,
  NOMBRE_DIAS_ANO_ANTERIOR,
} from '@/lib/cuposPermiso'

export type PermisoConfig = {
  codigo: string
  nombre: string
  abreviatura: string
  /** Días de cupo anual por agente. 0 = sin tope (no pasa a DAA). */
  diasAnuales?: number
  /** Si es false, no sale en la lista de permisos del agente. */
  visible?: boolean
}

/** Sin el campo, el permiso se muestra. */
export function permisoEsVisible(permiso: Pick<PermisoConfig, 'visible'>) {
  return permiso.visible !== false
}

export function saldosDePermisosVisibles<T extends { codigo: string }>(
  saldos: T[],
  permisos: PermisoConfig[],
) {
  const codigos = new Set(
    permisos.filter(permisoEsVisible).map((permiso) => permiso.codigo),
  )
  return saldos.filter((saldo) => codigos.has(saldo.codigo))
}

export const PERMISO_LIBRE_DISPONIBILIDAD: PermisoConfig = {
  codigo: CODIGO_LIBRE_DISPONIBILIDAD,
  nombre: NOMBRE_LIBRE_DISPONIBILIDAD,
  abreviatura: ABREV_LIBRE_DISPONIBILIDAD,
  diasAnuales: 0,
}

export const PERMISO_DIAS_ANO_ANTERIOR: PermisoConfig = {
  codigo: CODIGO_DIAS_ANO_ANTERIOR,
  nombre: NOMBRE_DIAS_ANO_ANTERIOR,
  abreviatura: ABREV_DIAS_ANO_ANTERIOR,
  diasAnuales: 0,
}

export const PERMISOS_INICIALES: PermisoConfig[] = [
  {
    codigo: 'ASUNTOS_PROPIOS',
    nombre: 'Asuntos propios',
    abreviatura: 'AP',
    diasAnuales: 6,
  },
  {
    codigo: 'ENFERMEDAD_FAMILIAR',
    nombre: 'Enfermedad de familiar',
    abreviatura: 'EF',
    diasAnuales: 0,
  },
  {
    codigo: 'IT',
    nombre: 'IT',
    abreviatura: 'IT',
    diasAnuales: 0,
  },
  PERMISO_LIBRE_DISPONIBILIDAD,
  PERMISO_DIAS_ANO_ANTERIOR,
]

export function clonarPermiso(permiso: PermisoConfig): PermisoConfig {
  return {
    codigo: permiso.codigo,
    nombre: permiso.nombre,
    abreviatura: permiso.abreviatura,
    diasAnuales: permiso.diasAnuales,
    visible: permiso.visible !== false,
  }
}

export function mapaAbreviaturasPermiso(permisos: PermisoConfig[]) {
  return Object.fromEntries(
    permisos.map((permiso) => [permiso.nombre, permiso.abreviatura]),
  )
}

export function abreviaturaDesdePermisos(
  permisos: PermisoConfig[],
  nombre: string,
) {
  return (
    permisos.find((permiso) => permiso.nombre === nombre)?.abreviatura ??
    nombre.slice(0, 3).toUpperCase()
  )
}

export function permisoDesdeAbrev(
  permisos: PermisoConfig[],
  abrev: string | undefined,
): string | null {
  if (!abrev) return null
  const limpio = abrev.trim().toUpperCase()
  return (
    permisos.find((permiso) => permiso.abreviatura.toUpperCase() === limpio)
      ?.nombre ?? null
  )
}
