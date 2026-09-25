import { useEffect, useState } from 'react'
import { ChipEventoCalendario } from '@/components/ChipEventoCalendario'
import { detalleDiaCalendarioJefe } from '@/lib/exportarCalendarioJefesPdf'
import { esDiaTrabajado, totalDiasTrabajadosJefes } from '@/lib/convenio'
import { eventosEnFecha } from '@/lib/eventosStore'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import { useCuadranteJefesMes } from '@/lib/useCuadranteJefesMes'
import type { Turno } from '@/types'
import { RejillaMesMovil } from '@/pages/movil/RejillaMesMovil'
import { etiquetaDia, isoFechaMovil, useMovilMes } from '@/pages/movil/movilMes'

const PILLA: Record<string, string> = {
  M: 'bg-sky-100 text-sky-950',
  T: 'bg-amber-100 text-amber-950',
  N: 'bg-violet-100 text-violet-950',
  MT: 'bg-teal-100 text-teal-950',
  P: 'bg-rose-100 text-rose-900',
  L: 'bg-rose-100 text-rose-900',
  D: 'bg-slate-200 text-slate-600',
  V: 'bg-emerald-100 text-emerald-900',
}

function etiquetaTurnoMovil(turno: Turno) {
  if (turno === 'MT') return 'M-T'
  if (turno === 'L') return 'P'
  return turno
}

export function MovilCalendarioPage() {
  const { anio, mes, nombreMes } = useMovilMes()
  const datos = useCuadranteJefesMes(anio, mes)
  const [agenteId, setAgenteId] = useState('')
  const [dia, setDia] = useState<number | null>(null)

  useEffect(() => {
    if (!datos.jefes.some((agente) => agente.id === agenteId)) {
      setAgenteId(datos.jefes[0]?.id ?? '')
    }
  }, [datos.jefes, agenteId])

  useEffect(() => {
    const hoy = new Date()
    const enEsteMes = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes
    setDia(enEsteMes ? hoy.getDate() : 1)
  }, [anio, mes])

  const agente = datos.jefes.find((item) => item.id === agenteId) ?? null
  const fila = agente ? (datos.cuadrante[agente.id] ?? []) : []
  const dias = Array.from({ length: datos.nDias }, (_, i) => i + 1)
  const trabajados = agente ? totalDiasTrabajadosJefes(fila, dias) : 0
  const diaAbierto = dia != null && dia <= datos.nDias ? dia : null
  const fecha = diaAbierto ? isoFechaMovil(anio, mes, diaAbierto) : ''
  const turno = (diaAbierto ? (fila[diaAbierto - 1] ?? 'D') : 'D') as Turno
  const eventos = fecha ? eventosEnFecha(datos.eventos, fecha) : []
  const detalle = agente && fecha
    ? detalleDiaCalendarioJefe(
        turno,
        fecha,
        agente.id,
        datos.asignaciones,
        datos.puestos,
        datos.tiposPermiso,
      ).detalle
    : null
  const pie = detalle
    ? detalle
    : esDiaTrabajado(turno)
      ? 'Sin puesto'
      : turno === 'V'
        ? 'Vacaciones'
        : turno === 'P' || turno === 'L'
          ? 'Permiso'
          : 'Descanso'
  const nombreDia = diaAbierto ? etiquetaDia(anio, mes, diaAbierto).largo : ''

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Calendario del mes. Pulsa un día para ver los eventos.
      </p>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {datos.jefes.map((item) => {
          const activo = item.id === agente?.id
          return (
            <button
              key={item.id}
              type="button"
              className={`shrink-0 rounded-2xl px-3 py-2 text-left ${
                activo ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'
              }`}
              onClick={() => setAgenteId(item.id)}
            >
              <span className="block text-sm font-extrabold">
                {item.nombre} {item.apellidos.split(' ')[0]}
              </span>
              <span className={`block text-[11px] font-semibold ${activo ? 'text-slate-300' : 'text-slate-500'}`}>
                {ROL_LABEL[item.rolBase]} · {totalDiasTrabajadosJefes(datos.cuadrante[item.id] ?? [], dias)}d
              </span>
            </button>
          )
        })}
      </div>
      {datos.loading ? <p className="px-1 text-sm text-slate-500">Cargando calendario…</p> : null}
      {datos.error ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{datos.error}</p>
      ) : null}
      {agente ? (
        <>
          <RejillaMesMovil
            anio={anio}
            mes={mes}
            diaSeleccionado={diaAbierto}
            onElegir={setDia}
            marca={(numero) => {
              const turnoDia = (fila[numero - 1] ?? 'D') as Turno
              const hayEvento = eventosEnFecha(datos.eventos, isoFechaMovil(anio, mes, numero)).length > 0
              return {
                texto: etiquetaTurnoMovil(turnoDia),
                aviso: hayEvento,
              }
            }}
          />
          {diaAbierto ? (
            <section className="rounded-3xl bg-white px-4 py-3 shadow-sm">
              <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
                {nombreDia} {diaAbierto} {nombreMes}
              </p>
              <div className="mt-2 flex items-center gap-2">
                <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${PILLA[turno] ?? PILLA.D}`}>
                  {etiquetaTurnoMovil(turno)}
                </span>
                <span className="text-sm font-semibold text-slate-800">{pie}</span>
                <span className="ml-auto text-xs font-semibold text-slate-400">{trabajados}d</span>
              </div>
              <div className="mt-3 flex flex-col gap-1">
                {eventos.length === 0 ? (
                  <p className="text-sm text-slate-500">Este día no hay eventos.</p>
                ) : (
                  eventos.map((evento) => (
                    <ChipEventoCalendario key={evento.id} evento={evento} />
                  ))
                )}
              </div>
            </section>
          ) : null}
        </>
      ) : !datos.loading ? (
        <p className="rounded-2xl bg-white px-3 py-4 text-sm text-slate-600">
          No hay jefes ni responsables en la plantilla.
        </p>
      ) : null}
    </div>
  )
}
