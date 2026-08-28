import type {
  FichaPolicia,
  Limitaciones,
  ModoPreferenciaAnual,
  PatronPreferenciaAnual,
  PreferenciaAnual,
} from '@/types'

export const PATRONES_FIJOS: PatronPreferenciaAnual[] = [
  '4-4-3',
  '4-3-4',
  '5-3-3',
]

export const OBJETIVOS_POR_PATRON: Record<
  PatronPreferenciaAnual,
  Pick<PreferenciaAnual, 'objetivoM' | 'objetivoT' | 'objetivoN'>
> = {
  '4-4-3': { objetivoM: 4, objetivoT: 4, objetivoN: 3 },
  '4-3-4': { objetivoM: 4, objetivoT: 3, objetivoN: 4 },
  '5-3-3': { objetivoM: 5, objetivoT: 3, objetivoN: 3 },
}

export const PREFERENCIA_DEFECTO: PreferenciaAnual = {
  modo: '4-4-3',
  ...OBJETIVOS_POR_PATRON['4-4-3'],
}

export const ETIQUETA_PREFERENCIA: Record<ModoPreferenciaAnual, string> = {
  '4-4-3': '4-4-3',
  '4-3-4': '4-3-4',
  '5-3-3': '5-3-3',
  SIN_PREFERENCIA: 'Sin preferencia',
}

type Cupos = { M: number; T: number; N: number }

export function esModoPreferencia(valor: unknown): valor is ModoPreferenciaAnual {
  return (
    typeof valor === 'string' &&
    (PATRONES_FIJOS.includes(valor as PatronPreferenciaAnual) ||
      valor === 'SIN_PREFERENCIA')
  )
}

export function esSinPreferencia(pref: PreferenciaAnual) {
  return pref.modo === 'SIN_PREFERENCIA'
}

export function esPatronFijo(pref: PreferenciaAnual): pref is PreferenciaAnual & {
  modo: PatronPreferenciaAnual
} {
  return (
    pref.modo != null &&
    pref.modo !== 'SIN_PREFERENCIA' &&
    PATRONES_FIJOS.includes(pref.modo)
  )
}

export function inferirModoDesdeObjetivos(
  pref: Pick<PreferenciaAnual, 'objetivoM' | 'objetivoT' | 'objetivoN'>,
): PatronPreferenciaAnual | null {
  for (const patron of PATRONES_FIJOS) {
    const objetivos = OBJETIVOS_POR_PATRON[patron]
    if (
      objetivos.objetivoM === pref.objetivoM &&
      objetivos.objetivoT === pref.objetivoT &&
      objetivos.objetivoN === pref.objetivoN
    ) {
      return patron
    }
  }
  return null
}

export function modoEfectivo(pref: PreferenciaAnual): ModoPreferenciaAnual | null {
  if (pref.modo) return pref.modo
  return inferirModoDesdeObjetivos(pref)
}

export function patronCompatibleConLimitaciones(
  patron: PatronPreferenciaAnual,
  lim: Limitaciones,
) {
  const objetivos = OBJETIVOS_POR_PATRON[patron]
  if (objetivos.objetivoM > 0 && !lim.M) return false
  if (objetivos.objetivoT > 0 && !lim.T) return false
  if (objetivos.objetivoN > 0 && !lim.N) return false
  return true
}

export function patronesCompatibles(lim: Limitaciones): PatronPreferenciaAnual[] {
  return PATRONES_FIJOS.filter((patron) =>
    patronCompatibleConLimitaciones(patron, lim),
  )
}

export function objetivosDesdeModo(modo: ModoPreferenciaAnual): PreferenciaAnual {
  if (modo === 'SIN_PREFERENCIA') {
    return { modo, ...OBJETIVOS_POR_PATRON['4-4-3'] }
  }
  return { modo, ...OBJETIVOS_POR_PATRON[modo] }
}

