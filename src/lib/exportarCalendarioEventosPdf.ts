import {
  minimosDefectoParaFecha,
  minimosParaFecha,
  type MinimosSemana,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import { celdasMesCalendario } from '@/lib/calendarioMes'
import { diasDelMes } from '@/lib/convenio'
import { diaEsEspecial } from '@/lib/diaEspecial'
import { etiquetaEvento } from '@/lib/etiquetasEvento'
import { DIAS_SEMANA, MESES, isoFecha } from '@/lib/fechas'
import { escapeHtml, imprimirHtml } from '@/lib/impresionPdf'
import {
  colorPdfTipoEvento,
  estiloTipoEvento,
  tipoEventoEsFestivo,
} from '@/lib/tiposEvento'
import { getTiposEvento } from '@/lib/tiposEventoStore'
import type { EventoOperativo } from '@/types'

const MAX_EVENTOS_CELDA = 4

export type ExportarCalendarioEventosPdfOpciones = {
  anio: number
  mes: number
  eventos: EventoOperativo[]
  puestos: PuestoConfig[]
  semana: MinimosSemana
}

function textoEvento(evento: EventoOperativo) {
  return evento.descripcion || etiquetaEvento(evento.tipo).texto || 'Evento'
}

function chipEvento(evento: EventoOperativo) {
  const color = colorPdfTipoEvento(evento.tipo, getTiposEvento())
  const emoji = etiquetaEvento(evento.tipo).emoji
  return `<span class="ev" style="background:${color.fondo};color:${color.texto};border-left-color:${color.borde};">${emoji ? `${emoji} ` : ''}${escapeHtml(textoEvento(evento))}</span>`
}

/** Puestos cuyo mínimo del día difiere del de la semana tipo, como `CTR 2·1·1`. */
function cambiosMinimos(
  fecha: string,
  eventos: EventoOperativo[],
  semana: MinimosSemana,
  puestos: PuestoConfig[],
) {
  const efectivos = minimosParaFecha(fecha, eventos, semana, puestos)
  const defecto = minimosDefectoParaFecha(fecha, semana, puestos)
  const cambios: string[] = []
  for (const puesto of puestos) {
    const a = efectivos[puesto.nombre] ?? { M: 0, T: 0, N: 0 }
    const b = defecto[puesto.nombre] ?? { M: 0, T: 0, N: 0 }
    if (a.M === b.M && a.T === b.T && a.N === b.N) continue
    cambios.push(
      `<span class="min"><b>${escapeHtml(puesto.abreviatura || puesto.nombre)}</b> ${a.M}·${a.T}·${a.N}</span>`,
    )
  }
  return cambios
}

export function exportarCalendarioEventosPdf(
  opciones: ExportarCalendarioEventosPdfOpciones,
) {
  const { anio, mes, eventos, puestos, semana } = opciones
  const nombreMes = MESES[mes - 1]
  const prefijo = `${anio}-${String(mes).padStart(2, '0')}-`
  const delMes = eventos
    .filter((evento) => evento.fecha.startsWith(prefijo))
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
  const porFecha = new Map<string, EventoOperativo[]>()
  for (const evento of delMes) {
    const lista = porFecha.get(evento.fecha) ?? []
    lista.push(evento)
    porFecha.set(evento.fecha, lista)
  }

  const tipos = getTiposEvento()
  const conteo = new Map<string, number>()
  let festivos = 0
  for (const evento of delMes) {
    conteo.set(evento.tipo, (conteo.get(evento.tipo) ?? 0) + 1)
    if (tipoEventoEsFestivo(evento.tipo, tipos)) festivos += 1
  }
  const diasConEvento = porFecha.size
  const nDias = diasDelMes(anio, mes)

  const celdas = celdasMesCalendario(anio, mes)
  const semanas = celdas.length / 7
  const filas: string[] = []
  for (let i = 0; i < celdas.length; i += 7) {
    const tds = celdas
      .slice(i, i + 7)
      .map((dia) => {
        if (dia == null) return '<td class="hueco"></td>'
        const fecha = isoFecha(anio, mes, dia)
        const eventosDia = porFecha.get(fecha) ?? []
        const rojo = diaEsEspecial(anio, mes, dia, eventos)
        const visibles = eventosDia.slice(0, MAX_EVENTOS_CELDA).map(chipEvento).join('')
        const resto = eventosDia.length - MAX_EVENTOS_CELDA
        return `<td class="dia${eventosDia.length ? ' con' : ''}">
          <span class="num${rojo ? ' rojo' : ''}">${dia}</span>
          <div class="eventos">${visibles}${resto > 0 ? `<span class="mas">+${resto} más</span>` : ''}</div>
        </td>`
      })
      .join('')
    filas.push(`<tr>${tds}</tr>`)
  }

  const leyenda = tipos
    .map((tipo) => {
      const color = estiloTipoEvento(tipo.estiloId).pdf
      const emoji = estiloTipoEvento(tipo.estiloId).emoji
      return `<span class="chip" style="background:${color.fondo};color:${color.texto};border-left-color:${color.borde};">${emoji ? `${emoji} ` : ''}${escapeHtml(tipo.nombre)}</span>`
    })
    .join('')

  const listado = delMes
    .map((evento) => {
      const [, , d] = evento.fecha.split('-').map(Number)
      const diaSemana = DIAS_SEMANA[(new Date(anio, mes - 1, d).getDay() + 6) % 7]
      const color = colorPdfTipoEvento(evento.tipo, tipos)
      const cambios = cambiosMinimos(evento.fecha, eventos, semana, puestos)
      return `<tr>
        <td class="f"><b>${d}</b> <span class="dow">${diaSemana}</span></td>
        <td><span class="tipo" style="background:${color.fondo};color:${color.texto};border-left-color:${color.borde};">${escapeHtml(etiquetaEvento(evento.tipo).texto)}</span></td>
        <td class="desc">${escapeHtml(textoEvento(evento))}</td>
        <td class="mins">${cambios.length ? cambios.join('') : '<span class="muted">Por defecto</span>'}</td>
      </tr>`
    })
    .join('')

  const titulo = `Calendario de eventos · ${nombreMes} ${anio}`
  const generado = new Date().toLocaleDateString('es-ES', {
    day: 'numeric',
    month: 'long',
    year: 'numeric',
  })

  const cabecera = (subtitulo: string) => `<header class="cabecera">
    <div>
      <p class="marca">MoaPP · Policía Portuaria</p>
      <h1 class="titulo">Calendario de eventos · ${escapeHtml(nombreMes)} ${anio}</h1>
      <p class="sub">${escapeHtml(subtitulo)}</p>
    </div>
    <div class="kpis">
      <span class="kpi"><b>${delMes.length}</b> eventos</span>
      <span class="kpi"><b>${diasConEvento}</b>/${nDias} días</span>
      <span class="kpi fest"><b>${festivos}</b> festivos</span>
      ${[...conteo.entries()]
        .slice(0, 3)
        .map(
          ([codigo, n]) =>
            `<span class="kpi"><b>${n}</b> ${escapeHtml(etiquetaEvento(codigo).texto)}</span>`,
        )
        .join('')}
    </div>
  </header>`

  const html = `<!doctype html>
<html lang="es">
<head>
  <meta charset="utf-8" />
  <title>${escapeHtml(titulo)}</title>
  <style>
    @page { size: A4 landscape; margin: 8mm; }
    * { box-sizing: border-box; }
    body {
      margin: 0;
      color: #0f172a;
      font-family: "IBM Plex Sans", "Helvetica Neue", Arial, sans-serif;
      -webkit-print-color-adjust: exact;
      print-color-adjust: exact;
    }
    .pagina.mensual { height: 193mm; display: flex; flex-direction: column; }
    .pagina + .pagina { break-before: page; }
    .cabecera {
      display: flex;
      align-items: flex-end;
      justify-content: space-between;
      gap: 12px;
      padding-bottom: 6px;
      margin-bottom: 6px;
      border-bottom: 2px solid #0f172a;
    }
    .marca {
      margin: 0;
      font-size: 8px;
      font-weight: 800;
      letter-spacing: 0.12em;
      text-transform: uppercase;
      color: #64748b;
    }
    .titulo { margin: 1px 0 0; font-size: 17px; font-weight: 800; letter-spacing: -0.02em; }
    .sub { margin: 1px 0 0; font-size: 9.5px; color: #64748b; }
    .kpis { display: flex; flex-wrap: wrap; justify-content: flex-end; gap: 4px; }
    .kpi {
      padding: 2px 7px;
      border: 1px solid #e2e8f0;
      border-radius: 6px;
      background: #f8fafc;
      font-size: 9px;
      font-weight: 600;
      color: #475569;
      white-space: nowrap;
    }
    .kpi b { font-size: 11px; font-weight: 800; color: #0f172a; }
    .kpi.fest { background: #fef2f2; border-color: #fecaca; }
    .kpi.cru { background: #eff6ff; border-color: #bfdbfe; }
    .kpi.con { background: #fefce8; border-color: #fef08a; }
    .marco {
      flex: 1 1 auto;
      min-height: 0;
      border: 1.5px solid #334155;
      border-radius: 6px;
      overflow: hidden;
    }
    table.cal {
      width: 100%;
      height: 100%;
      border-collapse: collapse;
      table-layout: fixed;
    }
    table.cal th, table.cal td { border: 1.25px solid #64748b; }
    table.cal tr > :first-child { border-left: 0; }
    table.cal tr > :last-child { border-right: 0; }
    table.cal thead th { border-top: 0; }
    table.cal tbody tr:last-child td { border-bottom: 0; }
    th.dow {
      padding: 3px 0;
      background: #1e293b;
      color: #fff;
      font-size: 9px;
      font-weight: 800;
      letter-spacing: 0.1em;
      text-transform: uppercase;
    }
    th.dow.finde { background: #7f1d1d; }
    table.cal tbody tr { height: ${Math.floor(150 / semanas)}mm; }
    td.hueco { background: #f8fafc; }
    td.dia { background: #fff; padding: 3px 4px; vertical-align: top; overflow: hidden; }
    td.dia.con { background: #fcfcfd; }
    .num { display: block; font-size: 12px; font-weight: 800; line-height: 1; font-variant-numeric: tabular-nums; }
    .num.rojo { color: #dc2626; }
    .eventos { display: flex; flex-direction: column; gap: 1px; margin-top: 3px; }
    .ev, .chip, .tipo {
      display: block;
      padding: 1px 3px;
      border-left: 2px solid;
      border-radius: 3px;
      font-size: 8.5px;
      font-weight: 700;
      line-height: 1.3;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    .mas { font-size: 8px; font-weight: 700; color: #64748b; }
    .pie {
      display: flex;
      align-items: center;
      justify-content: space-between;
      margin-top: 5px;
      font-size: 8px;
      color: #94a3b8;
    }
    .leyenda { display: flex; gap: 4px; }
    .chip, .tipo { display: inline-block; font-size: 8.5px; }
    table.lista { width: 100%; border-collapse: collapse; font-size: 9.5px; }
    table.lista th {
      padding: 4px 6px;
      background: #1e293b;
      color: #fff;
      font-size: 8.5px;
      font-weight: 800;
      letter-spacing: 0.08em;
      text-align: left;
      text-transform: uppercase;
    }
    table.lista td { padding: 3px 6px; border-bottom: 1px solid #e2e8f0; vertical-align: middle; }
    table.lista tbody tr:nth-child(even) td { background: #f8fafc; }
    table.lista tr { break-inside: avoid; height: auto; }
    td.f { width: 16mm; white-space: nowrap; font-variant-numeric: tabular-nums; }
    td.f .dow { color: #64748b; font-weight: 600; }
    td.desc { font-weight: 600; }
    td.mins { width: 95mm; }
    .min {
      display: inline-block;
      margin: 1px 3px 1px 0;
      padding: 0 4px;
      border: 1px solid #e2e8f0;
      border-radius: 3px;
      background: #fff;
      font-size: 8.5px;
      font-variant-numeric: tabular-nums;
    }
    .muted { color: #94a3b8; }
    .vacio { padding: 16px; text-align: center; color: #64748b; font-size: 11px; }
  </style>
</head>
<body>
  <section class="pagina mensual">
    ${cabecera('Vista mensual · festivos, cruceros, conciertos y mínimos especiales')}
    <div class="marco">
      <table class="cal">
        <thead>
          <tr>${DIAS_SEMANA.map((d, i) => `<th class="dow${i >= 5 ? ' finde' : ''}">${d}</th>`).join('')}</tr>
        </thead>
        <tbody>${filas.join('')}</tbody>
      </table>
    </div>
    <div class="pie">
      <div class="leyenda">${leyenda}</div>
      <span>Número en rojo: fin de semana o festivo oficial · Generado el ${escapeHtml(generado)}</span>
    </div>
  </section>
  <section class="pagina">
    ${cabecera('Listado del mes · mínimos M·T·N por puesto cuando difieren de la semana tipo')}
    ${
      delMes.length
        ? `<table class="lista">
      <thead><tr><th>Día</th><th>Tipo</th><th>Evento</th><th>Mínimos del día (M·T·N)</th></tr></thead>
      <tbody>${listado}</tbody>
    </table>`
        : '<p class="vacio">No hay eventos registrados este mes.</p>'
    }
  </section>
</body>
</html>`

  imprimirHtml(html)
}
