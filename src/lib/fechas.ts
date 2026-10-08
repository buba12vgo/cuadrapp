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

/** Día natural en hora de Madrid. */
export function hoyEnMadrid(ahora = new Date()) {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Europe/Madrid',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(ahora)
  const leer = (tipo: Intl.DateTimeFormatPartTypes) =>
    Number(parts.find((part) => part.type === tipo)?.value)
  return { anio: leer('year'), mes: leer('month'), dia: leer('day') }
}

export function esFechaIso(valor: unknown): valor is string {
  return typeof valor === 'string' && FECHA_ISO_RE.test(valor)
}

/**
 * Clave numérica única para cachear por día natural (`mes` en base 1). Devuelve
 * `null` fuera de rango: `Date` normaliza desbordes y dos entradas distintas
 * podrían compartir clave sin representar el mismo día.
 */
export function claveDiaCalendario(anio: number, mes: number, dia: number) {
  if (!Number.isInteger(anio) || !Number.isInteger(mes) || !Number.isInteger(dia)) {
    return null
  }
  if (mes < 1 || mes > 12 || dia < 1 || dia > 31) return null
  return (anio * 13 + mes) * 32 + dia
}
