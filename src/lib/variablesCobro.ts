import { esDiaTrabajado } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import type { EventoOperativo, Turno } from '@/types'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function diaSemana(anio: number, mes: number, dia: number) {
  return new Date(anio, mes - 1, dia).getDay()
}

/** Festivo nacional/gallego o evento de calendario tipo FESTIVO. */
export function diaEsFestivoCobro(
  anio: number,
  mes: number,
  dia: number,
  eventos: EventoOperativo[],
) {
  if (esFestivo(anio, mes, dia)) return true
  const fecha = isoFecha(anio, mes, dia)
  return eventos.some(
    (evento) => evento.fecha === fecha && evento.tipo === 'FESTIVO',
  )
}

export const TIPOS_VARIABLE_COBRO = [
  'conciliacion_viernes_noche',
  'conciliacion_sabado_manana',
  'conciliacion_domingo_manana',
  'festivo_manana',
  'festivo_tarde',
  'festivo_noche',
] as const

export type TipoVariableCobro = (typeof TIPOS_VARIABLE_COBRO)[number]

export const ETIQUETA_VARIABLE_COBRO: Record<TipoVariableCobro, string> = {
  conciliacion_viernes_noche: 'Conciliación viernes noche',
  conciliacion_sabado_manana: 'Conciliación sábado mañana',
  conciliacion_domingo_manana: 'Conciliación domingo mañana',
  festivo_manana: 'Festivo mañana',
  festivo_tarde: 'Festivo tarde',
  festivo_noche: 'Festivo noche',
}

export type ConteoVariablesCobro = Record<TipoVariableCobro, number>

export function conteoVariablesCobroVacio(): ConteoVariablesCobro {
  return {
    conciliacion_viernes_noche: 0,
    conciliacion_sabado_manana: 0,
    conciliacion_domingo_manana: 0,
    festivo_manana: 0,
    festivo_tarde: 0,
    festivo_noche: 0,
  }
}

/**
 * Cuenta variables de cobro mensuales desde el cuadrante diario.
 * Turno N sábado (22–06): si el domingo es festivo suma festivo mañana
 * (2 h del turno en domingo); si el sábado es festivo suma festivo noche
 * (6 h del turno en sábado). Conciliaciones y festivos son independientes.
 */
export function contarVariablesCobroAgente(
  fila: Turno[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
): ConteoVariablesCobro {
  const counts = conteoVariablesCobroVacio()
  const nDias = fila.length

  for (let dia = 1; dia <= nDias; dia++) {
    const turno = fila[dia - 1]
    if (!esDiaTrabajado(turno)) continue
    if (turno !== 'M' && turno !== 'T' && turno !== 'N') continue

    const wd = diaSemana(anio, mes, dia)
    const festivo = diaEsFestivoCobro(anio, mes, dia, eventos)

    if (wd === 5 && turno === 'N') counts.conciliacion_viernes_noche++
    if (wd === 6 && turno === 'M') counts.conciliacion_sabado_manana++
    if (wd === 0 && turno === 'M') counts.conciliacion_domingo_manana++

    if (festivo) {
      if (turno === 'M') counts.festivo_manana++
      if (turno === 'T') counts.festivo_tarde++
      if (turno === 'N') counts.festivo_noche++
    }

    if (wd === 6 && turno === 'N') {
      const domingo = dia + 1
      if (
        domingo <= nDias &&
        diaEsFestivoCobro(anio, mes, domingo, eventos)
      ) {
        counts.festivo_manana++
      }
    }
  }

  return counts
}

export function totalVariablesCobro(conteo: ConteoVariablesCobro) {
  return TIPOS_VARIABLE_COBRO.reduce((suma, tipo) => suma + conteo[tipo], 0)
}
