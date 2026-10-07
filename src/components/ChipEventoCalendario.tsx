import { etiquetaDeTipo } from '@/lib/etiquetasEvento'
import { useTiposEvento } from '@/lib/tiposEventoStore'
import type { EventoOperativo } from '@/types'

/** Pastilla de evento, la misma del calendario de eventos. */
export function ChipEventoCalendario({
  evento,
}: {
  evento: Pick<EventoOperativo, 'tipo' | 'descripcion'>
}) {
  const [tipos] = useTiposEvento()
  const etiqueta = etiquetaDeTipo(evento.tipo, tipos)
  const texto = evento.descripcion || etiqueta.texto || 'Evento'
  return (
    <span
      className={`mt-0.5 block max-w-full truncate rounded px-0.5 py-0 text-xs font-semibold ${etiqueta.clase}`}
      title={texto}
    >
      {etiqueta.emoji ? `${etiqueta.emoji} ` : ''}
      {texto}
    </span>
  )
}
