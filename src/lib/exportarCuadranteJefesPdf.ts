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
import {
  esFinDeSemana,
  pesoJornadaJefes,
  totalDiasTrabajadosJefes,
} from '@/lib/convenio'
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

/** Colores alineados con CLASE_TURNO_CELDA de la UI. */
const COLOR_TURNO: Record<Turno, { fondo: string; texto: string; borde: string }> =
  {
    M: { fondo: '#dbeafe', texto: '#1d4ed8', borde: '#93c5fd' },
    T: { fondo: '#ffedd5', texto: '#c2410c', borde: '#fdba74' },
    N: { fondo: '#ede9fe', texto: '#6d28d9', borde: '#c4b5fd' },
    MT: { fondo: '#ccfbf1', texto: '#115e59', borde: '#5eead4' },
    L: { fondo: '#ecfdf5', texto: '#065f46', borde: '#6ee7b7' },
    D: { fondo: '#ffffff', texto: '#64748b', borde: '#e2e8f0' },
    V: { fondo: '#d1fae5', texto: '#047857', borde: '#6ee7b7' },
  }

const LEYENDA_TURNOS: Array<{ turno: Turno; label: string }> = [
  { turno: 'M', label: 'Mañana' },
  { turno: 'T', label: 'Tarde' },
  { turno: 'N', label: 'Noche' },
  { turno: 'MT', label: 'M-T finde' },
  { turno: 'L', label: 'Libranza' },
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

function contarAsignacionesPuesto(
  puestoNombre: string,
  asignaciones: AsignacionesDiarias,
  agentes: FichaPolicia[],
  diasVisibles: number[],
  anio: number,
  mes: number,
  cuadrante: CuadranteMensual,
) {
  const ids = new Set(agentes.map((a) => a.id))
  let total = 0
  for (const dia of diasVisibles) {
    const fecha = isoFecha(anio, mes, dia)
    const porTurno = asignaciones[fecha]
    if (!porTurno) continue
    for (const [turno, porAgente] of Object.entries(porTurno)) {
      for (const [agenteId, puesto] of Object.entries(porAgente ?? {})) {
        if (!ids.has(agenteId)) continue
        if (puesto !== puestoNombre) continue
        const celda = (cuadrante[agenteId] ?? [])[dia - 1]
        if (celda !== turno) continue
        total += 1
      }
    }
  }
  return total
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
      const color = especial ? '#b91c1c' : '#0f172a'
      const fondo = especial ? '#fef3c7' : '#f1f5f9'
      return `<th class="dia" style="background:${fondo};color:${color};">
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
          const color = COLOR_TURNO[turno] ?? COLOR_TURNO.D
          const fondo =
            especial && (turno === 'D' || turno === 'V')
              ? '#fef3c7'
              : color.fondo
          return `<td class="celda" style="background:${fondo};color:${color.texto};border-color:${color.borde};">${escapeHtml(texto)}</td>`
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
        <td class="suma">${total}</td>
      </tr>`
    })
    .join('')

  const pieDias = diasVisibles
    .map((dia) => {
      const n = agentes.filter(
        (agente) =>
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
  const chipsTurno = LEYENDA_TURNOS.map(({ turno, label }) => {
    const c = COLOR_TURNO[turno]
    return `<span class="chip" style="background:${c.fondo};color:${c.texto};border-color:${c.borde};">
      <strong>${escapeHtml(etiquetaTurno(turno))}</strong> ${escapeHtml(label)}
    </span>`
  }).join('')

  const tarjetasPuestos =
    puestosLeyenda.length === 0
      ? '<p class="dash-vacio">No hay puestos de jefes y responsables configurados.</p>'
      : puestosLeyenda
          .map((puesto) => {
            const asignados = contarAsignacionesPuesto(
              puesto.nombre,
              asignacionesDiarias,
              agentes,
              diasVisibles,
              anio,
              mes,
              cuadrante,
            )
            return `<article class="puesto-card">
              <div class="puesto-abrev">${escapeHtml(puesto.abreviatura)}</div>
              <div class="puesto-meta">
                <p class="puesto-nombre">${escapeHtml(puesto.nombre)}</p>
                <p class="puesto-count"><strong>${asignados}</strong> asignación${asignados === 1 ? '' : 'es'}</p>
              </div>
            </article>`
          })
          .join('')

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
      color: #0f172a;
      margin: 0;
      padding: 6px 4px;
    }
    .cabecera {
      display: flex;
      align-items: baseline;
      justify-content: space-between;
      gap: 12px;
      margin-bottom: 10px;
      border-bottom: 2px solid #0f172a;
      padding-bottom: 6px;
    }
    h1 {
      font-size: 20px;
      font-weight: 800;
      letter-spacing: -0.02em;
      margin: 0;
    }
    .sub {
      font-size: 12px;
      color: #475569;
      margin: 0;
      text-align: right;
      line-height: 1.35;
    }
    table.matriz {
      border-collapse: collapse;
      width: 100%;
      table-layout: fixed;
    }
    table.matriz th,
    table.matriz td {
      border: 0.7pt solid #94a3b8;
      text-align: center;
      vertical-align: middle;
    }
    table.matriz thead th.dia {
      padding: 4px 1px;
      min-width: 26px;
    }
    table.matriz thead th.dia .num {
      display: block;
      font-size: 11px;
      font-weight: 800;
      line-height: 1.15;
    }
    table.matriz thead th.dia .dow {
      display: block;
      font-size: 9px;
      font-weight: 700;
      line-height: 1.1;
      opacity: 0.9;
    }
    table.matriz td.celda {
      font-size: 11px;
      font-weight: 800;
      line-height: 1.15;
      padding: 5px 1px;
      white-space: nowrap;
    }
    th.agente, td.agente {
      text-align: left !important;
      width: 168px;
      min-width: 168px;
      max-width: 168px;
      padding: 5px 7px !important;
      background: #f8fafc;
    }
    .agente .placa {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      display: block;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .agente .nombre {
      display: block;
      font-weight: 650;
      font-size: 10.5px;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      margin-top: 1px;
    }
    .agente .rol {
      display: block;
      font-weight: 600;
      font-size: 9px;
      color: #64748b;
      margin-top: 1px;
    }
    td.suma, th.suma {
      background: #e2e8f0;
      width: 34px;
      min-width: 34px;
      border-left: 1.5pt solid #334155 !important;
      font-size: 11px;
      font-weight: 800;
      padding: 4px 2px;
    }
    tfoot th.agente, tfoot td.suma {
      background: #cbd5e1;
      font-size: 11px;
    }

    .dashboard {
      margin-top: 12px;
      display: grid;
      grid-template-columns: 1.1fr 1.9fr;
      gap: 10px;
      page-break-inside: avoid;
    }
    .panel {
      border: 1.2pt solid #cbd5e1;
      border-radius: 8px;
      background: #f8fafc;
      padding: 8px 10px;
    }
    .panel h2 {
      margin: 0 0 8px;
      font-size: 11px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.06em;
      color: #334155;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 5px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      border: 1px solid;
      border-radius: 999px;
      padding: 3px 9px;
      font-size: 10px;
      font-weight: 600;
      white-space: nowrap;
    }
    .chip strong {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px;
    }
    .puestos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(150px, 1fr));
      gap: 6px;
    }
    .puesto-card {
      display: flex;
      align-items: center;
      gap: 8px;
      background: #ffffff;
      border: 1px solid #cbd5e1;
      border-radius: 8px;
      padding: 6px 8px;
      min-height: 44px;
    }
    .puesto-abrev {
      flex: 0 0 auto;
      min-width: 42px;
      height: 32px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 6px;
      background: #1e293b;
      color: #f8fafc;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 12px;
      font-weight: 800;
      letter-spacing: 0.02em;
    }
    .puesto-meta { min-width: 0; }
    .puesto-nombre {
      margin: 0;
      font-size: 11px;
      font-weight: 700;
      line-height: 1.2;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .puesto-count {
      margin: 2px 0 0;
      font-size: 10px;
      color: #64748b;
      font-weight: 500;
    }
    .puesto-count strong { color: #0f172a; font-weight: 800; }
    .dash-vacio {
      margin: 0;
      font-size: 11px;
      color: #64748b;
    }
    @media print {
      body { padding: 0; }
      .dashboard { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <header class="cabecera">
    <h1>${escapeHtml(titulo)}</h1>
    <p class="sub">
      Jefes de servicio y responsables<br />
      ${agentes.length} agente${agentes.length === 1 ? '' : 's'} · ${diasVisibles.length} días
    </p>
  </header>

  <table class="matriz">
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
        <th class="agente">Personal / día</th>
        ${pieDias}
        <td class="suma">${totalGeneral}</td>
      </tr>
    </tfoot>
  </table>

  <section class="dashboard">
    <div class="panel">
      <h2>Turnos</h2>
      <div class="chips">${chipsTurno}</div>
    </div>
    <div class="panel">
      <h2>Puestos · ${puestosLeyenda.length}</h2>
      <div class="puestos-grid">${tarjetasPuestos}</div>
    </div>
  </section>
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
