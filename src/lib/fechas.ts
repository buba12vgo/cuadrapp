export const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

export const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

export const FECHA_ISO_RE = /^\d{4}-\d{2}-\d{2}$/

export function pad2(n: number) {
  return String(n).padStart(2, '0')
}

/** `YYYY-MM-DD` con `mes` en base 1. */
export function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad2(mes)}-${pad2(dia)}`
}

export function esFechaIso(valor: unknown): valor is string {
  return typeof valor === 'string' && FECHA_ISO_RE.test(valor)
}
