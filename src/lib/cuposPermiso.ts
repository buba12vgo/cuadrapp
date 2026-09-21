import {
  esLibrePorDisponibilidad,
} from '@/lib/jornadaDisponible'
import type { PermisoConfig } from '@/lib/permisos'
import type { FichaPolicia } from '@/types'

export const CODIGO_DIAS_ANO_ANTERIOR = 'DIAS_ANO_ANTERIOR'
export const NOMBRE_DIAS_ANO_ANTERIOR = 'Días del Año Anterior'
export const ABREV_DIAS_ANO_ANTERIOR = 'DAA'

export type UsosPermisoAnio = {
  porTipo: Record<string, number>
  jornadaDisponible: number
}

/** 31 de diciembre 23:59 hora de Madrid (CET, UTC+1). */
export function instanteCierreAnioMs(anio: number) {
  return Date.UTC(anio, 11, 31, 22, 59, 0)
}

export function anioHaCerrado(anio: number, ahora = Date.now()) {
  return ahora >= instanteCierreAnioMs(anio)
}

export function anioEnMadrid(ahora = Date.now()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
  }).formatToParts(new Date(ahora))
  return Number(parts.find((part) => part.type === 'year')?.value)
}

export function esDiasAnoAnterior(valor: string | undefined | null) {
  if (!valor) return false
  const limpio = valor.trim()
  if (!limpio) return false
  return (
    limpio === NOMBRE_DIAS_ANO_ANTERIOR ||
    limpio.toUpperCase() === ABREV_DIAS_ANO_ANTERIOR ||
    limpio.toUpperCase() === CODIGO_DIAS_ANO_ANTERIOR
  )
}

export function normalizarDiasAnuales(valor: unknown) {
  if (typeof valor !== 'number' || !Number.isFinite(valor)) return 0
  return Math.min(366, Math.max(0, Math.round(valor)))
}

export function diasAnualesCatalogo(permiso: PermisoConfig) {
  if (permiso.codigo === 'ASUNTOS_PROPIOS' && permiso.diasAnuales == null) {
    return 6
  }
  return normalizarDiasAnuales(permiso.diasAnuales)
}

/** 0 en catálogo = sin tope (no genera saldo a DAA), salvo LPD y DAA. */
export function esTopeFinito(permiso: PermisoConfig) {
  if (esDiasAnoAnterior(permiso.codigo) || esDiasAnoAnterior(permiso.nombre)) {
    return true
  }
  if (
    esLibrePorDisponibilidad(permiso.codigo) ||
    esLibrePorDisponibilidad(permiso.nombre)
  ) {
    return true
  }
  return diasAnualesCatalogo(permiso) > 0
}

export function codigoDesdePermisos(
  permisos: PermisoConfig[],
  nombre: string,
) {
  return (
    permisos.find((permiso) => permiso.nombre === nombre)?.codigo ??
    permisos.find(
      (permiso) =>
        permiso.abreviatura.toUpperCase() === nombre.trim().toUpperCase(),
    )?.codigo ??
    null
  )
}

export function permisoPorNombre(
  permisos: PermisoConfig[],
  nombre: string | undefined | null,
) {
  if (!nombre) return null
  return (
    permisos.find((permiso) => permiso.nombre === nombre) ??
    permisos.find((permiso) => esDiasAnoAnterior(nombre) && esDiasAnoAnterior(permiso.codigo)) ??
    permisos.find(
      (permiso) =>
        esLibrePorDisponibilidad(nombre) &&
        esLibrePorDisponibilidad(permiso.codigo),
    ) ??
    null
  )
}

function leerMapaCupos(valor: unknown): Record<string, number> {
  if (!valor || typeof valor !== 'object') return {}
  const result: Record<string, number> = {}
  for (const [codigo, dias] of Object.entries(valor as Record<string, unknown>)) {
    if (!codigo.trim()) continue
    result[codigo.trim().toUpperCase()] = normalizarDiasAnuales(dias)
  }
  return result
}

export function leerCuposPermisoAgente(agente: FichaPolicia) {
  return leerMapaCupos(agente.cuposPermiso)
}

