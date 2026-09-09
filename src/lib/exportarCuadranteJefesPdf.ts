import {
  abreviaturaPuesto,
  esTurnoAsignable,
  etiquetaTurno,
} from '@/lib/asignacionPuestos'
import {
  puestosDeAmbito,
  type AsignacionesDiarias,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import { esFinDeSemana, pesoJornadaJefes, totalDiasTrabajadosJefes } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
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

const DIA_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const

const COLOR_TURNO: Record<Turno, { fondo: string; texto: string }> = {
  M: { fondo: '#dbeafe', texto: '#1d4ed8' },
  T: { fondo: '#ffedd5', texto: '#c2410c' },
  N: { fondo: '#ede9fe', texto: '#6d28d9' },
  MT: { fondo: '#ccfbf1', texto: '#115e59' },
  L: { fondo: '#ecfdf5', texto: '#065f46' },
  D: { fondo: '#ffffff', texto: '#64748b' },
  V: { fondo: '#d1fae5', texto: '#047857' },
}

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

function textoCelda(
  turno: Turno,
  fecha: string,
  agenteId: string,
  asignaciones: AsignacionesDiarias,
  puestos: PuestoConfig[],
) {
  if (!esTurnoAsignable(turno)) return etiquetaTurno(turno)
  const abrev = abreviaturaPuesto(
    asignaciones,
    fecha,
    agenteId,
    turno,
    puestos,
  )
  return abrev ? `${etiquetaTurno(turno)}·${abrev}` : etiquetaTurno(turno)
}

export type ExportarCuadranteJefesPdfOpciones = {
  anio: number
  mes: number
  agentes: FichaPolicia[]
  cuadrante: CuadranteMensual
  asignacionesDiarias: AsignacionesDiarias
  puestos: PuestoConfig[]
  diasVisibles: number[]
}

export function exportarCuadranteJefesPdf(
  opciones: ExportarCuadranteJefesPdfOpciones,
) {
  const {
    anio,
    mes,
    agentes,
    cuadrante,
    asignacionesDiarias,
    puestos,
    diasVisibles,
  } = opciones

  const titulo = `Cuadrante jefes de servicio · ${MESES[mes - 1]} ${anio}`
  const cabecerasDias = diasVisibles
    .map((dia) => {
      const weekday = new Date(anio, mes - 1, dia).getDay()
      const especial =
        esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
      const color = especial ? '#dc2626' : '#334155'
      const fondo = especial ? '#fffbeb' : '#f8fafc'
      return `<th style="background:${fondo};color:${color};min-width:22px;">
        <span class="num">${dia}</span>
        <span class="dow">${DIA_SEMANA[weekday]}</span>
      </th>`
    })
    .join('')

  const filas = agentes
    .map((agente) => {
      const nombre = `${agente.nombre} ${agente.apellidos}`
      const rol = ROL_LABEL[agente.rolBase]
      const celdas = diasVisibles
        .map((dia) => {
          const turno = (cuadrante[agente.id]?.[dia - 1] ?? 'D') as Turno
          const fecha = isoFecha(anio, mes, dia)
          const texto = textoCelda(
            turno,
            fecha,
            agente.id,
            asignacionesDiarias,
            puestos,
          )
          const especial =
            esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
          const color = COLOR_TURNO[turno]
          const fondo =
            especial && (turno === 'D' || turno === 'V')
              ? '#fffbeb'
              : color.fondo
          return `<td style="background:${fondo};color:${color.texto};">${escapeHtml(texto)}</td>`
        })
        .join('')
      const total = totalDiasTrabajadosJefes(
        cuadrante[agente.id] ?? [],
        diasVisibles,
      )
      return `<tr>
        <th class="agente">
          <span class="placa">${escapeHtml(agente.numeroPlaca)}</span>
          <span class="nombre">${escapeHtml(nombre)}</span>
          <span class="rol">${escapeHtml(rol)}</span>
        </th>
        ${celdas}
        <td class="suma">${total}d</td>
      </tr>`
    })
    .join('')

  const pieDias = diasVisibles
    .map((dia) => {
      const n = agentes.filter((agente) =>
        pesoJornadaJefes((cuadrante[agente.id] ?? [])[dia - 1]) > 0,
      ).length
      return `<td class="suma">${n}</td>`
    })
    .join('')
  const totalGeneral = agentes.reduce(
    (n, agente) =>
      n + totalDiasTrabajadosJefes(cuadrante[agente.id] ?? [], diasVisibles),
    0,
  )

  const puestosLeyenda = puestosDeAmbito(puestos, 'JEFE_SERVICIO')
  const nomenclatura =
    puestosLeyenda.length === 0
      ? '<p class="nomenclatura vacia">No hay puestos de jefes y responsables configurados.</p>'
      : `<div class="nomenclatura">
        <p class="nomenclatura-titulo">Puestos</p>
        <ul>
          ${puestosLeyenda
            .map(
              (puesto) =>
                `<li><span class="abrev">${escapeHtml(puesto.abreviatura)}</span><span class="sep">·</span><span class="nom">${escapeHtml(puesto.nombre)}</span></li>`,
            )
            .join('')}
        </ul>
      </div>`

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 10mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 8px;
    }
    h1 { font-size: 16px; margin: 0 0 4px; }
    .sub { font-size: 11px; color: #64748b; margin: 0 0 10px; }
    table { border-collapse: collapse; width: 100%; table-layout: fixed; }
    th, td {
      border: 0.4pt solid #cbd5e1;
      font-size: 8px;
      line-height: 1.1;
      text-align: center;
      padding: 2px 1px;
      font-weight: 700;
    }
    th.agente, td.agente {
      text-align: left;
      width: 140px;
      min-width: 140px;
      padding: 3px 5px;
      background: #f8fafc;
    }
    .agente .placa { font-family: ui-monospace, Menlo, monospace; display: block; }
    .agente .nombre { display: block; font-weight: 600; font-size: 8px; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; }
    .agente .rol { display: block; font-weight: 500; font-size: 7px; color: #64748b; }
    thead th .num { display: block; font-size: 8px; }
    thead th .dow { display: block; font-size: 7px; font-weight: 600; }
    td.suma, th.suma {
      background: #f1f5f9;
      width: 28px;
      min-width: 28px;
      border-left: 1pt solid #475569;
    }
    tfoot td, tfoot th { background: #f1f5f9; }
    .leyenda { margin-top: 8px; font-size: 9px; color: #475569; }
    .nomenclatura { margin-top: 8px; }
    .nomenclatura.vacia { font-size: 9px; color: #64748b; }
    .nomenclatura-titulo {
      font-size: 9px;
      font-weight: 700;
      text-transform: uppercase;
      letter-spacing: 0.04em;
      color: #475569;
      margin: 0 0 4px;
    }
    .nomenclatura ul {
      display: flex;
      flex-wrap: wrap;
      gap: 4px 14px;
      margin: 0;
      padding: 0;
      list-style: none;
    }
    .nomenclatura li { font-size: 9px; color: #0f172a; }
    .nomenclatura .abrev {
      font-family: ui-monospace, Menlo, monospace;
      font-weight: 700;
    }
    .nomenclatura .sep { margin: 0 4px; color: #94a3b8; }
    .nomenclatura .nom { font-weight: 500; }
    @media print {
      body { padding: 0; }
    }
  </style>
</head>
<body>
  <h1>${escapeHtml(titulo)}</h1>
  <p class="sub">Jefes de servicio y responsables · ${agentes.length} agente${agentes.length === 1 ? '' : 's'}</p>
  <table>
    <thead>
      <tr>
        <th class="agente">Agente</th>
        ${cabecerasDias}
        <th class="suma">Σ</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr>
        <th class="agente">Σ</th>
        ${pieDias}
        <td class="suma">${totalGeneral}d</td>
      </tr>
    </tfoot>
  </table>
  <p class="leyenda">M mañana · T tarde · N noche · M-T mañana-tarde (finde, vale 2 días) · L libranza · D descanso · V vacaciones · Σ días trabajados</p>
  ${nomenclatura}
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
