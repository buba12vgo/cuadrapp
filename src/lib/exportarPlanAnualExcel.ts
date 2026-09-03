import * as XLSX from 'xlsx'
import { filaVaciaPlanAnual, type ObjetivosGlobales, type PlanAnual } from '@/lib/generarPlanAnual'
import {
  esSinPreferencia,
  etiquetaPreferenciaEnPlan,
  patronCumplidoEnFila,
} from '@/lib/preferenciasAnuales'
import type { FichaPolicia } from '@/types'

const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

const TOTALES = ['M', 'T', 'N', 'V'] as const

type TotalesMes = { M: number; T: number; N: number; V: number }

function totalesFila(turnos: Array<string | null>) {
  const totales = { M: 0, T: 0, N: 0, V: 0 }
  for (const turno of turnos) {
    if (turno === 'M' || turno === 'T' || turno === 'N' || turno === 'V') {
      totales[turno] += 1
    }
  }
  return totales
}

function porcentaje(cantidad: number, base: number) {
  if (base <= 0) return null
  return (cantidad / base) * 100
}

function etiquetaPat(agente: FichaPolicia, totales: TotalesMes & { V: number }) {
  const patronAsignado = patronCumplidoEnFila(agente, totales)
  const sinPref = esSinPreferencia(agente.preferenciaAnual)
  if (sinPref) {
    return patronAsignado ? `Flex\n${patronAsignado}` : 'Flex'
  }
  if (patronAsignado) return patronAsignado
  return etiquetaPreferenciaEnPlan(agente)
}

export type ExportarPlanAnualOpciones = {
  anio: number
  grupoLabel: string
  objetivos: ObjetivosGlobales
  agentes: FichaPolicia[]
  plan: PlanAnual
  totalesMes: TotalesMes[]
  mesesMarcados?: Set<number>
  anioCuadra?: boolean
}

export function exportarPlanAnualExcel(opciones: ExportarPlanAnualOpciones) {
  const {
    anio,
    grupoLabel,
    objetivos,
    agentes,
    plan,
    totalesMes,
    mesesMarcados = new Set<number>(),
    anioCuadra = true,
  } = opciones

  const filas: (string | number)[][] = [
    ['Plan anual', anio],
    ['Vista', grupoLabel],
    ['% M objetivo', objetivos.M, '% T objetivo', objetivos.T, '% N objetivo', objetivos.N],
    [],
  ]

  const cabeceraMeses = MESES.map((mes, indice) =>
    mesesMarcados.has(indice) ? `!${mes}` : mes,
  )
  filas.push(['Agente', ...cabeceraMeses, ...TOTALES, 'Pat'])

  for (const agente of agentes) {
    const filaPlan = plan[agente.id] ?? filaVaciaPlanAnual()
    const totales = totalesFila(filaPlan)
    filas.push([
      `${agente.numeroPlaca} ${agente.nombre} ${agente.apellidos}`,
      ...filaPlan.map((turno) => turno ?? ''),
      totales.M,
      totales.T,
      totales.N,
      totales.V,
      etiquetaPat(agente, totales),
    ])
  }

  const activosAnio = totalesMes.reduce(
    (suma, columna) => suma + columna.M + columna.T + columna.N,
    0,
  )

  for (const turnoPie of ['M', 'T', 'N'] as const) {
    const cantidadAnio = totalesMes.reduce(
      (suma, columna) => suma + columna[turnoPie],
      0,
    )
    const pctAnio = porcentaje(cantidadAnio, activosAnio)
    const etiquetaPie =
      `% ${turnoPie}` + (anioCuadra ? '' : ' !')

    const celdasMes: string[] = []
    for (const columna of totalesMes) {
      const activos = columna.M + columna.T + columna.N
      const cantidad = columna[turnoPie]
      const real = porcentaje(cantidad, activos)
      if (real == null) {
        celdasMes.push('—')
      } else {
        celdasMes.push(`${cantidad}\n${real.toFixed(1)}%`)
      }
    }

    const totalesPie = TOTALES.map((clave) => {
      if (clave === turnoPie && pctAnio != null) {
        return `${pctAnio.toFixed(1)}%`
      }
      return ''
    })

    filas.push([etiquetaPie, ...celdasMes, ...totalesPie, ''])
  }

  const hoja = XLSX.utils.aoa_to_sheet(filas)
  hoja['!cols'] = [
    { wch: 28 },
    ...MESES.map(() => ({ wch: 6 })),
    ...TOTALES.map(() => ({ wch: 5 })),
    { wch: 10 },
  ]

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(libro, hoja, `Plan ${anio}`)
  XLSX.writeFile(libro, `plan-anual-${anio}.xlsx`)
}
