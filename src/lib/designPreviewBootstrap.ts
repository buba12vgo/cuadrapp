import { hydrateAgentes } from '@/lib/agentesStore'
import { mockEventosCalendario } from '@/lib/calendarioPuestos'
import { hydrateEventos } from '@/lib/eventosStore'
import { mockAgentes } from '@/lib/mockData'
import {
  generarPlanAnual,
  OBJETIVOS_PLAN_DEFECTO,
} from '@/lib/generarPlanAnual'
import { hydratePlanesAnuales } from '@/lib/planAnualStore'
import { PERMISOS_INICIALES } from '@/lib/permisos'
import { hydrateTiposPermiso } from '@/lib/permisosStore'
import { ANIO_REFERENCIA_VACACIONES_DEFECTO } from '@/lib/vacaciones'

/** Datos locales para auditar la UI sin Firestore. */
export function bootstrapDesignPreview() {
  hydrateAgentes(mockAgentes)
  hydrateEventos(mockEventosCalendario)
  hydrateTiposPermiso(PERMISOS_INICIALES)

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
