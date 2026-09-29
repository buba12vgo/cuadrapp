import type { TipoEvento } from '@/types'

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
