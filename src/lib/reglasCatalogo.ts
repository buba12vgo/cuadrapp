export type CategoriaRegla =
  | 'DIAS'
  | 'TURNOS'
  | 'PUESTOS'
  | 'PLANTILLA'
  | 'PLAN_ANUAL'
  | 'CUADRANTE'
  | 'CALENDARIO'

export type EstadoRegla = 'implementada' | 'parcial' | 'planificada'

export type ReglaCatalogo = {
  id: string
  categoria: CategoriaRegla
  titulo: string
  descripcion: string
  estado: EstadoRegla
  detalle?: string
  referencia?: string
}

export const CATEGORIA_LABEL: Record<CategoriaRegla, string> = {
  DIAS: 'Días y descansos',
  TURNOS: 'Turnos',
  PUESTOS: 'Puestos operativos',
  PLANTILLA: 'Plantilla y fichas',
  PLAN_ANUAL: 'Plan anual',
  CUADRANTE: 'Cuadrante mensual',
  CALENDARIO: 'Calendario y eventos',
}

export const ESTADO_LABEL: Record<EstadoRegla, string> = {
  implementada: 'Implementada',
  parcial: 'Parcial',
  planificada: 'Planificada',
}

export const ORDEN_CATEGORIAS: CategoriaRegla[] = [
  'DIAS',
  'TURNOS',
  'PUESTOS',
  'PLANTILLA',
  'PLAN_ANUAL',
  'CUADRANTE',
  'CALENDARIO',
]

