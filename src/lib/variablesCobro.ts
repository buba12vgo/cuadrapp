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
  'festivo',
] as const

export type TipoVariableCobro = (typeof TIPOS_VARIABLE_COBRO)[number]

export const ETIQUETA_VARIABLE_COBRO: Record<TipoVariableCobro, string> = {
  conciliacion_viernes_noche: 'Conciliación viernes noche',
  conciliacion_sabado_manana: 'Conciliación sábado mañana',
  conciliacion_domingo_manana: 'Conciliación domingo mañana',
  festivo: 'Festivo',
}

export type ConteoVariablesCobro = Record<TipoVariableCobro, number>

export function conteoVariablesCobroVacio(): ConteoVariablesCobro {
  return {
    conciliacion_viernes_noche: 0,
    conciliacion_sabado_manana: 0,
    conciliacion_domingo_manana: 0,
    festivo: 0,
  }
}

function sumarFestivoDia(
  diasFestivoCobrados: Set<string>,
  anio: number,
  mes: number,
  dia: number,
  counts: ConteoVariablesCobro,
) {
  const fecha = isoFecha(anio, mes, dia)
  if (diasFestivoCobrados.has(fecha)) return
  diasFestivoCobrados.add(fecha)
  counts.festivo++
}

/**
 * Cuenta variables de cobro mensuales desde el cuadrante diario.
 * Festivo: una unidad por día festivo trabajado (M/T/N, sin distinguir turno).
 * Noche sábado (22–06): si el domingo es festivo y no se cobró ya ese día,
 * suma otro festivo por el tramo en domingo. Conciliaciones y festivos son
 * independientes.
 */
export function contarVariablesCobroAgente(
  fila: Turno[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
): ConteoVariablesCobro {
  const counts = conteoVariablesCobroVacio()
  const nDias = fila.length
  const diasFestivoCobrados = new Set<string>()

  for (let dia = 1; dia <= nDias; dia++) {
    const turno = fila[dia - 1]
    if (!esDiaTrabajado(turno)) continue
    if (turno !== 'M' && turno !== 'T' && turno !== 'N') continue

    const wd = diaSemana(anio, mes, dia)

    if (wd === 5 && turno === 'N') counts.conciliacion_viernes_noche++
    if (wd === 6 && turno === 'M') counts.conciliacion_sabado_manana++
    if (wd === 0 && turno === 'M') counts.conciliacion_domingo_manana++

    if (diaEsFestivoCobro(anio, mes, dia, eventos)) {
      sumarFestivoDia(diasFestivoCobrados, anio, mes, dia, counts)
    }

    if (wd === 6 && turno === 'N') {
      const domingo = dia + 1
      if (
        domingo <= nDias &&
        diaEsFestivoCobro(anio, mes, domingo, eventos)
      ) {
        sumarFestivoDia(diasFestivoCobrados, anio, mes, domingo, counts)
      }
    }
  }

  return counts
}

export function totalVariablesCobro(conteo: ConteoVariablesCobro) {
  return TIPOS_VARIABLE_COBRO.reduce((suma, tipo) => suma + conteo[tipo], 0)
}

/** Menor es más equilibrado (diferencia máx-mín por tipo y en total). */
export function puntajeDesbalanceVariables(conteos: ConteoVariablesCobro[]) {
  if (conteos.length === 0) return 0
  let puntaje = 0
  for (const tipo of TIPOS_VARIABLE_COBRO) {
    const valores = conteos.map((c) => c[tipo])
    if (valores.every((v) => v === 0)) continue
    puntaje += (Math.max(...valores) - Math.min(...valores)) * 10
  }
  const totales = conteos.map(totalVariablesCobro)
  puntaje += Math.max(...totales) - Math.min(...totales)
  return puntaje
}
