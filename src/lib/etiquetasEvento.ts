import { etiquetaTipoEvento } from '@/lib/tiposEvento'
import { getTiposEvento } from '@/lib/tiposEventoStore'

export function etiquetaEvento(tipo: string) {
  return etiquetaTipoEvento(tipo, getTiposEvento())
}

/** @deprecated Usar etiquetaEvento(tipo). Conservado para lecturas puntuales. */
export const ETIQUETA_EVENTO = new Proxy(
  {} as Record<string, { emoji: string; clase: string; texto: string }>,
  {
    get(_target, prop) {
      if (typeof prop !== 'string') return undefined
      return etiquetaEvento(prop)
    },
  },
)
