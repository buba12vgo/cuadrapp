export type TipoEvento = string

export type EstiloTipoEvento = {
  id: string
  etiqueta: string
  emoji: string
  clase: string
  pdf: { fondo: string; texto: string; borde: string }
}

export const ESTILOS_TIPO_EVENTO: EstiloTipoEvento[] = [
  {
    id: 'rojo',
    etiqueta: 'Rojo',
    emoji: '🔴',
    clase: 'bg-red-100 text-red-900',
    pdf: { fondo: '#fee2e2', texto: '#7f1d1d', borde: '#ef4444' },
  },
  {
    id: 'azul',
    etiqueta: 'Azul',
    emoji: '🚢',
    clase: 'bg-blue-100 text-blue-900',
    pdf: { fondo: '#dbeafe', texto: '#1e3a8a', borde: '#3b82f6' },
  },
  {
    id: 'amarillo',
    etiqueta: 'Amarillo',
    emoji: '🎵',
    clase: 'bg-yellow-100 text-yellow-900',
    pdf: { fondo: '#fef9c3', texto: '#713f12', borde: '#eab308' },
  },
  {
    id: 'violeta',
    etiqueta: 'Violeta',
    emoji: '🟣',
    clase: 'bg-violet-100 text-violet-900',
    pdf: { fondo: '#ede9fe', texto: '#5b21b6', borde: '#8b5cf6' },
  },
  {
    id: 'verde',
    etiqueta: 'Verde',
    emoji: '🟢',
    clase: 'bg-emerald-100 text-emerald-900',
    pdf: { fondo: '#d1fae5', texto: '#065f46', borde: '#10b981' },
  },
  {
    id: 'naranja',
    etiqueta: 'Naranja',
    emoji: '🟠',
    clase: 'bg-orange-100 text-orange-900',
    pdf: { fondo: '#ffedd5', texto: '#9a3412', borde: '#f97316' },
  },
  {
    id: 'slate',
    etiqueta: 'Gris',
    emoji: '⚪',
    clase: 'bg-slate-100 text-slate-700',
    pdf: { fondo: '#f1f5f9', texto: '#334155', borde: '#94a3b8' },
  },
]

export const CODIGO_TIPO_FESTIVO = 'FESTIVO'
export const CODIGO_TIPO_CRUCERO = 'CRUCERO'
export const CODIGO_TIPO_CONCIERTO = 'CONCIERTO'
export const CODIGO_TIPO_OPERATIVA = 'OPERATIVA_ESPECIAL'

export type TipoEventoConfig = {
  codigo: string
  nombre: string
  abreviatura: string
  estiloId: string
  esFestivo: boolean
  visible: boolean
  orden: number
  sistema?: boolean
}

export const TIPOS_EVENTO_INICIALES: TipoEventoConfig[] = [
  {
    codigo: CODIGO_TIPO_FESTIVO,
    nombre: 'Festivo',
    abreviatura: 'FES',
    estiloId: 'rojo',
    esFestivo: true,
    visible: true,
    orden: 1,
    sistema: true,
  },
  {
    codigo: CODIGO_TIPO_CRUCERO,
    nombre: 'Crucero',
    abreviatura: 'CRU',
    estiloId: 'azul',
    esFestivo: false,
    visible: true,
    orden: 2,
  },
  {
    codigo: CODIGO_TIPO_CONCIERTO,
    nombre: 'Concierto',
    abreviatura: 'CON',
    estiloId: 'amarillo',
    esFestivo: false,
    visible: true,
    orden: 3,
  },
  {
    codigo: CODIGO_TIPO_OPERATIVA,
    nombre: 'Mínimos especiales',
    abreviatura: 'ESP',
    estiloId: 'slate',
    esFestivo: false,
    visible: true,
    orden: 4,
    sistema: true,
  },
]

export function estiloTipoEvento(estiloId: string | undefined) {
  return (
    ESTILOS_TIPO_EVENTO.find((item) => item.id === estiloId) ??
    ESTILOS_TIPO_EVENTO[ESTILOS_TIPO_EVENTO.length - 1]!
  )
}

export function clonarTipoEvento(tipo: TipoEventoConfig): TipoEventoConfig {
  return { ...tipo, sistema: tipo.sistema === true }
}

export function ordenarTiposEvento(tipos: TipoEventoConfig[]) {
  return [...tipos].sort((a, b) => {
    if (a.orden !== b.orden) return a.orden - b.orden
    return a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' })
  })
}

export function tipoEventoEsSistema(tipo: Pick<TipoEventoConfig, 'codigo' | 'sistema'>) {
  if (tipo.sistema) return true
  return (
    tipo.codigo === CODIGO_TIPO_FESTIVO || tipo.codigo === CODIGO_TIPO_OPERATIVA
  )
}

export function tipoEventoEsFestivo(
  codigo: string,
  tipos: TipoEventoConfig[],
) {
  const cfg = tipos.find((item) => item.codigo === codigo)
  if (cfg) return cfg.esFestivo
  return codigo === CODIGO_TIPO_FESTIVO
}

export function etiquetaTipoEvento(
  codigo: string,
  tipos: TipoEventoConfig[],
): { emoji: string; clase: string; texto: string } {
  const cfg = tipos.find((item) => item.codigo === codigo)
  if (cfg) {
    const estilo = estiloTipoEvento(cfg.estiloId)
    return { emoji: estilo.emoji, clase: estilo.clase, texto: cfg.nombre }
  }
  const inicial = TIPOS_EVENTO_INICIALES.find((item) => item.codigo === codigo)
  if (inicial) {
    const estilo = estiloTipoEvento(inicial.estiloId)
    return { emoji: estilo.emoji, clase: estilo.clase, texto: inicial.nombre }
  }
  const estilo = estiloTipoEvento('slate')
  return { emoji: estilo.emoji, clase: estilo.clase, texto: codigo }
}

export function colorPdfTipoEvento(
  codigo: string,
  tipos: TipoEventoConfig[],
) {
  const cfg = tipos.find((item) => item.codigo === codigo)
  return estiloTipoEvento(cfg?.estiloId).pdf
}

export function tiposEventoVisibles(tipos: TipoEventoConfig[]) {
  return ordenarTiposEvento(tipos).filter((tipo) => tipo.visible !== false)
}

export function esCodigoTipoEvento(valor: unknown): valor is string {
  return typeof valor === 'string' && /^[A-Z][A-Z0-9_]{0,39}$/.test(valor)
}
