import { hydrateAgentes } from '@/lib/agentesStore'
import {
  crearMinimosSemana,
  mockEventosCalendario,
  PUESTOS_INICIALES,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import { hydrateEventos } from '@/lib/eventosStore'
import { mockAgentes } from '@/lib/mockData'
import type { FichaPolicia } from '@/types'
import {
  generarPlanAnual,
  OBJETIVOS_PLAN_DEFECTO,
} from '@/lib/generarPlanAnual'
import { hydratePlanesAnuales } from '@/lib/planAnualStore'
import { PERMISOS_INICIALES } from '@/lib/permisos'
import { hydrateTiposPermiso } from '@/lib/permisosStore'
import { TIPOS_EVENTO_INICIALES } from '@/lib/tiposEvento'
import { hydrateTiposEvento } from '@/lib/tiposEventoStore'
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
    orden: 1,
  },
]

const AGENTES_PREVIEW: FichaPolicia[] = [
  ...mockAgentes,
  {
    id: 'ag-bolsa',
    numeroPlaca: '2001',
    nombre: 'Iago',
    apellidos: 'Bolsa Nieto',
    rolBase: 'POLICIA_BOLSA',
    limitaciones: { M: true, T: true, N: true },
    preferenciaAnual: {
      modo: '5-3-3',
      objetivoM: 5,
      objetivoT: 3,
      objetivoN: 3,
    },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'JUNIO',
    anioReferenciaVacaciones: 2026,
  },
  {
    id: 'ag-443',
    numeroPlaca: '1110',
    nombre: 'Lucía',
    apellidos: 'Costa Méndez',
    rolBase: 'POLICIA',
    limitaciones: { M: true, T: true, N: true },
    preferenciaAnual: {
      modo: '4-4-3',
      objetivoM: 4,
      objetivoT: 4,
      objetivoN: 3,
    },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'JULIO',
    anioReferenciaVacaciones: 2026,
  },
  {
    id: 'ag-533',
    numeroPlaca: '1112',
    nombre: 'Nerea',
    apellidos: 'Silva Ríos',
    rolBase: 'JEFE_EQUIPO',
    limitaciones: { M: true, T: true, N: true },
    preferenciaAnual: {
      modo: '5-3-3',
      objetivoM: 5,
      objetivoT: 3,
      objetivoN: 3,
    },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'AGOSTO',
    anioReferenciaVacaciones: 2026,
  },
  {
    id: 'ag-flex',
    numeroPlaca: '1114',
    nombre: 'Hugo',
    apellidos: 'Lema Paz',
    rolBase: 'POLICIA',
    limitaciones: { M: true, T: true, N: true },
    preferenciaAnual: {
      modo: 'SIN_PREFERENCIA',
      objetivoM: 4,
      objetivoT: 4,
      objetivoN: 3,
    },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'SEPTIEMBRE',
    anioReferenciaVacaciones: 2026,
  },
]

/** Datos locales para el usuario Cursor, sin Firestore. */
export function bootstrapDesignPreview() {
  hydrateAgentes(AGENTES_PREVIEW)
  hydrateEventos(mockEventosCalendario)
  hydratePuestosYMinimos(PUESTOS_AGENTE, crearMinimosSemana(PUESTOS_AGENTE))
  hydrateTiposPermiso(PERMISOS_INICIALES)
  hydrateTiposEvento(TIPOS_EVENTO_INICIALES)
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
    AGENTES_PREVIEW,
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
