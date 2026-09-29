import { ETIQUETA_EVENTO } from '@/lib/etiquetasEvento'
import type { EventoOperativo } from '@/types'

/** Pastilla de evento, la misma del calendario de eventos. */
export function ChipEventoCalendario({
  evento,
}: {
  evento: Pick<EventoOperativo, 'tipo' | 'descripcion'>
}) {
  const etiqueta = ETIQUETA_EVENTO[evento.tipo]
  const texto = evento.descripcion || etiqueta?.texto || 'Evento'
  return (
    <span
      className={`mt-0.5 block max-w-full truncate rounded px-0.5 py-0 text-xs font-semibold ${
        etiqueta ? etiqueta.clase : 'bg-slate-100 text-slate-700'
      }`}
      title={texto}
    >
      {etiqueta ? `${etiqueta.emoji} ` : ''}
      {texto}
    </span>
  )
}
