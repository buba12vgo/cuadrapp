import { useEffect, useState } from 'react'
import { ChipEventoCalendario } from '@/components/ChipEventoCalendario'
import { detalleDiaCalendarioJefe } from '@/lib/exportarCalendarioJefesPdf'
import { esDiaTrabajado, esFinDeSemana, totalDiasTrabajadosJefes } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import { eventosEnFecha } from '@/lib/eventosStore'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import { useCuadranteJefesMes } from '@/lib/useCuadranteJefesMes'
import type { Turno } from '@/types'
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
  const { anio, mes } = useMovilMes()
  const datos = useCuadranteJefesMes(anio, mes)
  const [agenteId, setAgenteId] = useState('')

  useEffect(() => {
    if (!datos.jefes.some((agente) => agente.id === agenteId)) {
      setAgenteId(datos.jefes[0]?.id ?? '')
    }
  }, [datos.jefes, agenteId])

  const agente = datos.jefes.find((item) => item.id === agenteId) ?? null
  const fila = agente ? (datos.cuadrante[agente.id] ?? []) : []
  const dias = Array.from({ length: datos.nDias }, (_, i) => i + 1)
  const trabajados = agente ? totalDiasTrabajadosJefes(fila, dias) : 0

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Calendario del mes de cada jefe o responsable. Solo consulta.
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
                {ROL_LABEL[item.rolBase]}
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
        <section className="overflow-hidden rounded-3xl bg-white shadow-sm">
          <header className="flex items-end justify-between gap-3 border-b border-slate-100 px-4 py-3">
            <div>
              <p className="text-base font-extrabold text-slate-950">
                {agente.nombre} {agente.apellidos}
              </p>
              <p className="text-xs font-semibold text-slate-500">
                {agente.numeroPlaca} · {ROL_LABEL[agente.rolBase]}
              </p>
            </div>
            <p className="text-right text-sm font-extrabold text-slate-950">
              {trabajados}d
              <span className="block text-[10px] font-semibold uppercase tracking-wide text-slate-400">
                trabajados
              </span>
            </p>
          </header>
          <ol>
            {dias.map((dia) => {
              const turno = (fila[dia - 1] ?? 'D') as Turno
              const fecha = isoFechaMovil(anio, mes, dia)
              const { corto } = etiquetaDia(anio, mes, dia)
              const especial = esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
              const { detalle } = detalleDiaCalendarioJefe(
                turno,
                fecha,
                agente.id,
                datos.asignaciones,
                datos.puestos,
                datos.tiposPermiso,
              )
              const eventos = eventosEnFecha(datos.eventos, fecha)
              const pie = detalle
                ? detalle
                : esDiaTrabajado(turno)
                  ? 'Sin puesto'
                  : turno === 'V'
                    ? 'Vacaciones'
                    : turno === 'P' || turno === 'L'
                      ? 'Permiso'
                      : 'Descanso'
              return (
                <li
                  key={fecha}
                  className={`flex gap-3 border-t border-slate-100 px-4 py-3 ${
                    especial ? 'bg-rose-50/70' : ''
                  }`}
                >
                  <div className="w-10 shrink-0 text-center">
                    <p className={`text-[10px] font-bold uppercase ${especial ? 'text-rose-600' : 'text-slate-400'}`}>
                      {corto}
                    </p>
                    <p className={`text-xl font-extrabold leading-none ${especial ? 'text-rose-700' : 'text-slate-950'}`}>
                      {dia}
                    </p>
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="flex items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[11px] font-extrabold ${PILLA[turno] ?? PILLA.D}`}>
                        {etiquetaTurnoMovil(turno)}
                      </span>
                      <span className="truncate text-sm font-semibold text-slate-800">{pie}</span>
                    </div>
                    {eventos.map((evento) => (
                      <ChipEventoCalendario key={evento.id} evento={evento} />
                    ))}
                  </div>
                </li>
              )
            })}
          </ol>
        </section>
      ) : !datos.loading ? (
        <p className="rounded-2xl bg-white px-3 py-4 text-sm text-slate-600">
          No hay jefes ni responsables en la plantilla.
        </p>
      ) : null}
    </div>
  )
}
