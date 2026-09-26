import { useMemo } from 'react'
import { ChipEventoCalendario } from '@/components/ChipEventoCalendario'
import { useEventosData } from '@/lib/eventosStore'
import { etiquetaDia, isoFechaMovil, useMovilMes } from '@/pages/movil/movilMes'

export function MovilEventosPage() {
  const { anio, mes, nombreMes } = useMovilMes()
  const [eventos] = useEventosData()
  const dias = useMemo(() => {
    const porDia = new Map<number, typeof eventos>()
    for (const evento of eventos) {
      const [anioFecha, mesFecha, diaFecha] = evento.fecha.split('-')
      if (Number(anioFecha) !== anio || Number(mesFecha) !== mes) continue
      const dia = Number(diaFecha)
      const lista = porDia.get(dia) ?? []
      lista.push(evento)
      porDia.set(dia, lista)
    }
    return [...porDia.entries()].sort((a, b) => a[0] - b[0])
  }, [eventos, anio, mes])

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Calendario Eventos de {nombreMes}. Solo consulta.
      </p>
      {dias.length === 0 ? (
        <p className="rounded-2xl bg-white px-3 py-4 text-sm text-slate-500">
          No hay eventos este mes.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {dias.map(([dia, lista]) => (
            <li key={dia} className="rounded-2xl bg-white px-3 py-2">
              <p className="text-sm font-bold text-slate-900">
                {dia} {etiquetaDia(anio, mes, dia).largo}
              </p>
              <p className="sr-only">{isoFechaMovil(anio, mes, dia)}</p>
              {lista.map((evento) => (
                <ChipEventoCalendario key={evento.id} evento={evento} />
              ))}
            </li>
          ))}
        </ul>
      )}
    </div>
  )
}
