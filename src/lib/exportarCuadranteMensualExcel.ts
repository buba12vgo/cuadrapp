import * as XLSX from 'xlsx'
import { abreviaturaPuesto, esTurnoOperativo } from '@/lib/asignacionPuestos'
import {
  type AsignacionesDiarias,
  type PuestoConfig,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import {
  diasOperativosConvenio,
  esFinDeSemana,
  totalTrabajados,
} from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import { maxFindesConsecutivosLaborados } from '@/lib/finesSemana'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import {
  esPoliciaBolsa,
  type PlanAnual,
  type TurnoAnual,
} from '@/lib/generarPlanAnual'
import type { FichaPolicia, RolPolicia, Turno } from '@/types'

const MESES = [
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

const DIA_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const
const TURNOS_OP = ['M', 'T', 'N'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function turnoPlanMes(
  agente: { rolBase: RolPolicia; id: string },
  planAnual: PlanAnual,
  mes: number,
): TurnoAnual | null {
  const turno = planAnual[agente.id]?.[mes - 1]
  if (turno != null) return turno
  if (esPoliciaBolsa(agente.rolBase)) return null
  return 'M'
}

function textoCelda(
  turno: Turno,
  fecha: string,
  agenteId: string,
  asignaciones: AsignacionesDiarias,
  puestos: PuestoConfig[],
) {
  if (esTurnoOperativo(turno)) {
    const abrev = abreviaturaPuesto(
      asignaciones,
      fecha,
      agenteId,
      turno as TurnoOperativo,
      puestos,
    )
    if (abrev) return `${turno}\n${abrev}`
  }
  return turno
}

export type ExportarCuadranteMensualOpciones = {
  anio: number
  mes: number
  diaDesde: number
  diaHasta: number
  rolLabel: string
  turnoVistaLabel: string
  agentes: FichaPolicia[]
  agentesTotales: FichaPolicia[]
  cuadrante: CuadranteMensual
  planAnual: PlanAnual
  asignacionesDiarias: AsignacionesDiarias
  puestos: PuestoConfig[]
  diasVisibles: number[]
}

export function exportarCuadranteMensualExcel(
  opciones: ExportarCuadranteMensualOpciones,
) {
  const {
    anio,
    mes,
    diaDesde,
    diaHasta,
    rolLabel,
    turnoVistaLabel,
    agentes,
    agentesTotales,
    cuadrante,
    planAnual,
    asignacionesDiarias,
    puestos,
    diasVisibles,
  } = opciones

  const nombreMes = MESES[mes - 1] ?? `Mes ${mes}`
  const objetivo = diasOperativosConvenio(anio, mes)

  const filas: (string | number)[][] = [
    ['Cuadrante mensual', `${nombreMes} ${anio}`],
    ['Desde', isoFecha(anio, mes, diaDesde)],
    ['Hasta', isoFecha(anio, mes, diaHasta)],
    ['Rol', rolLabel],
    ['Turno (vista)', turnoVistaLabel],
    ['Días operativos objetivo', objetivo],
    [],
  ]

  filas.push(['Día', ...agentes.map((a) => a.numeroPlaca), ...TURNOS_OP])

  for (const dia of diasVisibles) {
    const weekday = new Date(anio, mes - 1, dia).getDay()
    const especial =
      esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
    const etiquetaDia = `${dia} ${DIA_SEMANA[weekday]}${especial ? ' *' : ''}`
    const fechaDia = isoFecha(anio, mes, dia)

    const totales = { M: 0, T: 0, N: 0 }
    for (const agente of agentesTotales) {
      const turno = cuadrante[agente.id]?.[dia - 1]
      if (turno === 'M' || turno === 'T' || turno === 'N') {
        totales[turno] += 1
      }
    }

    filas.push([
      etiquetaDia,
      ...agentes.map((agente) => {
        const fila = cuadrante[agente.id] ?? []
        const turno = fila[dia - 1] ?? 'D'
        return textoCelda(
          turno,
          fechaDia,
          agente.id,
          asignacionesDiarias,
          puestos,
        )
      }),
      totales.M,
      totales.T,
      totales.N,
    ])
  }

  filas.push([
    'Σ',
    ...agentes.map((agente) => {
      const fila = cuadrante[agente.id] ?? []
      const turnoPlan = turnoPlanMes(agente, planAnual, mes)
      const trabajados = totalTrabajados(fila)
      const findesConsec = maxFindesConsecutivosLaborados(fila, anio, mes)
      const objetivoFila =
        turnoPlan === 'V' || turnoPlan == null ? 0 : objetivo
      return `${trabajados}/${objetivoFila}d\n${findesConsec}Fs`
    }),
    '',
    '',
    '',
  ])

  const hoja = XLSX.utils.aoa_to_sheet(filas)
  hoja['!cols'] = [
    { wch: 8 },
    ...agentes.map(() => ({ wch: 6 })),
    ...TURNOS_OP.map(() => ({ wch: 5 })),
  ]

  const libro = XLSX.utils.book_new()
  const hojaNombre = `${nombreMes.slice(0, 3)} ${anio}`
  XLSX.utils.book_append_sheet(libro, hoja, hojaNombre.slice(0, 31))
  XLSX.writeFile(libro, `cuadrante-${anio}-${pad(mes)}.xlsx`)
}
