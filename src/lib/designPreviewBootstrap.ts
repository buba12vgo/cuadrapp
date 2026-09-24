import { hydrateAgentes } from '@/lib/agentesStore'
import {
  crearMinimosSemana,
  mockEventosCalendario,
  PUESTOS_INICIALES,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import { hydrateEventos } from '@/lib/eventosStore'
import { mockAgentes } from '@/lib/mockData'
import {
  generarPlanAnual,
  OBJETIVOS_PLAN_DEFECTO,
} from '@/lib/generarPlanAnual'
import { hydratePlanesAnuales } from '@/lib/planAnualStore'
import { PERMISOS_INICIALES } from '@/lib/permisos'
import { hydrateTiposPermiso } from '@/lib/permisosStore'
import { hydratePuestosYMinimos } from '@/lib/puestosStore'
import { sembrarUsuarioPreview } from '@/lib/usuariosAcceso'
import { ANIO_REFERENCIA_VACACIONES_DEFECTO } from '@/lib/vacaciones'

const PUESTOS_AGENTE: PuestoConfig[] = [
  ...PUESTOS_INICIALES,
  {
    codigo: 'JEFE_SERVICIO',
    nombre: 'Jefe de servicio',
    abreviatura: 'JS',
    ambito: 'JEFE_SERVICIO',
  },
]

/** Datos locales para el usuario Cursor, sin Firestore. */
export function bootstrapDesignPreview() {
  hydrateAgentes(mockAgentes)
  hydrateEventos(mockEventosCalendario)
  hydratePuestosYMinimos(PUESTOS_AGENTE, crearMinimosSemana(PUESTOS_AGENTE))
  hydrateTiposPermiso(PERMISOS_INICIALES)
  sembrarUsuarioPreview({
    uid: 'preview-consulta-elena',
    email: 'elena.jefa@cuadrapp.local',
    rolAcceso: 'CONSULTA_JEFES',
    numeroPlaca: '1001',
    agenteId: 'ag-001',
    nombre: 'Elena Vázquez Souto',
    activo: true,
    creadoEn: '2026-01-01T00:00:00.000Z',
    puedeEditarEventos: false,
  })

  const anio = ANIO_REFERENCIA_VACACIONES_DEFECTO
  const resultado = generarPlanAnual(
    mockAgentes,
    OBJETIVOS_PLAN_DEFECTO,
    anio,
    {},
    { grupo: 'OPERATIVO' },
  )
  hydratePlanesAnuales(
    { [anio]: resultado.plan },
    { [anio]: OBJETIVOS_PLAN_DEFECTO },
  )
}
