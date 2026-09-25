import type { EventoOperativo, TipoEvento } from '@/types'

export const ETIQUETA_EVENTO: Partial<
  Record<TipoEvento, { emoji: string; clase: string; texto: string }>
> = {
  FESTIVO: {
    emoji: '🔴',
    clase: 'bg-red-100 text-red-900',
    texto: 'Festivo',
  },
  CRUCERO: {
    emoji: '🚢',
    clase: 'bg-blue-100 text-blue-900',
    texto: 'Crucero',
  },
  CONCIERTO: {
    emoji: '🎵',
    clase: 'bg-yellow-100 text-yellow-900',
    texto: 'Concierto',
  },
}

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