export function leerPreferenciaAnual(valor: unknown): PreferenciaAnual {
  if (!valor || typeof valor !== 'object') return { ...PREFERENCIA_DEFECTO }
  const raw = valor as Record<string, unknown>
  const leerMes = (n: unknown, defecto: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return defecto
    return Math.min(12, Math.max(0, Math.round(n)))
  }

  const objetivoM = leerMes(raw.objetivoM, PREFERENCIA_DEFECTO.objetivoM)
  const objetivoT = leerMes(raw.objetivoT, PREFERENCIA_DEFECTO.objetivoT)
  const objetivoN = leerMes(raw.objetivoN, PREFERENCIA_DEFECTO.objetivoN)

  if (esModoPreferencia(raw.modo)) {
    if (raw.modo === 'SIN_PREFERENCIA') {
      return { modo: 'SIN_PREFERENCIA', objetivoM, objetivoT, objetivoN }
    }
    return { modo: raw.modo, ...OBJETIVOS_POR_PATRON[raw.modo] }
  }

  const inferido = inferirModoDesdeObjetivos({ objetivoM, objetivoT, objetivoN })
  if (inferido) {
    return { modo: inferido, objetivoM, objetivoT, objetivoN }
  }

  return { objetivoM, objetivoT, objetivoN }
}

export function vacacionesObjetivoPreferencia(pref: PreferenciaAnual) {
  if (esSinPreferencia(pref)) return 1
  return 12 - pref.objetivoM - pref.objetivoT - pref.objetivoN
}

export function cuposDesdePatron(
  agente: FichaPolicia,
  patron: PatronPreferenciaAnual,
  libres: number,
): Cupos {
  const lim = agente.limitaciones
  const objetivos = OBJETIVOS_POR_PATRON[patron]
  let M = lim.M ? Math.max(0, objetivos.objetivoM) : 0
  let T = lim.T ? Math.max(0, objetivos.objetivoT) : 0
  let N = lim.N ? Math.max(0, objetivos.objetivoN) : 0

  if (libres <= 0) return { M: 0, T: 0, N: 0 }

  const permitidos = [lim.M && 'M', lim.T && 'T', lim.N && 'N'].filter(
    Boolean,
  ).length
  if (permitidos === 0) return { M: 0, T: 0, N: 0 }
  if (permitidos === 1) {
    const turno = lim.M ? 'M' : lim.T ? 'T' : 'N'
    return {
      M: turno === 'M' ? libres : 0,
      T: turno === 'T' ? libres : 0,
      N: turno === 'N' ? libres : 0,
    }
  }

  if (lim.M && lim.N && !lim.T) {
    N = Math.min(Math.max(0, N), libres)
    return { M: libres - N, T: 0, N }
  }
  if (lim.M && lim.T && !lim.N) {
    T = Math.min(Math.max(0, T), libres)
    return { M: libres - T, T, N: 0 }
  }
  if (lim.T && lim.N && !lim.M) {
    N = Math.min(Math.max(0, N), libres)
    return { M: 0, T: libres - N, N }
  }

  const suma = M + T + N
  if (suma > libres) {
    N = lim.N ? Math.min(N, libres) : 0
    T = lim.T ? Math.min(T, libres - N) : 0
    M = lim.M ? libres - N - T : 0
  } else if (suma < libres) {
    if (lim.M) M += libres - suma
    else if (lim.T) T += libres - suma
    else if (lim.N) N += libres - suma
  }

  return { M, T, N }
}

export function filaCumplePreferencia(
  agente: FichaPolicia,
  totales: Cupos & { V: number },
) {
  if (totales.V !== vacacionesObjetivoPreferencia(agente.preferenciaAnual)) {
    return false
  }

  const real: Cupos = { M: totales.M, T: totales.T, N: totales.N }

  if (esSinPreferencia(agente.preferenciaAnual)) {
    const compatibles = patronesCompatibles(agente.limitaciones)
    if (compatibles.length === 0) {
      return real.M + real.T + real.N === 11
    }
    return compatibles.some((patron) => {
      const esperado = cuposDesdePatron(agente, patron, 11)
      return (
        real.M === esperado.M &&
        real.T === esperado.T &&
        real.N === esperado.N
      )
    })
  }

  if (esPatronFijo(agente.preferenciaAnual)) {
    const esperado = cuposDesdePatron(
      agente,
      agente.preferenciaAnual.modo,
      11,
    )
    return (
      real.M === esperado.M &&
      real.T === esperado.T &&
      real.N === esperado.N
    )
  }

  return (
    real.M === agente.preferenciaAnual.objetivoM &&
    real.T === agente.preferenciaAnual.objetivoT &&
    real.N === agente.preferenciaAnual.objetivoN
  )
}
