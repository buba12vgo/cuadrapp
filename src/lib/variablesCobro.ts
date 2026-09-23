import type { AsignacionesDiarias, TurnoAsignable } from '@/lib/calendarioPuestos'
import { esDiaTrabajado } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import { esJornadaDisponible } from '@/lib/jornadaDisponible'
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
  'conciliacion_sabado_tarde',
  'festivo',
  'jornada_disponible',
] as const

export type TipoVariableCobro = (typeof TIPOS_VARIABLE_COBRO)[number]

/** El autogenerador no reparte JD; se marca a mano en el cuadrante. */
export const TIPOS_VARIABLE_COBRO_EQUILIBRIO = [
  'conciliacion_viernes_noche',
  'conciliacion_sabado_manana',
  'conciliacion_sabado_tarde',
  'festivo',
] as const satisfies readonly TipoVariableCobro[]

export const TIPOS_CONCILIACION = [
  'conciliacion_viernes_noche',
  'conciliacion_sabado_manana',
  'conciliacion_sabado_tarde',
] as const satisfies readonly TipoVariableCobro[]

export const ETIQUETA_VARIABLE_COBRO: Record<TipoVariableCobro, string> = {
  conciliacion_viernes_noche: 'Conciliación viernes noche',
  conciliacion_sabado_manana: 'Conciliación sábado mañana',
  conciliacion_sabado_tarde: 'Conciliación sábado tarde',
  festivo: 'Festivo',
  jornada_disponible: 'Jornada Disponible',
}

/** Etiquetas cortas para widgets y cabeceras densas. */
export const ETIQUETA_CORTA_VARIABLE_COBRO: Record<TipoVariableCobro, string> = {
  conciliacion_viernes_noche: 'Conciliación VN',
  conciliacion_sabado_manana: 'Conciliación SM',
  conciliacion_sabado_tarde: 'Conciliación ST',
  festivo: 'Festivo',
  jornada_disponible: 'Jornada Disp.',
}

/** Abreviatura de columna (tabla). */
export const ABREV_VARIABLE_COBRO: Record<TipoVariableCobro, string> = {
  conciliacion_viernes_noche: 'VN',
  conciliacion_sabado_manana: 'SM',
  conciliacion_sabado_tarde: 'ST',
  festivo: 'Fest.',
  jornada_disponible: 'JD',
}

export type ConteoVariablesCobro = Record<TipoVariableCobro, number>

export function conteoVariablesCobroVacio(): ConteoVariablesCobro {
  return {
    conciliacion_viernes_noche: 0,
    conciliacion_sabado_manana: 0,
    conciliacion_sabado_tarde: 0,
    festivo: 0,
    jornada_disponible: 0,
  }
}

export type OpcionesConteoCobro = {
  asignaciones?: AsignacionesDiarias
  agenteId?: string
}

function sumarFestivoDia(
  diasFestivoCobrados: Map<string, number>,
  anio: number,
  mes: number,
  dia: number,
  counts: ConteoVariablesCobro,
  unidades: number,
) {
  const fecha = isoFecha(anio, mes, dia)
  const ya = diasFestivoCobrados.get(fecha) ?? 0
  if (unidades <= ya) return
  counts.festivo += unidades - ya
  diasFestivoCobrados.set(fecha, unidades)
}

/**
 * Cuenta variables de cobro mensuales desde el cuadrante diario.
 * Festivo: una unidad por día festivo en M, T o N. M-T (mañana y tarde)
 * suma dos. La noche de sábado y la noche de domingo se cobran como festivo
 * aunque ese día no esté en el calendario. Noche sábado (22–06): si el
 * domingo es festivo, suma el tramo de domingo que aún no esté cobrado.
 * Conciliaciones y festivos se acumulan a la vez. M-T en sábado suma
 * conciliación de mañana y de tarde.
 * Jornada Disponible se marca en asignaciones (M/T/N/MT).
 */
