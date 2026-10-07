import type { TipoEvento } from '@/types'
import {
  COLORES_TIPO_EVENTO,
  colorTipoEvento,
  estiloTipoEvento,
  type TipoEventoConfig,
} from '@/lib/tiposEvento'
import { getTiposEvento } from '@/lib/tiposEventoStore'

export type EtiquetaEvento = {
  emoji: string
  clase: string
  texto: string
}

export const ETIQUETA_EVENTO: Partial<Record<TipoEvento, EtiquetaEvento>> = {
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

export function etiquetaDeTipo(
  tipo: string,
  tipos?: TipoEventoConfig[],
): EtiquetaEvento {
  const catalogo = (tipos ?? getTiposEvento()).find(
    (item) => item.codigo === tipo,
  )
  if (catalogo) {
    const estilo = estiloTipoEvento(catalogo)
    return {
      emoji: estilo.emoji,
      clase: estilo.clase,
      texto: estilo.texto,
    }
  }
  return (
    ETIQUETA_EVENTO[tipo] ?? {
      emoji: '',
      clase: COLORES_TIPO_EVENTO.slate.clase,
      texto: tipo.replaceAll('_', ' '),
    }
  )
}

export function colorPdfDeTipo(
  tipo: string,
  tipos?: TipoEventoConfig[],
): { fondo: string; texto: string; borde: string } {
  const catalogo = (tipos ?? getTiposEvento()).find(
    (item) => item.codigo === tipo,
  )
  if (catalogo) {
    const color = COLORES_TIPO_EVENTO[colorTipoEvento(catalogo.color)]
    return { fondo: color.fondo, texto: color.texto, borde: color.borde }
  }
  if (tipo === 'FESTIVO') {
    return { fondo: '#fee2e2', texto: '#7f1d1d', borde: '#ef4444' }
  }
  if (tipo === 'CRUCERO') {
    return { fondo: '#dbeafe', texto: '#1e3a8a', borde: '#3b82f6' }
  }
  if (tipo === 'CONCIERTO') {
    return { fondo: '#fef9c3', texto: '#713f12', borde: '#eab308' }
  }
  return { fondo: '#f1f5f9', texto: '#334155', borde: '#94a3b8' }
}
