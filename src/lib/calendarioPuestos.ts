import type { EventoOperativo } from '@/types'

export const PUESTOS_BASE = [
  'Centro de Control',
  'Lonjas',
  'Berbés Acceso',
  'Retén',
] as const

export type PuestoBase = (typeof PUESTOS_BASE)[number]
export type MinimosPuesto = { M: number; T: number; N: number }
export type MinimosDia = Record<PuestoBase, MinimosPuesto>

export const MINIMOS_DEFECTO: MinimosDia = {
  'Centro de Control': { M: 2, T: 2, N: 1 },
  Lonjas: { M: 3, T: 2, N: 1 },
  'Berbés Acceso': { M: 2, T: 2, N: 2 },
  Retén: { M: 1, T: 1, N: 1 },
}

export const ABREV_PUESTO: Record<PuestoBase, string> = {
  'Centro de Control': 'CTR',
  Lonjas: 'LNJ',
  'Berbés Acceso': 'BRB',
  Retén: 'RTN',
}

export const CODIGO_PUESTO: Record<PuestoBase, string> = {
  'Centro de Control': 'CENTRO_CONTROL',
  Lonjas: 'LONJAS',
  'Berbés Acceso': 'BERBES',
  Retén: 'RETEN',
}

export type TurnoOperativo = 'M' | 'T' | 'N'

/** Asignaciones: fecha ISO → turno → agenteId → puesto. */
export type AsignacionesDiarias = Record<
  string,
  Partial<Record<TurnoOperativo, Record<string, PuestoBase>>>
>

export type TipoDiaEditor = 'NORMAL' | 'FESTIVO' | 'CRUCERO' | 'CONCIERTO'

export const TIPO_DIA_LABEL: Record<TipoDiaEditor, string> = {
  NORMAL: 'Normal',
  FESTIVO: 'Festivo',
  CRUCERO: 'Crucero',
  CONCIERTO: 'Concierto',
}

export function clonarMinimos(minimos: MinimosDia): MinimosDia {
  const copia = {} as MinimosDia
  for (const puesto of PUESTOS_BASE) {
    copia[puesto] = { ...minimos[puesto] }
  }
  return copia
}

export function minimosDesdeEvento(evento: EventoOperativo): MinimosDia {
  const copia = clonarMinimos(MINIMOS_DEFECTO)
  for (const puesto of PUESTOS_BASE) {
    const mod = evento.modificadoresMinimos[puesto]
    if (mod) copia[puesto] = { ...mod }
  }
  return copia
}

export function minimosParaFecha(
  fecha: string,
  eventos: EventoOperativo[],
): MinimosDia {
  const evento = eventos.find((item) => item.fecha === fecha)
  if (evento) return minimosDesdeEvento(evento)
  return clonarMinimos(MINIMOS_DEFECTO)
}

export function puestoExcluidoParaAgente(
  puestosExcluidos: string[],
  puesto: PuestoBase,
) {
  return puestosExcluidos.includes(CODIGO_PUESTO[puesto])
}

export function minimosIgualesDefecto(minimos: MinimosDia) {
  return PUESTOS_BASE.every((puesto) => {
    const actual = minimos[puesto]
    const base = MINIMOS_DEFECTO[puesto]
    return (
      actual.M === base.M && actual.T === base.T && actual.N === base.N
    )
  })
}

export function minimosARecord(minimos: MinimosDia) {
  const record: EventoOperativo['modificadoresMinimos'] = {}
  for (const puesto of PUESTOS_BASE) {
    record[puesto] = { ...minimos[puesto] }
  }
  return record
}

export function tipoEditorDesdeEvento(
  evento: EventoOperativo | undefined,
): TipoDiaEditor {
  if (!evento) return 'NORMAL'
  if (evento.tipo === 'FESTIVO') return 'FESTIVO'
  if (evento.tipo === 'CRUCERO') return 'CRUCERO'
  if (evento.tipo === 'CONCIERTO') return 'CONCIERTO'
  return 'NORMAL'
}

export function tipoEventoDesdeEditor(tipo: TipoDiaEditor) {
  if (tipo === 'NORMAL') return 'OPERATIVA_ESPECIAL' as const
  return tipo
}

export const mockEventosCalendario: EventoOperativo[] = [
  {
    id: 'ev-001',
    fecha: '2026-08-15',
    tipo: 'FESTIVO',
    descripcion: 'Asunción',
    modificadoresMinimos: {
      'Centro de Control': { M: 1, T: 1, N: 1 },
      Lonjas: { M: 1, T: 1, N: 0 },
      'Berbés Acceso': { M: 2, T: 2, N: 1 },
      Retén: { M: 1, T: 0, N: 0 },
    },
  },
  {
    id: 'ev-002',
    fecha: '2026-08-22',
    tipo: 'CRUCERO',
    descripcion: 'Crucero transatlántico',
    modificadoresMinimos: {
      'Centro de Control': { M: 3, T: 3, N: 2 },
      Lonjas: { M: 4, T: 3, N: 2 },
      'Berbés Acceso': { M: 3, T: 3, N: 3 },
      Retén: { M: 2, T: 2, N: 1 },
    },
  },
]