export function contarVariablesCobroAgente(
  fila: Turno[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
  opciones?: OpcionesConteoCobro,
): ConteoVariablesCobro {
  const counts = conteoVariablesCobroVacio()
  const nDias = fila.length
  const diasFestivoCobrados = new Map<string, number>()
  const asignaciones = opciones?.asignaciones
  const agenteId = opciones?.agenteId

  for (let dia = 1; dia <= nDias; dia++) {
    const turno = fila[dia - 1]
    if (
      asignaciones &&
      agenteId &&
      (turno === 'M' ||
        turno === 'T' ||
        turno === 'N' ||
        turno === 'MT')
    ) {
      const fecha = isoFecha(anio, mes, dia)
      const asignado =
        asignaciones[fecha]?.[turno as TurnoAsignable]?.[agenteId]
      if (esJornadaDisponible(asignado)) counts.jornada_disponible++
    }

    if (!esDiaTrabajado(turno)) continue
    if (turno !== 'M' && turno !== 'T' && turno !== 'N' && turno !== 'MT') {
      continue
    }

    const wd = diaSemana(anio, mes, dia)
    const manana = turno === 'M' || turno === 'MT'
    const tarde = turno === 'T' || turno === 'MT'

    if (wd === 5 && turno === 'N') counts.conciliacion_viernes_noche++
    if (wd === 6 && manana) counts.conciliacion_sabado_manana++
    if (wd === 6 && tarde) counts.conciliacion_sabado_tarde++

    if (diaEsFestivoCobro(anio, mes, dia, eventos)) {
      sumarFestivoDia(
        diasFestivoCobrados,
        anio,
        mes,
        dia,
        counts,
        turno === 'MT' ? 2 : 1,
      )
    }

    if (turno === 'N' && (wd === 6 || wd === 0)) {
      sumarFestivoDia(diasFestivoCobrados, anio, mes, dia, counts, 1)
    }

    if (wd === 6 && turno === 'N') {
      const domingo = dia + 1
      if (
        domingo <= nDias &&
        diaEsFestivoCobro(anio, mes, domingo, eventos)
      ) {
        sumarFestivoDia(diasFestivoCobrados, anio, mes, domingo, counts, 1)
      }
    }
  }

  return counts
}

export function totalConciliaciones(conteo: ConteoVariablesCobro) {
  return TIPOS_CONCILIACION.reduce((suma, tipo) => suma + conteo[tipo], 0)
}

export function totalFestivos(conteo: ConteoVariablesCobro) {
  return conteo.festivo
}

/** Festivos + conciliaciones del mes (variables de cobro, sin findes laborados). */
export function sumatorioFMensual(
  fila: Turno[],
  anio: number,
  mes: number,
  eventos: EventoOperativo[],
) {
  const variables = contarVariablesCobroAgente(fila, anio, mes, eventos)
  return totalFestivos(variables) + totalConciliaciones(variables)
}

export function totalVariablesCobro(conteo: ConteoVariablesCobro) {
  return TIPOS_VARIABLE_COBRO.reduce((suma, tipo) => suma + conteo[tipo], 0)
}

/** Menor es más equilibrado (diferencia máx-mín por tipo y en total). */
export function puntajeDesbalanceVariables(conteos: ConteoVariablesCobro[]) {
  if (conteos.length === 0) return 0
  let puntaje = 0
  for (const tipo of TIPOS_VARIABLE_COBRO_EQUILIBRIO) {
    const valores = conteos.map((c) => c[tipo])
    if (valores.every((v) => v === 0)) continue
    const peso = tipo === 'festivo' ? 10 : 20
    puntaje += (Math.max(...valores) - Math.min(...valores)) * peso
  }
  const totales = conteos.map(totalVariablesCobro)
  puntaje += Math.max(...totales) - Math.min(...totales)
  return puntaje
}

/** Desbalance del sumatorio F (festivos + conciliaciones) entre agentes. */
export function puntajeDesbalanceSumatorioF(sumatorios: number[]) {
  if (sumatorios.length < 2) return 0
  return (Math.max(...sumatorios) - Math.min(...sumatorios)) * 30
}

/** Puntaje combinado para equilibrar al autogenerar el mes. */
export function puntajeEquilibrioVariablesMensual(
  conteos: ConteoVariablesCobro[],
  sumatoriosF: number[],
) {
  return puntajeDesbalanceVariables(conteos) + puntajeDesbalanceSumatorioF(sumatoriosF)
}