export function leerCuposPermisoAnio(agente: FichaPolicia, anio: number) {
  const mapa = agente.cuposPermisoAnio
  if (!mapa || typeof mapa !== 'object') return {}
  return leerMapaCupos(mapa[String(anio)])
}

export type SaldoPermiso = {
  codigo: string
  nombre: string
  abreviatura: string
  /** null = sin tope anual. */
  cupo: number | null
  usados: number
  restan: number | null
}

function cupoBaseAgente(
  agente: FichaPolicia,
  permiso: PermisoConfig,
): number | null {
  if (esDiasAnoAnterior(permiso.codigo) || esDiasAnoAnterior(permiso.nombre)) {
    return 0
  }
  const override = leerCuposPermisoAgente(agente)[permiso.codigo]
  if (override != null) return override
  if (
    esLibrePorDisponibilidad(permiso.codigo) ||
    esLibrePorDisponibilidad(permiso.nombre)
  ) {
    return 0
  }
  const catalogo = diasAnualesCatalogo(permiso)
  return catalogo > 0 ? catalogo : null
}

export function saldoTipoPermiso(
  agente: FichaPolicia,
  permiso: PermisoConfig,
  anio: number,
  resumen: UsosPermisoAnio,
): SaldoPermiso {
  const usados = resumen.porTipo[permiso.nombre] ?? 0
  const daaAnio = leerCuposPermisoAnio(agente, anio)[CODIGO_DIAS_ANO_ANTERIOR]
  let cupo = cupoBaseAgente(agente, permiso)

  if (esDiasAnoAnterior(permiso.codigo) || esDiasAnoAnterior(permiso.nombre)) {
    cupo = daaAnio ?? 0
  } else if (
    esLibrePorDisponibilidad(permiso.codigo) ||
    esLibrePorDisponibilidad(permiso.nombre)
  ) {
    cupo = (cupo ?? 0) + resumen.jornadaDisponible
  }

  const restan = cupo == null ? null : cupo - usados
  return {
    codigo: permiso.codigo,
    nombre: permiso.nombre,
    abreviatura: permiso.abreviatura,
    cupo,
    usados,
    restan,
  }
}

export function saldosPermisoAgente(
  agente: FichaPolicia,
  permisos: PermisoConfig[],
  anio: number,
  resumen: UsosPermisoAnio,
): SaldoPermiso[] {
  return permisos.map((permiso) =>
    saldoTipoPermiso(agente, permiso, anio, resumen),
  )
}

export function totalRestanteTrasladable(saldos: SaldoPermiso[]) {
  let total = 0
  for (const saldo of saldos) {
    if (saldo.restan == null) continue
    total += Math.max(0, saldo.restan)
  }
  return total
}

export function cuposAnioConRollover(
  agente: FichaPolicia,
  anio: number,
  daa: number,
): Record<string, Record<string, number>> {
  const actual = { ...(agente.cuposPermisoAnio ?? {}) }
  const delAnio = { ...(actual[String(anio)] ?? {}) }
  delAnio[CODIGO_DIAS_ANO_ANTERIOR] = Math.max(0, Math.round(daa))
  actual[String(anio)] = delAnio
  return actual
}

export function restanParaAsignar(
  agente: FichaPolicia,
  permisos: PermisoConfig[],
  anio: number,
  resumen: UsosPermisoAnio,
  nombrePermiso: string,
  extraUsados = 0,
) {
  const permiso = permisoPorNombre(permisos, nombrePermiso)
  if (!permiso) return { restan: null as number | null, saldo: null as SaldoPermiso | null }
  const saldo = saldoTipoPermiso(agente, permiso, anio, {
    ...resumen,
    porTipo: {
      ...resumen.porTipo,
      [permiso.nombre]: (resumen.porTipo[permiso.nombre] ?? 0) + extraUsados,
    },
  })
  return { restan: saldo.restan, saldo }
}

export function mensajeSinSaldo(saldo: SaldoPermiso) {
  const cupo = saldo.cupo ?? 0
  return `No quedan días de ${saldo.nombre} para este agente (${saldo.usados}/${cupo} usados).`
}
