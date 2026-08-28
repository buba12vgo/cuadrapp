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
