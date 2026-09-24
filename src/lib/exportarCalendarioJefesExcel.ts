import * as XLSX from 'xlsx'
import { descargarBinario, xlsxConPaginaHorizontal } from '@/lib/xlsxPaginaHorizontal'
import type { AsignacionesDiarias, PuestoConfig } from '@/lib/calendarioPuestos'
import { diasDelMes, totalDiasTrabajadosJefes } from '@/lib/convenio'
import { nombresEventosFecha } from '@/lib/eventosStore'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import type { PermisoConfig } from '@/lib/permisos'
import { getTiposPermiso } from '@/lib/permisosStore'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import type { EventoOperativo, FichaPolicia, Turno } from '@/types'
import {
  celdasMesCalendario,
  detalleDiaCalendarioJefe,
} from '@/lib/exportarCalendarioJefesPdf'

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

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

export type ExportarCalendarioJefesExcelOpciones = {
  anio: number
  mes: number
  agente: FichaPolicia
  cuadrante: CuadranteMensual
  asignacionesDiarias: AsignacionesDiarias
  puestos: PuestoConfig[]
  permisos?: PermisoConfig[]
  eventos?: EventoOperativo[]
}

export function construirLibroCalendarioJefes(
  opciones: ExportarCalendarioJefesExcelOpciones,
) {
  const {
    anio,
    mes,
    agente,
    cuadrante,
    asignacionesDiarias,
    puestos,
  } = opciones
  const permisos = opciones.permisos ?? getTiposPermiso()
  const eventos = opciones.eventos ?? []
  const fila = cuadrante[agente.id] ?? []
  const nDias = diasDelMes(anio, mes)
  const dias = Array.from({ length: nDias }, (_, i) => i + 1)
  const total = totalDiasTrabajadosJefes(fila, dias)
  const celdas = celdasMesCalendario(anio, mes)
  const nombre = `${agente.nombre} ${agente.apellidos}`.trim()
  const rol = ROL_LABEL[agente.rolBase]
  const nombreMes = MESES[mes - 1] ?? `Mes ${mes}`

  const filas: (string | number)[][] = [
    [`Calendario · ${agente.numeroPlaca} · ${nombreMes} ${anio}`],
    [`${nombre} · ${rol} · ${total}d trabajados (M-T = 2)`],
    [],
    [...DIAS_SEMANA],
  ]

  for (let i = 0; i < celdas.length; i += 7) {
    const semana = celdas.slice(i, i + 7)
    filas.push(
      semana.map((dia) => {
        if (dia == null) return ''
        const turno = (fila[dia - 1] ?? 'D') as Turno
        const fecha = isoFecha(anio, mes, dia)
        const { etiqueta, detalle } = detalleDiaCalendarioJefe(
          turno,
          fecha,
          agente.id,
          asignacionesDiarias,
          puestos,
          permisos,
        )
        const eventosDia = nombresEventosFecha(eventos, fecha)
        return [
          `${dia}  ${etiqueta}`,
          detalle,
          ...eventosDia,
        ]
          .filter(Boolean)
          .join('\n')
      }),
    )
  }

  const hoja = XLSX.utils.aoa_to_sheet(filas)
  hoja['!cols'] = DIAS_SEMANA.map(() => ({ wch: 16 }))
  const nSemanas = Math.ceil(celdas.length / 7)
  hoja['!rows'] = [
    { hpt: 22 },
    { hpt: 18 },
    { hpt: 10 },
    { hpt: 18 },
    ...Array.from({ length: nSemanas }, () => ({ hpt: 64 })),
  ]
  hoja['!pageSetup'] = {
    paper: 9,
    orientation: 'landscape',
    fitToWidth: 1,
    fitToHeight: 1,
    scale: 100,
  }
  hoja['!printHeader'] = undefined
  hoja['!margins'] = {
    left: 0.3,
    right: 0.3,
    top: 0.4,
    bottom: 0.4,
    header: 0.2,
    footer: 0.2,
  }

  const libro = XLSX.utils.book_new()
  XLSX.utils.book_append_sheet(
    libro,
    hoja,
    `${nombreMes.slice(0, 3)} ${anio}`.slice(0, 31),
  )
  return { libro, nombreArchivo: `calendario-${agente.numeroPlaca}-${anio}-${pad(mes)}.xlsx` }
}

export function exportarCalendarioJefesExcel(
  opciones: ExportarCalendarioJefesExcelOpciones,
) {
  const { libro, nombreArchivo } = construirLibroCalendarioJefes(opciones)
  const written = XLSX.write(libro, {
    bookType: 'xlsx',
    type: 'array',
    compression: false,
  })
  const crudo = written instanceof Uint8Array ? written : new Uint8Array(written)
  descargarBinario(nombreArchivo, xlsxConPaginaHorizontal(crudo))
}
