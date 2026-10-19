import type { FichaPolicia, RolPolicia } from '@/types'

/**
 * Plantilla operativa para mínimos y listados.
 * La bolsa cuenta en la dotación, pero no recibe cuadrante generado.
 */
export const ROLES_OPERATIVO_CUADRANTE: RolPolicia[] = [
  'JEFE_EQUIPO',
  'POLICIA',
  'POLICIA_BOLSA',
]

/** Policías y jefes de equipo: plan anual y cuadrante mensual. */
export const ROLES_CUADRANTE_GENERADO: RolPolicia[] = [
  'JEFE_EQUIPO',
  'POLICIA',
]

export const ROL_LABEL: Record<RolPolicia, string> = {
  RESPONSABLE: 'Responsable',
  JEFE_SERVICIO: 'Jefe de servicio',
  JEFE_EQUIPO: 'Jefe de equipo',
  POLICIA: 'Policía',
  POLICIA_BOLSA: 'Policía Bolsa',
}

export function esRolOperativoCuadrante(rol: RolPolicia): boolean {
  return (
    rol === 'POLICIA' ||
    rol === 'JEFE_EQUIPO' ||
    rol === 'POLICIA_BOLSA'
  )
}

/** La bolsa de trabajo no entra en el plan ni en el cuadrante autogenerado. */
export function esRolConCuadranteGenerado(rol: RolPolicia): boolean {
  return rol === 'POLICIA' || rol === 'JEFE_EQUIPO'
}

export function esRolJefeServicio(rol: RolPolicia): boolean {
  return rol === 'JEFE_SERVICIO'
}

/** Roles del cuadrante de jefes (jefes de servicio + responsables). */
export function esRolCuadranteJefes(rol: RolPolicia): boolean {
  return rol === 'JEFE_SERVICIO' || rol === 'RESPONSABLE'
}

/** Jefes de servicio y responsables salen del plan/cuadrante operativo. */
export function esRolFueraCuadranteOperativo(rol: RolPolicia): boolean {
  return esRolCuadranteJefes(rol)
}

export function agentesOperativosCuadrante(agentes: FichaPolicia[]) {
  return agentes.filter((agente) => esRolOperativoCuadrante(agente.rolBase))
}

export function agentesConCuadranteGenerado(agentes: FichaPolicia[]) {
  return agentes.filter((agente) => esRolConCuadranteGenerado(agente.rolBase))
}

export function agentesCuadranteJefes(agentes: FichaPolicia[]) {
  return agentes.filter((agente) => esRolCuadranteJefes(agente.rolBase))
}

/** @deprecated Usar agentesCuadranteJefes */
export function agentesJefesServicio(agentes: FichaPolicia[]) {
  return agentesCuadranteJefes(agentes)
}
