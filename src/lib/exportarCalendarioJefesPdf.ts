import {
  esTurnoAsignable,
  esTurnoPermiso,
  etiquetaTurno,
} from '@/lib/asignacionPuestos'
import type { AsignacionesDiarias, PuestoConfig } from '@/lib/calendarioPuestos'
import { ETIQUETA_EVENTO } from '@/components/ChipEventoCalendario'
import { diasDelMes, esDiaTrabajado, esFinDeSemana, totalDiasTrabajadosJefes } from '@/lib/convenio'
import { eventosEnFecha } from '@/lib/eventosStore'
import { esFestivo } from '@/lib/festivos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import type { PermisoConfig } from '@/lib/permisos'
import { getTiposPermiso } from '@/lib/permisosStore'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import type { EventoOperativo, FichaPolicia, Turno } from '@/types'

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

/** Fondos, pastillas y filete izquierdo, alineados con la pantalla. */
const ESTILO_TURNO: Record<
  Turno,
  { fondo: string; pill: string; pillTexto: string; borde: string }
> = {
  M: { fondo: '#eff6ff', pill: '#dbeafe', pillTexto: '#1e40af', borde: '#3b82f6' },
  T: { fondo: '#fff7ed', pill: '#ffedd5', pillTexto: '#9a3412', borde: '#f97316' },
  N: { fondo: '#f5f3ff', pill: '#ede9fe', pillTexto: '#5b21b6', borde: '#8b5cf6' },
  MT: { fondo: '#f0fdfa', pill: '#ccfbf1', pillTexto: '#115e59', borde: '#14b8a6' },
  L: { fondo: '#fff1f2', pill: '#ffe4e6', pillTexto: '#9f1239', borde: '#fb7185' },
  P: { fondo: '#fff1f2', pill: '#ffe4e6', pillTexto: '#9f1239', borde: '#f43f5e' },
  D: { fondo: '#f1f5f9', pill: '#e2e8f0', pillTexto: '#475569', borde: '#cbd5e1' },
  V: { fondo: '#ecfdf5', pill: '#d1fae5', pillTexto: '#065f46', borde: '#10b981' },
}

