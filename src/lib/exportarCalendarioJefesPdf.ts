import {
  abreviaturaPuesto,
  esTurnoAsignable,
  esTurnoPermiso,
  etiquetaTurno,
} from '@/lib/asignacionPuestos'
import type { AsignacionesDiarias, PuestoConfig } from '@/lib/calendarioPuestos'
import { diasDelMes, esFinDeSemana, totalDiasTrabajadosJefes } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import {
  abreviaturaDesdePermisos,
  type PermisoConfig,
} from '@/lib/permisos'
import { getTiposPermiso } from '@/lib/permisosStore'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import type { FichaPolicia, Turno } from '@/types'

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

const COLOR_TURNO: Record<Turno, { fondo: string; texto: string }> = {
  M: { fondo: '#dbeafe', texto: '#1d4ed8' },
  T: { fondo: '#ffedd5', texto: '#c2410c' },
  N: { fondo: '#ede9fe', texto: '#6d28d9' },
  MT: { fondo: '#ccfbf1', texto: '#115e59' },
  L: { fondo: '#fff1f2', texto: '#9f1239' },
  P: { fondo: '#fff1f2', texto: '#9f1239' },
  D: { fondo: '#ffffff', texto: '#64748b' },
  V: { fondo: '#d1fae5', texto: '#047857' },
}

