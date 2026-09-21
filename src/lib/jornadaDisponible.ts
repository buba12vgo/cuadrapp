/** Jornada de disponibilidad (M/T/N o M-T). Se cobra y genera un LPD. */
export const NOMBRE_JORNADA_DISPONIBLE = 'Jornada Disponible'
export const ABREV_JORNADA_DISPONIBLE = 'JD'

export const CODIGO_LIBRE_DISPONIBILIDAD = 'LIBRE_DISPONIBILIDAD'
export const NOMBRE_LIBRE_DISPONIBILIDAD = 'Libre por Disponibilidad'
export const ABREV_LIBRE_DISPONIBILIDAD = 'LPD'

export function esJornadaDisponible(valor: string | undefined | null) {
  if (!valor) return false
  const limpio = valor.trim()
  if (!limpio) return false
  return (
    limpio === NOMBRE_JORNADA_DISPONIBLE ||
    limpio.toUpperCase() === ABREV_JORNADA_DISPONIBLE
  )
}

export function esAbrevJornadaDisponible(abrev: string | undefined | null) {
  return (abrev ?? '').trim().toUpperCase() === ABREV_JORNADA_DISPONIBLE
}

export function esLibrePorDisponibilidad(valor: string | undefined | null) {
  if (!valor) return false
  const limpio = valor.trim()
  if (!limpio) return false
  return (
    limpio === NOMBRE_LIBRE_DISPONIBILIDAD ||
    limpio.toUpperCase() === ABREV_LIBRE_DISPONIBILIDAD ||
    limpio.toUpperCase() === CODIGO_LIBRE_DISPONIBILIDAD
  )
}

export function conJornadaDisponible(puestos: string[]) {
  if (puestos.some((puesto) => esJornadaDisponible(puesto))) return puestos
  return [NOMBRE_JORNADA_DISPONIBLE, ...puestos]
}

export function abreviaturaJornadaOPuesto(
  nombre: string,
  abreviaturaPuesto: (nombre: string) => string,
) {
  if (esJornadaDisponible(nombre)) return ABREV_JORNADA_DISPONIBLE
  return abreviaturaPuesto(nombre)
}
