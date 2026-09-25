import { useEffect, useState } from 'react'
import { detalleDiaCalendarioJefe } from '@/lib/exportarCalendarioJefesPdf'
import { esDiaTrabajado } from '@/lib/convenio'
import { useCuadranteJefesMes } from '@/lib/useCuadranteJefesMes'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import type { Turno } from '@/types'
import { RejillaMesMovil } from '@/pages/movil/RejillaMesMovil'
import { etiquetaDia, isoFechaMovil, useMovilMes } from '@/pages/movil/movilMes'

const FRANJAS: Array<{ turno: Turno; titulo: string; clase: string }> = [
  { turno: 'M', titulo: 'Mañana', clase: 'bg-sky-100 text-sky-950' },
  { turno: 'T', titulo: 'Tarde', clase: 'bg-amber-100 text-amber-950' },
  { turno: 'N', titulo: 'Noche', clase: 'bg-violet-100 text-violet-950' },
  { turno: 'MT', titulo: 'Mañana y tarde', clase: 'bg-teal-100 text-teal-950' },
]

function cuentaServicio(
  cuadrante: Record<string, Turno[] | undefined>,
  ids: string[],
  dia: number,
) {
  return ids.filter((id) => esDiaTrabajado((cuadrante[id]?.[dia - 1] ?? 'D') as Turno)).length
}

export function MovilCuadrantePage() {
  const { anio, mes, nombreMes } = useMovilMes()
  const datos = useCuadranteJefesMes(anio, mes)
  const [dia, setDia] = useState<number | null>(null)

  useEffect(() => {
    const hoy = new Date()
    const enEsteMes = hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes
    setDia(enEsteMes ? hoy.getDate() : 1)
  }, [anio, mes])

  const diaAbierto = dia != null && dia <= datos.nDias ? dia : null
  const fecha = diaAbierto ? isoFechaMovil(anio, mes, diaAbierto) : ''
  const nombreDia = diaAbierto ? etiquetaDia(anio, mes, diaAbierto).largo : ''
  const ids = datos.jefes.map((agente) => agente.id)
  const franjas = diaAbierto
    ? FRANJAS.map((franja) => ({
        ...franja,
        gente: datos.jefes.flatMap((agente) => {
          const turno = (datos.cuadrante[agente.id]?.[diaAbierto - 1] ?? 'D') as Turno
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
    : []

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Pulsa un día para ver qué jefes y responsables trabajan.
      </p>
      {datos.loading ? <p className="px-1 text-sm text-slate-500">Cargando cuadrante…</p> : null}
      {datos.error ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{datos.error}</p>
      ) : null}
      <RejillaMesMovil
        anio={anio}
        mes={mes}
        diaSeleccionado={diaAbierto}
        onElegir={setDia}
        marca={(numero) => {
          const n = cuentaServicio(datos.cuadrante, ids, numero)
          return { texto: n > 0 ? String(n) : '—' }
        }}
      />
      {diaAbierto ? (
        <section className="rounded-3xl bg-white px-4 py-3 shadow-sm">
          <p className="text-[11px] font-bold uppercase tracking-wide text-slate-400">
            {nombreDia} {diaAbierto} {nombreMes}
          </p>
          <h2 className="mt-1 text-base font-extrabold text-slate-950">
            {franjas.reduce((suma, franja) => suma + franja.gente.length, 0) === 0
              ? 'Nadie de servicio'
              : 'De servicio'}
          </h2>
          {franjas.length === 0 ? (
            <p className="mt-2 text-sm text-slate-500">
              Ese día no trabaja ningún jefe ni responsable.
            </p>
          ) : (
            <div className="mt-2 flex flex-col gap-2">
              {franjas.map((franja) => (
                <section key={franja.turno}>
                  <p className={`mb-1 inline-flex rounded-full px-2 py-0.5 text-[11px] font-extrabold ${franja.clase}`}>
                    {franja.titulo}
                  </p>
                  <ul>
                    {franja.gente.map(({ agente, detalle }) => (
                      <li
                        key={agente.id}
                        className="flex items-baseline justify-between gap-2 border-t border-slate-100 py-2 first:border-t-0"
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
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  )
}