/** Catálogo vivo de reglas y condicionantes del cuadrante. */
export const REGLAS_CATALOGO: ReglaCatalogo[] = [
  {
    id: 'dias-max-consecutivos',
    categoria: 'DIAS',
    titulo: 'Máximo de días seguidos trabajando',
    descripcion:
      'No deben trabajar más de 5 días seguidos. Excepcionalmente puede llegar a 6; a partir del sexto día operativo seguido se marca infracción.',
    estado: 'implementada',
    detalle:
      'El generador mensual reparte bloques de trabajo con tope de 5 jornadas. El cuadrante avisa si la racha supera 5 días.',
    referencia: 'MAX_DIAS_CONTINUOS = 5',
  },
  {
    id: 'descanso-minimo-seguido',
    categoria: 'DIAS',
    titulo: 'Descanso mínimo de 2 días',
    descripcion:
      'El descanso (D) debe ser de al menos 2 días contiguos. Nunca un día suelto entre jornadas.',
    estado: 'implementada',
    detalle:
      'Al generar el cuadrante se evitan bloques de un solo D. En edición manual se alerta «Descanso suelto».',
    referencia: 'MIN_DESCANSO_SEGUIDO = 2',
  },
  {
    id: 'descanso-tras-noche',
    categoria: 'DIAS',
    titulo: 'Salida de noche',
    descripcion:
      'Tras un bloque de noches, mínimo 3 días de descanso (D o V) antes de volver a mañana (M).',
    estado: 'implementada',
    detalle:
      'El generador mensual usa 3 D de separación tras turnos N. El cuadrante marca «Saliente de noche insuficiente».',
    referencia: 'MIN_DESCANSO_TRAS_NOCHE = 3',
  },
  {
    id: 'dias-operativos-convenio',
    categoria: 'DIAS',
    titulo: 'Días operativos de convenio',
    descripcion:
      '17 días operativos al mes (16 en febrero), repartidos entre M, T y N según preferencia y limitaciones.',
    estado: 'implementada',
    referencia: 'DIAS_OPERATIVOS_ESTANDAR / DIAS_OPERATIVOS_FEBRERO',
  },
  {
    id: 'transicion-t-m',
    categoria: 'TURNOS',
    titulo: 'Tarde → Mañana',
    descripcion:
      'Prohibido encadenar tarde (T) y mañana (M) del día siguiente con menos de 12 horas de descanso.',
    estado: 'implementada',
    detalle: 'Se señala en el cuadrante mensual al editar la celda.',
    referencia: 'reglasCuadrante · T_M',
  },
  {
    id: 'transicion-n-t',
    categoria: 'TURNOS',
    titulo: 'Noche → Tarde',
    descripcion:
      'Prohibido encadenar noche (N) y tarde (T) del día siguiente con menos de 12 horas de descanso.',
    estado: 'implementada',
    detalle: 'Se señala en el cuadrante mensual al editar la celda.',
    referencia: 'reglasCuadrante · N_T',
  },
  {
    id: 'turnos-permitidos-ficha',
    categoria: 'TURNOS',
    titulo: 'Turnos que puede hacer cada agente',
    descripcion:
      'En la ficha se marcan M, T y N. Solo los turnos activos entran en el plan anual y en la rotación.',
    estado: 'implementada',
    detalle: 'Por defecto los tres turnos están activos.',
    referencia: 'limitaciones · M / T / N',
  },
  {
    id: 'separacion-noches-plan',
    categoria: 'TURNOS',
    titulo: 'Separación entre noches en el plan anual',
    descripcion:
      'Las noches del plan anual se separan al menos 2–3 meses según la capacidad de la fila.',
    estado: 'implementada',
    referencia: 'generarPlanAnual · puedeNoche',
  },
  {
    id: 'minimos-puesto-turno',
    categoria: 'PUESTOS',
    titulo: 'Mínimos de cobertura por puesto',
    descripcion:
      'Cada puesto tiene un mínimo de agentes por turno (M/T/N) configurable por día de la semana.',
    estado: 'implementada',
    referencia: 'MinimosPage · minimosSemana',
  },
  {
    id: 'puesto-nuevo-plantilla',
    categoria: 'PUESTOS',
    titulo: 'Puesto nuevo activo en toda la plantilla',
    descripcion:
      'Al crear un puesto operativo queda habilitado por defecto para todos los agentes (modelo de exclusiones).',
    estado: 'implementada',
    referencia: 'puestosExcluidos',
  },
  {
    id: 'puestos-excluidos-agente',
    categoria: 'PUESTOS',
    titulo: 'Puestos por agente',
    descripcion:
      'En la ficha se pueden desactivar puestos concretos; no se asignan en bolsa, reparto ni cuadrante.',
    estado: 'implementada',
    referencia: 'puestosExcluidos · puestoExcluidoParaAgente',
  },
  {
    id: 'preferencia-anual',
    categoria: 'PLANTILLA',
    titulo: 'Preferencia anual M / T / N',
    descripcion:
      'Cada agente define objetivos de meses en mañana, tarde y noche; el resto son vacaciones (V).',
    estado: 'implementada',
    referencia: 'preferenciaAnual · objetivoM/T/N',
  },
  {
    id: 'mes-ancla-vacaciones',
    categoria: 'PLANTILLA',
    titulo: 'Mes de vacaciones',
    descripcion:
      'Mes ancla (junio–septiembre) en el que el plan anual coloca la V del agente.',
    estado: 'implementada',
    referencia: 'mesAnclaVacaciones',
  },
  {
    id: 'tolerancia-plan-anual',
    categoria: 'PLAN_ANUAL',
    titulo: 'Cuadre de porcentajes anuales',
    descripcion:
      'El plan intenta cuadrar el reparto M/T/N de la plantilla con una tolerancia de ±2 puntos porcentuales.',
    estado: 'implementada',
    referencia: 'TOLERANCIA_PCT_PLAN = 2',
  },
  {
    id: 'minimo-agentes-turno',
    categoria: 'CUADRANTE',
    titulo: 'Mínimo de agentes por turno y día',
    descripcion:
      'Debe haber al menos 10 agentes por turno operativo en cada día (regla de convenio pendiente de aplicar en generación).',
    estado: 'planificada',
    referencia: 'MINIMO_AGENTES_TURNO = 10',
  },
  {
    id: 'eventos-modifican-minimos',
    categoria: 'CALENDARIO',
    titulo: 'Eventos que modifican mínimos',
    descripcion:
      'Festivos, cruceros, conciertos y operativas especiales pueden alterar los mínimos del día en el calendario.',
    estado: 'implementada',
    referencia: 'CalendarioPage · modificadoresMinimos',
  },
]

export function reglasPorCategoria() {
  const mapa = new Map<CategoriaRegla, ReglaCatalogo[]>()
  for (const categoria of ORDEN_CATEGORIAS) {
    mapa.set(categoria, [])
  }
  for (const regla of REGLAS_CATALOGO) {
    mapa.get(regla.categoria)?.push(regla)
  }
  return mapa
}