const LEYENDA_TURNOS: Array<{ turno: Turno; label: string }> = [
  { turno: 'M', label: 'Mañana' },
  { turno: 'T', label: 'Tarde' },
  { turno: 'N', label: 'Noche' },
  { turno: 'MT', label: 'M-T finde' },
  { turno: 'P', label: 'Permiso' },
  { turno: 'D', label: 'Descanso' },
  { turno: 'V', label: 'Vacaciones' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function escapeHtml(valor: string) {
  return valor
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
}

export function celdasMesCalendario(anio: number, mes: number) {
  const nDias = diasDelMes(anio, mes)
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7
  const celdas: (number | null)[] = Array.from({ length: offset }, () => null)
  for (let dia = 1; dia <= nDias; dia++) celdas.push(dia)
  while (celdas.length % 7 !== 0) celdas.push(null)
  return celdas
}

export function detalleDiaCalendarioJefe(
  turno: Turno,
  fecha: string,
  agenteId: string,
  asignaciones: AsignacionesDiarias,
  puestos: PuestoConfig[],
  permisos: PermisoConfig[],
) {
  if (!esTurnoAsignable(turno)) {
    return {
      etiqueta: etiquetaTurno(turno),
      abrev: null as string | null,
    }
  }
  if (esTurnoPermiso(turno)) {
    const nombre = asignaciones[fecha]?.[turno]?.[agenteId]
    return {
      etiqueta: 'P',
      abrev: nombre ? abreviaturaDesdePermisos(permisos, nombre) : null,
    }
  }
  return {
    etiqueta: etiquetaTurno(turno),
    abrev: abreviaturaPuesto(
      asignaciones,
      fecha,
      agenteId,
      turno,
      puestos,
    ),
  }
}

export type ExportarCalendarioJefesPdfOpciones = {
  anio: number
  mes: number
  agente: FichaPolicia
  cuadrante: CuadranteMensual
  asignacionesDiarias: AsignacionesDiarias
  puestos: PuestoConfig[]
  permisos?: PermisoConfig[]
}

export function exportarCalendarioJefesPdf(
  opciones: ExportarCalendarioJefesPdfOpciones,
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
  const fila = cuadrante[agente.id] ?? []
  const nDias = diasDelMes(anio, mes)
  const dias = Array.from({ length: nDias }, (_, i) => i + 1)
  const total = totalDiasTrabajadosJefes(fila, dias)
  const celdas = celdasMesCalendario(anio, mes)

  const titulo = `Calendario · ${agente.numeroPlaca} · ${MESES[mes - 1]} ${anio}`
  const nombre = `${agente.nombre} ${agente.apellidos}`.trim()
  const rol = ROL_LABEL[agente.rolBase]

  const semanasHtml: string[] = []
  for (let i = 0; i < celdas.length; i += 7) {
    const semana = celdas.slice(i, i + 7)
    const tds = semana
      .map((dia) => {
        if (dia == null) return `<td class="hueco"></td>`
        const turno = (fila[dia - 1] ?? 'D') as Turno
        const fecha = isoFecha(anio, mes, dia)
        const { etiqueta, abrev } = detalleDiaCalendarioJefe(
          turno,
          fecha,
          agente.id,
          asignacionesDiarias,
          puestos,
          permisos,
        )
        const especial =
          esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
        const color = COLOR_TURNO[turno] ?? COLOR_TURNO.D
        const fondo =
          especial && (turno === 'D' || turno === 'V')
            ? '#fffbeb'
            : color.fondo
        const numColor = especial ? '#dc2626' : '#0f172a'
        return `<td class="dia" style="background:${fondo};color:${color.texto};">
          <span class="num" style="color:${numColor};">${dia}</span>
          <span class="turno">${escapeHtml(etiqueta)}</span>
          ${abrev ? `<span class="abrev">${escapeHtml(abrev)}</span>` : ''}
        </td>`
      })
      .join('')
    semanasHtml.push(`<tr>${tds}</tr>`)
  }

  const chipsTurno = LEYENDA_TURNOS.map(({ turno, label }) => {
    const c = COLOR_TURNO[turno]
    return `<span class="chip" style="background:${c.fondo};color:${c.texto};">
      <strong>${escapeHtml(etiquetaTurno(turno))}</strong>${escapeHtml(label)}
    </span>`
  }).join('')

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    @page { size: A4 portrait; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      padding: 0;
      color: #0f172a;
      font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .titulo {
      margin: 0 0 4px;
      font-size: 16px;
      font-weight: 800;
    }
    .sub {
      margin: 0 0 12px;
      font-size: 11px;
      color: #64748b;
    }
    table.cal {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.cal th,
    table.cal td {
      border: 0.6pt solid #cbd5e1;
      vertical-align: top;
    }
    th.dow {
      padding: 6px 0;
      font-size: 11px;
      font-weight: 800;
      color: #64748b;
      background: #f8fafc;
      text-align: center;
    }
    td.hueco {
      background: #f8fafc;
      height: 88px;
    }
    td.dia {
      height: 88px;
      padding: 5px 6px;
      text-align: left;
    }
    td.dia .num {
      display: block;
      font-size: 12px;
      font-weight: 800;
      line-height: 1.1;
      margin-bottom: 6px;
    }
    td.dia .turno {
      display: block;
      font-size: 18px;
      font-weight: 800;
      line-height: 1.05;
    }
    td.dia .abrev {
      display: block;
      margin-top: 3px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 13px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .leyenda {
      margin-top: 14px;
      display: flex;
      flex-wrap: wrap;
      gap: 6px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      padding: 3px 8px;
      border-radius: 999px;
      font-size: 10px;
      font-weight: 600;
    }
    .chip strong {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-weight: 800;
    }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1 class="titulo">${escapeHtml(titulo)}</h1>
  <p class="sub">${escapeHtml(nombre)} · ${escapeHtml(rol)} · ${total}d trabajados (M-T = 2)</p>
  <table class="cal">
    <thead>
      <tr>${DIAS_SEMANA.map((d) => `<th class="dow">${d}</th>`).join('')}</tr>
    </thead>
    <tbody>
      ${semanasHtml.join('')}
    </tbody>
  </table>
  <div class="leyenda">${chipsTurno}</div>
</body>
</html>`

  const ventana = window.open('', '_blank')
  if (!ventana) {
    throw new Error(
      'El navegador bloqueó la ventana de impresión. Permite ventanas emergentes para exportar el PDF.',
    )
  }
  ventana.opener = null
  ventana.document.open()
  ventana.document.write(html)
  ventana.document.close()
  ventana.focus()
  const imprimir = () => {
    ventana.print()
    ventana.addEventListener('afterprint', () => ventana.close())
  }
  if (ventana.document.readyState === 'complete') {
    window.setTimeout(imprimir, 50)
  } else {
    ventana.addEventListener('load', imprimir, { once: true })
  }
}
