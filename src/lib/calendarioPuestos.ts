import type { EventoOperativo } from '@/types'

export type TurnoOperativo = 'M' | 'T' | 'N'
export type MinimosPuesto = { M: number; T: number; N: number }
/** Nombre del puesto (clave usada en asignaciones y eventos). */
export type PuestoBase = string
export type MinimosDia = Record<string, MinimosPuesto>

export type PuestoConfig = {
  codigo: string
  nombre: string
  abreviatura: string
}

/** Lunes=1 … Domingo=7 (ISO). */
export type DiaSemana = 1 | 2 | 3 | 4 | 5 | 6 | 7
export type MinimosSemana = Record<DiaSemana, MinimosDia>

export const DIAS_SEMANA_CONFIG = [
  { dia: 1 as DiaSemana, clave: 'L', label: 'Lunes' },
  { dia: 2 as DiaSemana, clave: 'M', label: 'Martes' },
  { dia: 3 as DiaSemana, clave: 'X', label: 'Miércoles' },
  { dia: 4 as DiaSemana, clave: 'J', label: 'Jueves' },
  { dia: 5 as DiaSemana, clave: 'V', label: 'Viernes' },
  { dia: 6 as DiaSemana, clave: 'S', label: 'Sábado' },
  { dia: 7 as DiaSemana, clave: 'D', label: 'Domingo' },
] as const

export const PUESTOS_INICIALES: PuestoConfig[] = [
  { codigo: 'CENTRO_CONTROL', nombre: 'Centro de Control', abreviatura: 'CTR' },
  { codigo: 'LONJAS', nombre: 'Lonjas', abreviatura: 'LNJ' },
  { codigo: 'BERBES', nombre: 'Berbés Acceso', abreviatura: 'BRB' },
  { codigo: 'RETEN', nombre: 'Retén', abreviatura: 'RTN' },
]

/** @deprecated Usar lista desde puestosStore; se mantiene para seeds. */
export const PUESTOS_BASE = PUESTOS_INICIALES.map((p) => p.nombre)

export const MINIMOS_DEFECTO_BASE: MinimosDia = {
  'Centro de Control': { M: 2, T: 2, N: 1 },
  Lonjas: { M: 3, T: 2, N: 1 },
  'Berbés Acceso': { M: 2, T: 2, N: 2 },
  Retén: { M: 1, T: 1, N: 1 },
}

/** Alias histórico; preferir minimos desde el store. */
export const MINIMOS_DEFECTO = MINIMOS_DEFECTO_BASE

export const ABREV_PUESTO_INICIAL: Record<string, string> = Object.fromEntries(
  PUESTOS_INICIALES.map((p) => [p.nombre, p.abreviatura]),
)

export const CODIGO_PUESTO_INICIAL: Record<string, string> = Object.fromEntries(
  PUESTOS_INICIALES.map((p) => [p.nombre, p.codigo]),
)

/** @deprecated Preferir abreviaturaDesdePuestos */
export const ABREV_PUESTO = ABREV_PUESTO_INICIAL
/** @deprecated Preferir codigoDesdePuestos */
export const CODIGO_PUESTO = CODIGO_PUESTO_INICIAL

/** Asignaciones: fecha ISO → turno → agenteId → puesto (nombre). */
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

export function nombresPuestos(puestos: PuestoConfig[]) {
  return puestos.map((p) => p.nombre)
}

export function mapaAbreviaturas(puestos: PuestoConfig[]) {
  return Object.fromEntries(puestos.map((p) => [p.nombre, p.abreviatura]))
}

export function mapaCodigos(puestos: PuestoConfig[]) {
  return Object.fromEntries(puestos.map((p) => [p.nombre, p.codigo]))
}

export function abreviaturaDesdePuestos(
  puestos: PuestoConfig[],
  nombre: string,
) {
  return puestos.find((p) => p.nombre === nombre)?.abreviatura ?? nombre.slice(0, 3).toUpperCase()
}

export function codigoDesdePuestos(puestos: PuestoConfig[], nombre: string) {
  return puestos.find((p) => p.nombre === nombre)?.codigo ?? nombre
}

export function clonarMinimosPuesto(minimos: MinimosPuesto): MinimosPuesto {
  return { M: minimos.M, T: minimos.T, N: minimos.N }
}

export function clonarMinimos(
  minimos: MinimosDia,
  puestos?: string[],
): MinimosDia {
  const claves = puestos ?? Object.keys(minimos)
  const copia: MinimosDia = {}
  for (const puesto of claves) {
    const valor = minimos[puesto] ?? { M: 0, T: 0, N: 0 }
    copia[puesto] = clonarMinimosPuesto(valor)
  }
  return copia
}

