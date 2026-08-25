/** Festivos nacionales y de Galicia. El calendario operativo los reutilizará. */

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function iso(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function sumarDias(fecha: Date, dias: number) {
  const copia = new Date(fecha)
  copia.setDate(copia.getDate() + dias)
  return copia
}

/** Domingo de Pascua (algoritmo gregoriano anónimo). */
function domingoPascua(anio: number) {
  const a = anio % 19
  const b = Math.floor(anio / 100)
  const c = anio % 100
  const d = Math.floor(b / 4)
  const e = b % 4
  const f = Math.floor((b + 8) / 25)
  const g = Math.floor((b - f + 1) / 3)
  const h = (19 * a + b - d - g + 15) % 30
  const i = Math.floor(c / 4)
  const k = c % 4
  const l = (32 + 2 * e + 2 * i - h - k) % 7
  const m = Math.floor((a + 11 * h + 22 * l) / 451)
  const mes = Math.floor((h + l - 7 * m + 114) / 31)
  const dia = ((h + l - 7 * m + 114) % 31) + 1
  return new Date(anio, mes - 1, dia)
}

const FIJOS: [number, number][] = [
  [1, 1],
  [1, 6],
  [5, 1],
  [5, 17],
  [7, 25],
  [8, 15],
  [10, 12],
  [11, 1],
  [12, 6],
  [12, 8],
  [12, 25],
]

const cache = new Map<number, Set<string>>()

export function festivosDelAnio(anio: number) {
  const guardado = cache.get(anio)
  if (guardado) return guardado

  const set = new Set<string>()
  for (const [mes, dia] of FIJOS) set.add(iso(anio, mes, dia))

  const pascua = domingoPascua(anio)
  const viernesSanto = sumarDias(pascua, -2)
  set.add(iso(viernesSanto.getFullYear(), viernesSanto.getMonth() + 1, viernesSanto.getDate()))

  cache.set(anio, set)
  return set
}

/** `mes` es 1–12. */
export function esFestivo(anio: number, mes: number, dia: number) {
  return festivosDelAnio(anio).has(iso(anio, mes, dia))
}
