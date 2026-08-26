import type { TurnoOperativo } from '@/lib/calendarioPuestos'

export type FiltroTurnoBolsa = 'TODOS' | TurnoOperativo

const CLAVE_OCULTOS = 'cuadrapp.bolsaPuestos.ocultos'
const CLAVE_TURNO = 'cuadrapp.bolsaPuestos.filtroTurno'

export function leerPuestosOcultos(): string[] {
  try {
    const raw = localStorage.getItem(CLAVE_OCULTOS)
    if (!raw) return []
    const lista = JSON.parse(raw) as unknown
    if (!Array.isArray(lista)) return []
    return lista.filter((item): item is string => typeof item === 'string')
  } catch {
    return []
  }
}

export function guardarPuestosOcultos(codigos: string[]) {
  localStorage.setItem(CLAVE_OCULTOS, JSON.stringify(codigos))
}

export function leerFiltroTurnoBolsa(): FiltroTurnoBolsa {
  try {
    const raw = localStorage.getItem(CLAVE_TURNO)
    if (raw === 'M' || raw === 'T' || raw === 'N' || raw === 'TODOS') return raw
  } catch {
    // localStorage no disponible
  }
  return 'TODOS'
}

export function guardarFiltroTurnoBolsa(filtro: FiltroTurnoBolsa) {
  localStorage.setItem(CLAVE_TURNO, filtro)
}