const COLOR_EVENTO: Record<string, { fondo: string; texto: string }> = {
  FESTIVO: { fondo: '#fee2e2', texto: '#7f1d1d' },
  CRUCERO: { fondo: '#dbeafe', texto: '#1e3a8a' },
  CONCIERTO: { fondo: '#fef9c3', texto: '#713f12' },
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
  _puestos: PuestoConfig[],
  _permisos: PermisoConfig[],
) {
  if (!esTurnoAsignable(turno)) {
    return {
      etiqueta: etiquetaTurno(turno),
      detalle: null as string | null,
    }
  }
  const nombre = asignaciones[fecha]?.[turno]?.[agenteId] ?? null
  return {
    etiqueta: esTurnoPermiso(turno) ? 'P' : etiquetaTurno(turno),
    detalle: nombre,
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
  eventos?: EventoOperativo[]
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

  const titulo = `Calendario jefes · ${agente.numeroPlaca} · ${MESES[mes - 1]} ${anio}`
  const nombre = `${agente.nombre} ${agente.apellidos}`.trim()
  const rol = ROL_LABEL[agente.rolBase]
  let noches = 0
  let festivosTrabajados = 0
  let permisosMes = 0
  for (let dia = 1; dia <= nDias; dia++) {
    const turno = (fila[dia - 1] ?? 'D') as Turno
    if (turno === 'N') noches += 1
    if (turno === 'P' || turno === 'L') permisosMes += 1
    if (esDiaTrabajado(turno) && esFestivo(anio, mes, dia)) {
      festivosTrabajados += 1
    }
  }

  const semanas = celdas.length / 7
  const semanasHtml: string[] = []
  for (let i = 0; i < celdas.length; i += 7) {
    const semana = celdas.slice(i, i + 7)
    const tds = semana
      .map((dia) => {
        if (dia == null) return `<td class="hueco"></td>`
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
        const eventosDia = eventosEnFecha(opciones.eventos ?? [], fecha)
        const especial =
          esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
        const estilo = ESTILO_TURNO[turno] ?? ESTILO_TURNO.D
        const fondo = especial && turno === 'V' ? '#fffbeb' : estilo.fondo
        const puntos =
          turno === 'D'
            ? 'background-image:radial-gradient(circle,#94a3b8 0.55px,transparent 0.7px);background-size:6px 6px;'
            : ''
        const numColor = especial ? '#dc2626' : '#1e293b'
        const eventosHtml = eventosDia
          .map((evento) => {
            const etiquetaEvento = ETIQUETA_EVENTO[evento.tipo]
            const color = COLOR_EVENTO[evento.tipo] ?? {
              fondo: '#f1f5f9',
              texto: '#334155',
            }
            const texto =
              evento.descripcion || etiquetaEvento?.texto || 'Evento'
            const emoji = etiquetaEvento ? `${etiquetaEvento.emoji} ` : ''
            return `<span class="ev" style="background:${color.fondo};color:${color.texto};">${emoji}${escapeHtml(texto)}</span>`
          })
          .join('')
        const pie = detalle
          ? `<span class="puesto">${escapeHtml(detalle)}</span>`
          : esDiaTrabajado(turno)
            ? `<span class="muted">Sin puesto</span>`
            : turno === 'D'
              ? `<span class="muted">Descanso</span>`
              : turno === 'V'
                ? `<span class="vacaciones">Vacaciones</span>`
                : ''
        return `<td class="dia" style="background-color:${fondo};${puntos}border-left:3px solid ${estilo.borde};">
          <div class="cab">
            <span class="num" style="color:${numColor};">${dia}</span>
            ${especial ? '<span class="punto"></span>' : ''}
          </div>
          <div class="cuerpo">
            <div class="eventos">${eventosHtml}</div>
            <span class="pill" style="background:${estilo.pill};color:${estilo.pillTexto};">${escapeHtml(etiqueta)}</span>
            ${pie}
          </div>
        </td>`
      })
      .join('')
    semanasHtml.push(`<tr>${tds}</tr>`)
  }

  const chipsTurno = LEYENDA_TURNOS.map(({ turno, label }) => {
    const c = ESTILO_TURNO[turno]
    return `<span class="chip" style="background:${c.pill};color:${c.pillTexto};" title="${escapeHtml(label)}">${escapeHtml(etiquetaTurno(turno))}</span>`
  }).join('')

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 7mm; }
    * { box-sizing: border-box; }
    html, body { height: 100%; }
    body {
      margin: 0;
      padding: 0;
      height: 196mm;
      display: flex;
      flex-direction: column;
      color: #0f172a;
      font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .cabecera { margin: 0 0 6px; }
    .titulo {
      margin: 0;
      font-size: 15px;
      font-weight: 800;
      letter-spacing: -0.02em;
    }
    .sub {
      margin: 1px 0 6px;
      font-size: 10px;
      color: #64748b;
    }
    .identidad {
      display: flex;
      flex-wrap: wrap;
      align-items: center;
      gap: 6px;
      margin-bottom: 2px;
    }
    .placa {
      display: inline-flex;
      align-items: center;
      border: 1px solid #e2e8f0;
      background: #f8fafc;
      border-radius: 6px;
      padding: 1px 6px;
      font-family: ui-monospace, Menlo, Consolas, monospace;
      font-size: 11px;
      font-weight: 800;
    }
    .nombre { margin: 0; font-size: 13px; font-weight: 800; }
    .rol { margin-left: 4px; font-size: 11px; font-weight: 600; color: #475569; }
    .kpis { display: flex; flex-wrap: wrap; gap: 4px; }
    .kpi {
      display: inline-flex;
      align-items: center;
      gap: 4px;
      height: 18px;
      padding: 0 6px;
      border-radius: 6px;
      border: 1px solid transparent;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.04em;
      text-transform: uppercase;
    }
    .kpi b { font-size: 11px; letter-spacing: 0; text-transform: none; }
    .kpi.trab { background: #f0f9ff; border-color: #bae6fd; color: #0c4a6e; }
    .kpi.noches { background: #f5f3ff; border-color: #ddd6fe; color: #4c1d95; }
    .kpi.fest { background: #fffbeb; border-color: #fde68a; color: #451a03; }
    .kpi.perm { background: #fff1f2; border-color: #fecdd3; color: #881337; }
    .marco {
      flex: 1 1 auto;
      min-height: 0;
      display: flex;
      flex-direction: column;
      border: 1px solid #e2e8f0;
      border-radius: 10px;
      overflow: hidden;
      background: #fff;
    }
    table.cal {
      width: 100%;
      height: 100%;
      border-collapse: separate;
      border-spacing: 1px;
      table-layout: fixed;
      background: #e2e8f0;
    }
    th.dow {
      padding: 3px 0;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-transform: uppercase;
      color: #64748b;
      background: #f8fafc;
      text-align: center;
    }
    th.dow.finde { color: #dc2626; }
    td.hueco { background: #f8fafc; }
    td.dia {
      background-color: #fff;
      padding: 3px 4px 4px;
      text-align: left;
      vertical-align: top;
      overflow: hidden;
    }
    tr { height: ${Math.max(22, Math.floor(148 / semanas))}mm; }
    .cab {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-bottom: 2px;
    }
    .num {
      font-size: 11px;
      font-weight: 800;
      line-height: 1;
      font-variant-numeric: tabular-nums;
    }
    .punto {
      width: 6px;
      height: 6px;
      border-radius: 999px;
      background: #ef4444;
    }
    .cuerpo { display: flex; flex-direction: column; align-items: flex-start; gap: 2px; }
    .eventos { display: flex; flex-direction: column; width: 100%; max-width: 100%; }
    .ev {
      display: block;
      max-width: 100%;
      margin-top: 1px;
      padding: 0 2px;
      border-radius: 3px;
      font-size: 8px;
      font-weight: 700;
      line-height: 1.25;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .pill {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      margin-top: 1px;
      padding: 1px 6px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 800;
      line-height: 1.2;
      letter-spacing: -0.02em;
    }
    .puesto, .muted, .vacaciones {
      display: block;
      max-width: 100%;
      font-size: 8.5px;
      line-height: 1.15;
      overflow: hidden;
    }
    .puesto { font-weight: 800; color: #0f172a; }
    .muted { font-weight: 600; color: #64748b; }
    .vacaciones { font-weight: 600; color: #065f46; }
    .leyenda {
      margin-top: 5px;
      display: flex;
      flex-wrap: wrap;
      gap: 4px;
    }
    .chip {
      display: inline-flex;
      align-items: center;
      justify-content: center;
      min-width: 22px;
      padding: 1px 7px;
      border-radius: 999px;
      font-size: 9px;
      font-weight: 800;
    }
  </style>
</head>
<body>
  <header class="cabecera">
    <h1 class="titulo">Calendario jefes</h1>
    <p class="sub">Vista mensual · ${escapeHtml(MESES[mes - 1])} ${anio}</p>
    <div class="identidad">
      <span class="placa">${escapeHtml(agente.numeroPlaca)}</span>
      <p class="nombre">${escapeHtml(nombre)}<span class="rol">${escapeHtml(rol)}</span></p>
      <div class="kpis">
        <span class="kpi trab">Trab. <b>${total}d</b></span>
        <span class="kpi noches">Noches <b>${noches}</b></span>
        <span class="kpi fest">Fest. <b>${festivosTrabajados}</b></span>
        <span class="kpi perm">Perm. <b>${permisosMes}</b></span>
      </div>
    </div>
  </header>
  <div class="marco">
    <table class="cal">
      <thead>
        <tr>${DIAS_SEMANA.map((d, indice) => `<th class="dow${indice >= 5 ? ' finde' : ''}">${d}</th>`).join('')}</tr>
      </thead>
      <tbody>
        ${semanasHtml.join('')}
      </tbody>
    </table>
  </div>
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
