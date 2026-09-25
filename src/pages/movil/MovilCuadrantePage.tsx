import { ChipEventoCalendario } from '@/components/ChipEventoCalendario'
import { detalleDiaCalendarioJefe } from '@/lib/exportarCalendarioJefesPdf'
import { esFinDeSemana } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import { eventosEnFecha } from '@/lib/eventosStore'
import { useCuadranteJefesMes } from '@/lib/useCuadranteJefesMes'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import type { Turno } from '@/types'
import { etiquetaDia, isoFechaMovil, useMovilMes } from '@/pages/movil/movilMes'

const FRANJAS: Array<{ turno: Turno; titulo: string; clase: string }> = [
  { turno: 'M', titulo: 'Mañana', clase: 'bg-sky-100 text-sky-950' },
  { turno: 'T', titulo: 'Tarde', clase: 'bg-amber-100 text-amber-950' },
  { turno: 'N', titulo: 'Noche', clase: 'bg-violet-100 text-violet-950' },
  { turno: 'MT', titulo: 'Mañana y tarde', clase: 'bg-teal-100 text-teal-950' },
]

export function MovilCuadrantePage() {
  const { anio, mes } = useMovilMes()
  const datos = useCuadranteJefesMes(anio, mes)

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Quién trabaja cada día. Solo jefes de servicio y responsables.
      </p>
      {datos.loading ? <p className="px-1 text-sm text-slate-500">Cargando cuadrante…</p> : null}
      {datos.error ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{datos.error}</p>
      ) : null}
      {!datos.loading && datos.jefes.length === 0 ? (
        <p className="rounded-2xl bg-white px-3 py-4 text-sm text-slate-600">
          No hay jefes ni responsables en la plantilla.
        </p>
      ) : null}
      {Array.from({ length: datos.nDias }, (_, indice) => {
        const dia = indice + 1
        const fecha = isoFechaMovil(anio, mes, dia)
        const { largo, corto } = etiquetaDia(anio, mes, dia)
        const especial = esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
        const eventos = eventosEnFecha(datos.eventos, fecha)
        const franjas = FRANJAS.map((franja) => ({
          ...franja,
          gente: datos.jefes.flatMap((agente) => {
            const turno = (datos.cuadrante[agente.id]?.[indice] ?? 'D') as Turno
            if (turno !== franja.turno) return []
            const detalle = detalleDiaCalendarioJefe(
              turno,
              fecha,
              agente.id,
              datos.asignaciones,
              datos.puestos,
              datos.tiposPermiso,
            ).detalle
            return [{ agente, detalle }]
          }),
        })).filter((franja) => franja.gente.length > 0)

        return (
          <article key={fecha} className="overflow-hidden rounded-3xl bg-white shadow-sm">
            <header
              className={`flex items-center justify-between gap-3 px-4 py-3 ${
                especial ? 'bg-rose-50' : 'bg-white'
              }`}
            >
              <div className="flex items-baseline gap-2">
                <p className={`text-2xl font-extrabold leading-none ${especial ? 'text-rose-700' : 'text-slate-950'}`}>
                  {dia}
                </p>
                <p className={`text-[11px] font-bold uppercase tracking-wide ${especial ? 'text-rose-600' : 'text-slate-400'}`}>
                  {corto} · {largo}
                </p>
              </div>
              <div className="min-w-0 max-w-[55%]">
                {eventos.map((evento) => (
                  <ChipEventoCalendario key={evento.id} evento={evento} />
                ))}
              </div>
            </header>
            <div className="flex flex-col gap-2 px-3 pb-3">
              {franjas.length === 0 ? (
                <p className="px-1 py-1 text-sm text-slate-500">Nadie de servicio.</p>
              ) : (
                franjas.map((franja) => (
                  <section key={franja.turno} className="rounded-2xl bg-slate-50 px-3 py-2">
                    <p className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold ${franja.clase}`}>
                      {franja.titulo}
                    </p>
                    <ul>
                      {franja.gente.map(({ agente, detalle }) => (
                        <li
                          key={agente.id}
                          className="flex items-baseline justify-between gap-2 border-t border-white py-1.5 first:border-t-0"
                        >
                          <span className="min-w-0">
                            <span className="block truncate text-sm font-semibold text-slate-900">
                              {agente.nombre} {agente.apellidos}
                            </span>
                            <span className="text-[11px] font-semibold text-slate-400">
                              {ROL_LABEL[agente.rolBase]}
                            </span>
                          </span>
                          <span className="shrink-0 text-xs font-medium text-slate-500">
                            {detalle ?? 'Sin puesto'}
                          </span>
                        </li>
                      ))}
                    </ul>
                  </section>
                ))
              )}
            </div>
          </article>
        )
      })}
    </div>
  )
}