export function minimosVaciosParaPuestos(puestos: PuestoConfig[]): MinimosDia {
  const copia: MinimosDia = {}
  for (const puesto of puestos) {
    copia[puesto.nombre] = { M: 0, T: 0, N: 0 }
  }
  return copia
}

export function minimosBaseParaPuestos(puestos: PuestoConfig[]): MinimosDia {
  const copia: MinimosDia = {}
  for (const puesto of puestos) {
    copia[puesto.nombre] = clonarMinimosPuesto(
      MINIMOS_DEFECTO_BASE[puesto.nombre] ?? { M: 1, T: 1, N: 1 },
    )
  }
  return copia
}

export function crearMinimosSemana(puestos: PuestoConfig[]): MinimosSemana {
  const base = minimosBaseParaPuestos(puestos)
  return {
    1: clonarMinimos(base),
    2: clonarMinimos(base),
    3: clonarMinimos(base),
    4: clonarMinimos(base),
    5: clonarMinimos(base),
    6: clonarMinimos(base),
    7: clonarMinimos(base),
  }
}

export function clonarMinimosSemana(semana: MinimosSemana): MinimosSemana {
  return {
    1: clonarMinimos(semana[1]),
    2: clonarMinimos(semana[2]),
    3: clonarMinimos(semana[3]),
    4: clonarMinimos(semana[4]),
    5: clonarMinimos(semana[5]),
    6: clonarMinimos(semana[6]),
    7: clonarMinimos(semana[7]),
  }
}

/** Convierte Date.getDay() (0=domingo) a ISO 1=lunes … 7=domingo. */
export function diaSemanaDesdeDate(date: Date): DiaSemana {
  const js = date.getDay()
  return (js === 0 ? 7 : js) as DiaSemana
}

export function diaSemanaDesdeFecha(fecha: string): DiaSemana {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return diaSemanaDesdeDate(new Date(anio, (mes ?? 1) - 1, dia ?? 1))
}

export function minimosDefectoParaFecha(
  fecha: string,
  semana: MinimosSemana,
  puestos: PuestoConfig[],
): MinimosDia {
  const dia = diaSemanaDesdeFecha(fecha)
  return clonarMinimos(semana[dia], nombresPuestos(puestos))
}

export function minimosDesdeEvento(
  evento: EventoOperativo,
  puestos: PuestoConfig[],
  base: MinimosDia,
): MinimosDia {
  const copia = clonarMinimos(base, nombresPuestos(puestos))
  for (const puesto of puestos) {
    const mod = evento.modificadoresMinimos[puesto.nombre]
    if (mod) copia[puesto.nombre] = clonarMinimosPuesto(mod)
  }
  return copia
}

export function minimosParaFecha(
  fecha: string,
  eventos: EventoOperativo[],
  semana: MinimosSemana,
  puestos: PuestoConfig[],
): MinimosDia {
  const base = minimosDefectoParaFecha(fecha, semana, puestos)
  const evento = eventos.find((item) => item.fecha === fecha)
  if (evento) return minimosDesdeEvento(evento, puestos, base)
  return base
}

export function puestoExcluidoParaAgente(
  puestosExcluidos: string[],
  puesto: PuestoBase,
  puestos: PuestoConfig[],
) {
  const codigo = codigoDesdePuestos(puestos, puesto)
  return (
    puestosExcluidos.includes(codigo) || puestosExcluidos.includes(puesto)
  )
}

export function minimosIgualesDefecto(
  minimos: MinimosDia,
  defecto: MinimosDia,
  puestos: PuestoConfig[],
) {
  return puestos.every((puesto) => {
    const actual = minimos[puesto.nombre] ?? { M: 0, T: 0, N: 0 }
    const base = defecto[puesto.nombre] ?? { M: 0, T: 0, N: 0 }
    return (
      actual.M === base.M && actual.T === base.T && actual.N === base.N
    )
  })
}

export function minimosARecord(minimos: MinimosDia, puestos: PuestoConfig[]) {
  const record: EventoOperativo['modificadoresMinimos'] = {}
  for (const puesto of puestos) {
    record[puesto.nombre] = clonarMinimosPuesto(
      minimos[puesto.nombre] ?? { M: 0, T: 0, N: 0 },
    )
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

export function normalizarCodigo(valor: string) {
  return valor
    .trim()
    .toUpperCase()
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/[^A-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '')
}

export function sugerirAbreviatura(nombre: string) {
  const limpio = nombre.trim()
  if (!limpio) return ''
  const partes = limpio.split(/\s+/).filter(Boolean)
  if (partes.length === 1) return partes[0].slice(0, 3).toUpperCase()
  return partes
    .map((p) => p[0] ?? '')
    .join('')
    .slice(0, 4)
    .toUpperCase()
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
