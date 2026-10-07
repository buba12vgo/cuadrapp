export type ColorTipoEvento =
  | 'rojo'
  | 'azul'
  | 'amarillo'
  | 'verde'
  | 'violeta'
  | 'slate'

export type TipoEventoConfig = {
  codigo: string
  nombre: string
  emoji: string
  color: ColorTipoEvento
  /** No se puede eliminar (mínimos especiales / día normal). */
  sistema?: boolean
}

export const CODIGO_OPERATIVA_ESPECIAL = 'OPERATIVA_ESPECIAL'

export const COLORES_TIPO_EVENTO: Record<
  ColorTipoEvento,
  { clase: string; fondo: string; texto: string; borde: string; label: string }
> = {
  rojo: {
    clase: 'bg-red-100 text-red-900',
    fondo: '#fee2e2',
    texto: '#7f1d1d',
    borde: '#ef4444',
    label: 'Rojo',
  },
  azul: {
    clase: 'bg-blue-100 text-blue-900',
    fondo: '#dbeafe',
    texto: '#1e3a8a',
    borde: '#3b82f6',
    label: 'Azul',
  },
  amarillo: {
    clase: 'bg-yellow-100 text-yellow-900',
    fondo: '#fef9c3',
    texto: '#713f12',
    borde: '#eab308',
    label: 'Amarillo',
  },
  verde: {
    clase: 'bg-emerald-100 text-emerald-900',
    fondo: '#d1fae5',
    texto: '#064e3b',
    borde: '#10b981',
    label: 'Verde',
  },
  violeta: {
    clase: 'bg-violet-100 text-violet-900',
    fondo: '#ede9fe',
    texto: '#4c1d95',
    borde: '#8b5cf6',
    label: 'Violeta',
  },
  slate: {
    clase: 'bg-slate-100 text-slate-700',
    fondo: '#f1f5f9',
    texto: '#334155',
    borde: '#94a3b8',
    label: 'Gris',
  },
}

export const TIPOS_EVENTO_INICIALES: TipoEventoConfig[] = [
  { codigo: 'FESTIVO', nombre: 'Festivo', emoji: '🔴', color: 'rojo' },
  { codigo: 'CRUCERO', nombre: 'Crucero', emoji: '🚢', color: 'azul' },
  { codigo: 'CONCIERTO', nombre: 'Concierto', emoji: '🎵', color: 'amarillo' },
  {
    codigo: CODIGO_OPERATIVA_ESPECIAL,
    nombre: 'Mínimos especiales',
    emoji: '',
    color: 'slate',
    sistema: true,
  },
]

export function esColorTipoEvento(valor: unknown): valor is ColorTipoEvento {
  return typeof valor === 'string' && valor in COLORES_TIPO_EVENTO
}

export function colorTipoEvento(valor: unknown): ColorTipoEvento {
  return esColorTipoEvento(valor) ? valor : 'slate'
}

export function esTipoEventoSistema(codigo: string) {
  return codigo.trim().toUpperCase() === CODIGO_OPERATIVA_ESPECIAL
}

export function estiloTipoEvento(tipo: TipoEventoConfig) {
  const color = COLORES_TIPO_EVENTO[colorTipoEvento(tipo.color)]
  return {
    emoji: tipo.emoji.trim(),
    clase: color.clase,
    texto: tipo.nombre,
    fondo: color.fondo,
    textoColor: color.texto,
    borde: color.borde,
  }
}

export function clonarTipoEvento(tipo: TipoEventoConfig): TipoEventoConfig {
  return {
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    emoji: tipo.emoji,
    color: colorTipoEvento(tipo.color),
    sistema: tipo.sistema === true || esTipoEventoSistema(tipo.codigo),
  }
}
