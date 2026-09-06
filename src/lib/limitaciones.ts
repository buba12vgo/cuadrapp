import type { Limitaciones } from '@/types'

export const LIMITACIONES_DEFECTO: Limitaciones = { M: true, T: true, N: true }

export function leerLimitaciones(valor: unknown): Limitaciones {
  if (!valor || typeof valor !== 'object') return { ...LIMITACIONES_DEFECTO }
  const raw = valor as Record<string, unknown>

  if ('M' in raw || 'T' in raw || 'N' in raw) {
    return {
      M: raw.M !== false,
      T: raw.T !== false,
      N: raw.N !== false,
    }
  }

  if (raw.soloManana === true) return { M: true, T: false, N: false }
  if (raw.soloMananaNoche === true) return { M: true, T: false, N: true }
  if (raw.exentoNoches === true) return { M: true, T: true, N: false }
  return { ...LIMITACIONES_DEFECTO }
}

export function turnosLaboralesPermitidos(lim: Limitaciones) {
  const turnos: Array<'M' | 'T' | 'N'> = []
  if (lim.M) turnos.push('M')
  if (lim.T) turnos.push('T')
  if (lim.N) turnos.push('N')
  return turnos
}

/** Solo mañana y tarde (sin noches). */
export function esSoloMananaYTarde(lim: Limitaciones) {
  return lim.M && lim.T && !lim.N
}

/** Reparto equilibrado de meses M/T (p. ej. 5-6 o 6-5 en 11 meses laborables). */
export function cuposBalanceadosMananaTarde(libres: number) {
  if (libres <= 0) return { M: 0, T: 0, N: 0 }
  const M = Math.floor(libres / 2)
  return { M, T: libres - M, N: 0 }
}

/** Valida reparto M/T equilibrado para agentes sin noches. */
export function filaCumpleBalanceMT(
  lim: Limitaciones,
  totales: { M: number; T: number; N: number },
) {
  if (!esSoloMananaYTarde(lim)) return true
  const labor = totales.M + totales.T + totales.N
  const esperado = cuposBalanceadosMananaTarde(labor)
  return (
    totales.N === 0 &&
    totales.M === esperado.M &&
    totales.T === esperado.T
  )
}
