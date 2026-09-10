import {
  abreviaturaPuesto,
  esTurnoAsignable,
  esTurnoPermiso,
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
import {
  abreviaturaDesdePermisos,
  type PermisoConfig,
} from '@/lib/permisos'
import { getTiposPermiso } from '@/lib/permisosStore'
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

/**
 * Colores de celda alineados con CLASE_TURNO_CELDA / Tailwind de la UI:
 * blue-100/700, orange-100/700, violet-100/700, teal-100/800, emerald, white/slate.
 */
const COLOR_TURNO: Record<Turno, { fondo: string; texto: string }> = {
  M: { fondo: '#dbeafe', texto: '#1d4ed8' }, // bg-blue-100 text-blue-700
  T: { fondo: '#ffedd5', texto: '#c2410c' }, // bg-orange-100 text-orange-700
  N: { fondo: '#ede9fe', texto: '#6d28d9' }, // bg-violet-100 text-violet-700
  MT: { fondo: '#ccfbf1', texto: '#115e59' }, // bg-teal-100 text-teal-800
  L: { fondo: '#fff1f2', texto: '#9f1239' }, // legacy
  P: { fondo: '#fff1f2', texto: '#9f1239' }, // bg-rose-50 text-rose-800
  D: { fondo: '#ffffff', texto: '#64748b' }, // bg-white text-slate-500
  V: { fondo: '#d1fae5', texto: '#047857' }, // bg-emerald-100 text-emerald-700
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

function textoCelda(
  turno: Turno,
  fecha: string,
  agenteId: string,
  asignaciones: AsignacionesDiarias,
  puestos: PuestoConfig[],
  permisos: PermisoConfig[],
) {
  if (!esTurnoAsignable(turno)) return escapeHtml(etiquetaTurno(turno))
  if (esTurnoPermiso(turno)) {
    const nombre = asignaciones[fecha]?.[turno]?.[agenteId]
    const abrev = nombre
      ? abreviaturaDesdePermisos(permisos, nombre)
      : null
    if (!abrev) return escapeHtml('P')
    return `<span class="turno">P</span><span class="abrev">${escapeHtml(abrev)}</span>`
  }
  const abrev = abreviaturaPuesto(
    asignaciones,
    fecha,
    agenteId,
    turno,
    puestos,
  )
  if (!abrev) return escapeHtml(etiquetaTurno(turno))
  return `<span class="turno">${escapeHtml(etiquetaTurno(turno))}</span><span class="abrev">${escapeHtml(abrev)}</span>`
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
  permisos?: PermisoConfig[]
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
  const permisos = opciones.permisos ?? getTiposPermiso()

  const titulo = `Cuadrante jefes de servicio · ${MESES[mes - 1]} ${anio}`

  const cabecerasDias = diasVisibles
    .map((dia) => {
      const weekday = new Date(anio, mes - 1, dia).getDay()
      const especial =
        esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
      const fondo = especial ? '#fffbeb' : '#ffffff' // amber-50 / white
      const color = especial ? '#dc2626' : '#0f172a' // red-600 / ink
      const colorDow = especial ? '#dc2626' : '#64748b' // red-600 / slate-500
      return `<th class="dia" style="background:${fondo};">
        <span class="num" style="color:${color};">${dia}</span>
        <span class="dow" style="color:${colorDow};">${DIA_SEMANA[weekday]}</span>
      </th>`
    })
    .join('')

  const filas = agentes
    .map((agente) => {
      const nombre = `${agente.nombre} ${agente.apellidos}`
      const fila = cuadrante[agente.id] ?? []
      const celdas = diasVisibles
        .map((dia) => {
          const turno = (fila[dia - 1] ?? 'D') as Turno
          const fecha = isoFecha(anio, mes, dia)
          const texto = textoCelda(
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
          // Misma lógica que la UI: finde + D/V → amber-50
          const fondo =
            especial && (turno === 'D' || turno === 'V')
              ? '#fffbeb'
              : color.fondo
          return `<td class="celda" style="background:${fondo};color:${color.texto};">${texto}</td>`
        })
        .join('')
      const total = totalDiasTrabajadosJefes(fila, diasVisibles)
      return `<tr>
        <th class="agente">
          <span class="placa">${escapeHtml(agente.numeroPlaca)}</span>
          <span class="nombre">${escapeHtml(nombre)}</span>
        </th>
        ${celdas}
        <td class="suma">${total}d</td>
      </tr>`
    })
    .join('')

  const pieDias = diasVisibles
    .map((dia) => {
      const n = agentes.filter(
        (agente) =>
          pesoJornadaJefes((cuadrante[agente.id] ?? [])[dia - 1]) > 0,
      ).length
      const especial =
        esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
      const fondo = especial ? '#fef3c7' : '#f1f5f9' // amber-100 / slate-100
      return `<td class="pie" style="background:${fondo};">${n}</td>`
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
    return `<span class="chip" style="background:${c.fondo};color:${c.texto};">
      <strong>${escapeHtml(etiquetaTurno(turno))}</strong>${escapeHtml(label)}
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

  const tarjetasPermisos =
    permisos.length === 0
      ? '<p class="dash-vacio">No hay tipos de permiso configurados.</p>'
      : permisos
          .map((permiso) => {
            const asignados = contarAsignacionesPuesto(
              permiso.nombre,
              asignacionesDiarias,
              agentes,
              diasVisibles,
              anio,
              mes,
              cuadrante,
            )
            return `<article class="puesto-card">
              <div class="puesto-abrev" style="background:#fff1f2;color:#9f1239;">${escapeHtml(permiso.abreviatura)}</div>
              <div class="puesto-meta">
                <p class="puesto-nombre">${escapeHtml(permiso.nombre)}</p>
                <p class="puesto-count"><strong>${asignados}</strong> día${asignados === 1 ? '' : 's'}</p>
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
    @page { size: A4 landscape; margin: 7mm; }
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
      margin: 0 0 6px;
      font-size: 14px;
      font-weight: 800;
      letter-spacing: -0.01em;
    }
    .sub {
      margin: 0 0 8px;
      font-size: 10px;
      color: #64748b;
    }

    /* Misma densidad visual que la tabla de pantalla */
    table.matriz {
      width: 100%;
      border-collapse: collapse;
      table-layout: fixed;
      font-size: 10px;
      line-height: 1.05;
    }
    table.matriz th,
    table.matriz td {
      border: 0.5pt solid #e2e8f0; /* border-line */
      text-align: center;
      vertical-align: middle;
      padding: 0;
    }

    th.agente-h {
      width: 150px;
      min-width: 150px;
      text-align: left !important;
      padding: 3px 5px !important;
      background: #ffffff;
      font-size: 10px;
      font-weight: 800;
    }
    th.agente {
      width: 150px;
      min-width: 150px;
      text-align: left !important;
      padding: 2px 5px !important;
      background: #ffffff;
      font-weight: 600;
      white-space: nowrap;
      overflow: hidden;
    }
    .agente .placa {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-weight: 800;
      font-size: 10px;
      margin-right: 5px;
    }
    .agente .nombre {
      font-weight: 550;
      font-size: 9.5px;
    }

    th.dia {
      padding: 2px 0 !important;
      min-width: 0;
    }
    th.dia .num {
      display: block;
      font-size: 10px;
      font-weight: 800;
      line-height: 1.1;
    }
    th.dia .dow {
      display: block;
      font-size: 8px;
      font-weight: 700;
      line-height: 1.05;
    }

    td.celda {
      font-size: 9.5px;
      font-weight: 800;
      padding: 2px 0 !important;
      white-space: nowrap;
      overflow: hidden;
      line-height: 1.05;
    }
    td.celda .turno {
      display: block;
      font-size: 8.5px;
      font-weight: 800;
      line-height: 1.05;
    }
    td.celda .abrev {
      display: block;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 8.5px;
      font-weight: 800;
      line-height: 1.05;
      letter-spacing: -0.02em;
    }

    th.suma-h, td.suma {
      width: 32px;
      min-width: 32px;
      border-left: 1.5pt solid #475569 !important;
      background: #f1f5f9; /* slate-100 */
      font-size: 10px;
      font-weight: 800;
      padding: 2px 1px !important;
    }

    tfoot th.pie-l {
      text-align: left !important;
      padding: 3px 5px !important;
      background: #f1f5f9;
      font-weight: 800;
      font-size: 10px;
      border-top: 1.5pt solid #94a3b8 !important;
    }
    tfoot td.pie {
      font-size: 9.5px;
      font-weight: 700;
      padding: 3px 0 !important;
      border-top: 1.5pt solid #94a3b8 !important;
    }
    tfoot td.suma {
      border-top: 1.5pt solid #94a3b8 !important;
      background: #e2e8f0;
    }

    /* Dashboard inferior: leyenda + puestos (como pediste) */
    .dashboard {
      margin-top: 8px;
      display: grid;
      grid-template-columns: 1fr 1.6fr;
      gap: 8px;
      page-break-inside: avoid;
    }
    .panel {
      border: 0.8pt solid #e2e8f0;
      border-radius: 8px;
      background: #ffffff;
      padding: 6px 8px;
    }
    .panel h2 {
      margin: 0 0 6px;
      font-size: 9px;
      font-weight: 800;
      text-transform: uppercase;
      letter-spacing: 0.05em;
      color: #64748b;
    }
    .chips {
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      gap: 3px;
      border-radius: 6px;
      padding: 2px 7px;
      font-size: 9px;
      font-weight: 600;
      white-space: nowrap;
    }
    .chip strong {
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-weight: 800;
      margin-right: 2px;
    }
    .puestos-grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(135px, 1fr));
      gap: 5px;
    }
    .puesto-card {
      display: flex;
      align-items: center;
      gap: 6px;
      border: 0.7pt solid #e2e8f0;
      border-radius: 7px;
      background: #f8fafc;
      padding: 4px 6px;
      min-height: 34px;
    }
    .puesto-abrev {
      flex: 0 0 auto;
      min-width: 34px;
      height: 24px;
      display: flex;
      align-items: center;
      justify-content: center;
      border-radius: 5px;
      background: #0f172a;
      color: #f8fafc;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 10px;
      font-weight: 800;
    }
    .puesto-meta { min-width: 0; }
    .puesto-nombre {
      margin: 0;
      font-size: 9.5px;
      font-weight: 700;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .puesto-count {
      margin: 1px 0 0;
      font-size: 8.5px;
      color: #64748b;
    }
    .puesto-count strong { color: #0f172a; font-weight: 800; }
    .dash-vacio { margin: 0; font-size: 10px; color: #64748b; }

    @media print {
      body { padding: 0; }
      .dashboard { break-inside: avoid; }
    }
  </style>
</head>
<body>
  <h1 class="titulo">${escapeHtml(titulo)}</h1>
  <p class="sub">${agentes.length} agente${agentes.length === 1 ? '' : 's'} · ${diasVisibles.length} días · jefes de servicio y responsables</p>

  <table class="matriz">
    <thead>
      <tr>
        <th class="agente-h">Agente</th>
        ${cabecerasDias}
        <th class="suma-h">Σ</th>
      </tr>
    </thead>
    <tbody>${filas}</tbody>
    <tfoot>
      <tr>
        <th class="pie-l">Σ</th>
        ${pieDias}
        <td class="suma">${totalGeneral}d</td>
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
    <div class="panel">
      <h2>Permisos · ${permisos.length}</h2>
      <div class="puestos-grid">${tarjetasPermisos}</div>
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
