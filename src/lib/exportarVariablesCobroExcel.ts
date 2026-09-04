import * as XLSX from 'xlsx'
import {
  ETIQUETA_VARIABLE_COBRO,
  TIPOS_VARIABLE_COBRO,
  type ConteoVariablesCobro,
} from '@/lib/variablesCobro'
import type { FichaPolicia } from '@/types'

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

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export type ExportarVariablesCobroOpciones = {
  anio: number
  mes: number
  agentes: FichaPolicia[]
  conteos: Record<string, ConteoVariablesCobro>
}

export function exportarVariablesCobroExcel(opciones: ExportarVariablesCobroOpciones) {
  const { anio, mes, agentes, conteos } = opciones
  const nombreMes = MESES[mes - 1] ?? `Mes ${mes}`

  const filas: (string | number)[][] = [
    ['Variables de cobro mensuales', `${nombreMes} ${anio}`],
    ['Mes vencido · conciliaciones de finde y festivo (sin distinguir turno)'],
    [],
    [
      'Placa',
      'Nombre',
      ...TIPOS_VARIABLE_COBRO.map((t) => ETIQUETA_VARIABLE_COBRO[t]),
      'Total',
    ],
  ]

  for (const agente of agentes) {
    const conteo = conteos[agente.id] ?? conteoVacio()
    const total = TIPOS_VARIABLE_COBRO.reduce((s, t) => s + conteo[t], 0)
    filas.push([
      agente.numeroPlaca,
      `${agente.nombre} ${agente.apellidos}`,
      ...TIPOS_VARIABLE_COBRO.map((t) => conteo[t]),
      total,
    ])
  }

  const totalesColumna: number[] = TIPOS_VARIABLE_COBRO.map((tipo) =>
    agentes.reduce((s, a) => s + (conteos[a.id]?.[tipo] ?? 0), 0),
  )
  const totalGeneral = totalesColumna.reduce((s, n) => s + n, 0)
  filas.push(['', 'TOTAL', ...totalesColumna, totalGeneral])

  const hoja = XLSX.utils.aoa_to_sheet(filas)
  hoja['!cols'] = [
    { wch: 8 },
    { wch: 28 },
    ...TIPOS_VARIABLE_COBRO.map(() => ({ wch: 14 })),
    { wch: 8 },
  ]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    libro,
    hoja,
    `Variables ${nombreMes.slice(0, 3)}`.slice(0, 31),
  )
  XLSX.writeFile(libro, `variables-cobro-${anio}-${pad(mes)}.xlsx`)
}

function conteoVacio(): ConteoVariablesCobro {
  return {
    conciliacion_viernes_noche: 0,
    conciliacion_sabado_manana: 0,
    conciliacion_domingo_manana: 0,
    festivo: 0,
  }
}
