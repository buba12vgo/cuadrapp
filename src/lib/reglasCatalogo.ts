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
      'El generador mensual reparte bloques de trabajo con tope de 5 jornadas. El cuadrante avisa si la racha supera 5 días, incluyendo días del mes anterior.',
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
      'El generador mensual usa 3 D de separación tras turnos N. El cuadrante marca «Saliente de noche insuficiente», consultando hasta 14 días del mes anterior.',
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
    detalle:
      'Se señala en el cuadrante mensual. El día 1 consulta el último turno del mes anterior.',
  },
  {
    id: 'transicion-n-t',
    categoria: 'TURNOS',
    titulo: 'Noche → Tarde',
    descripcion:
      'Prohibido encadenar noche (N) y tarde (T) del día siguiente con menos de 12 horas de descanso.',
    estado: 'implementada',
    detalle:
      'Se señala en el cuadrante mensual. El día 1 consulta el último turno del mes anterior.',
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
      'Tras un mes de noche no se puede volver a hacer noche en los dos meses siguientes del mismo año. Marzo N no permite noche otra vez hasta junio como muy pronto. Diciembre N bloquea enero del año siguiente (meses seguidos); febrero sí puede ser N si hace falta para las preferencias.',
    estado: 'implementada',
    detalle:
      'La separación de dos meses es lineal y solo dentro del año. Entre años solo se prohíben meses consecutivos: diciembre N impide enero N. Febrero del año siguiente puede ser N. Diciembre N dos años seguidos sigue prohibido por otra regla. Autogenerar respeta estas normas; la edición manual de una celda no se bloquea (el aviso queda en la celda).',
    referencia: 'generarPlanAnual · puedeNoche · MESES_SIN_N_TRAS_NOCHE = 2',
  },
  {
    id: 'separacion-tardes-plan',
    categoria: 'TURNOS',
    titulo: 'No repetir tardes en el plan anual',
    descripcion:
      'Se procura no repetir tarde al mes siguiente. Ocasionalmente se permiten dos meses seguidos de tarde si hace falta para los cupos o las preferencias; tres o más se evitan.',
    estado: 'implementada',
    detalle:
      'Autogenerar coloca primero tardes aisladas y, si faltan cupos, admite pares. Diciembre T del año anterior cuenta para la racha de enero. En edición manual el cambio no se bloquea; la celda avisa si hay dos o más T seguidas.',
    referencia: 'generarPlanAnual · puedeTarde · MAX_TARDES_SEGUIDAS = 2',
  },
  {
    id: 'minimos-puesto-turno',
    categoria: 'PUESTOS',
    titulo: 'Mínimos de cobertura por puesto',
    descripcion:
      'Cada puesto tiene un mínimo de agentes por turno (M/T/N) configurable por día de la semana. El cuadrante mensual pinta en rojo el total M/T/N si no llega a la suma de esos mínimos (con eventos del calendario).',
    estado: 'implementada',
    referencia: 'MinimosPage · minimosSemana · totalMinimosTurno',
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
    titulo: 'Rotación de vacaciones',
    descripcion:
      'El mes de la ficha es el de 2026. En 2027 toca el siguiente del ciclo Junio → Julio → Septiembre → Agosto (y vuelve a Junio).',
    estado: 'implementada',
    detalle:
      'Autogenerar coloca la V en el mes efectivo de ese año. El año de referencia del ancla es siempre 2026, aunque la ficha tuviera otro valor guardado.',
    referencia: 'vacaciones.ts · mesVacacionesCiclo · anioReferenciaVacaciones',
  },
  {
    id: 'autogenerar-solo-anio',
    categoria: 'PLAN_ANUAL',
    titulo: 'Autogenerar un solo año',
    descripcion:
      'Autogenerar Año regenera únicamente el año seleccionado en el plan anual. Los planes de años anteriores y posteriores no se modifican.',
    estado: 'implementada',
    detalle:
      'Cambiar de año en el selector no crea ni borra planes. Autogenerar Año hace hasta 3 pasadas de refinado (swaps, reasignación parcial y equilibrio mensual) antes de mostrar el resultado. Limpiar año vacía solo el año seleccionado (dos confirmaciones). Diciembre del año anterior solo se consulta (regla N), no se reescribe.',
    referencia: 'PlanAnualPage · autogenerar · planAnualStore · planesAnuales',
  },
  {
    id: 'limpiar-plan-anual',
    categoria: 'PLAN_ANUAL',
    titulo: 'Limpiar el año del plan anual',
    descripcion:
      'Limpiar año deja en blanco solo el año seleccionado, con dos confirmaciones, para poder meter el cuadrante real y generar el siguiente con las normas de fin de año (diciembre N, enero, etc.).',
    estado: 'implementada',
    detalle:
      'No se tocan los demás años ni los % objetivo. Tras vaciar, las celdas se pueden rellenar a mano. Autogenerar el año siguiente consulta diciembre del año ya editado.',
    referencia: 'PlanAnualPage · limpiarAnio · savePlanAnual',
  },
  {
    id: 'diciembre-noche-no-repetir',
    categoria: 'PLAN_ANUAL',
    titulo: 'Diciembre noche sin repetición anual',
    descripcion:
      'Si un agente trabajó noche (N) en diciembre un año, no puede volver a tener N en diciembre del año siguiente en el plan anual.',
    estado: 'implementada',
    detalle:
      'Al autogenerar se consulta diciembre del año anterior y no se asigna N. En edición manual el cambio se aplica igual; la celda muestra el aviso si incumple.',
    referencia: 'generarPlanAnual · diciembreNProhibido · validarTurnoEnPlan',
  },
  {
    id: 'tolerancia-plan-anual',
    categoria: 'PLAN_ANUAL',
    titulo: 'Cuadre de porcentajes anuales',
    descripcion:
      'El plan intenta cuadrar el reparto M/T/N de la plantilla con una tolerancia de ±2 puntos porcentuales.',
    estado: 'implementada',
    detalle:
      'El semáforo compara el % mostrado con el objetivo global con tolerancia de ±2 puntos porcentuales en M, T y N. Al editar una celda a mano el turno se aplica aunque incumpla normas para poder completar el ciclo.',
    referencia: 'TOLERANCIA_PCT_PLAN = 2 · validarTurnoEnPlan',
  },
  {
    id: 'cobertura-equilibrada-mes',
    categoria: 'CUADRANTE',
    titulo: 'Cobertura equilibrada en el mes',
    descripcion:
      'Al autogenerar el cuadrante mensual no se cubre desde el día 1 dejando el final a cero. Los descansos se desfasan entre agentes y se reequilibra para que, si falta gente, no falten todos el mismo día.',
    estado: 'implementada',
    detalle:
      'El generador reparte el descanso sobrante en huecos distintos según el agente y mueve jornadas de días saturados a días cortos, respetando fatiga, descansos de 2+ y salida de noche.',
    referencia: 'generarCuadranteMensual · equilibrarCoberturaDiaria',
  },
  {
    id: 'findes-consecutivos-max',
    categoria: 'CUADRANTE',
    titulo: 'Fines de semana consecutivos',
    descripcion:
      'No se pueden trabajar más de 2 fines de semana seguidos. Sábado y domingo van juntos: o se trabajan los dos o se descansan los dos. Se procura alternar los findes laborables, priorizando cubrir los mínimos operativos.',
    estado: 'implementada',
    detalle:
      'Al generar el cuadrante se unifican findes partidos y se mueve el finde entero (sábado+domingo) si hay que cortar una racha. El pie muestra la racha máxima (Fs). Un sábado laborable con domingo de descanso (o al revés) se marca en rojo.',
    referencia: 'finesSemana · unificarFindesPartidos · MAX_FINDES_CONSECUTIVOS = 2',
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
