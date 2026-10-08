export type RolPolicia =
  | 'RESPONSABLE'
  | 'JEFE_SERVICIO'
  | 'JEFE_EQUIPO'
  | 'POLICIA'
  | 'POLICIA_BOLSA'

/** `MT` = Mañana+Tarde, fines de semana y festivos en cuadrante de jefes.
 *  `P` = Permiso (tipos configurables: AP, EF, IT, LPD…).
 *  `L` = Libranza (cuadrante operativo legacy; en jefes se usa `P`).
 *  Jornada Disponible no es un turno: se marca sobre M/T/N/MT. */
export type Turno = 'M' | 'T' | 'N' | 'MT' | 'L' | 'P' | 'D' | 'V'

import type { TipoEvento } from '@/lib/tiposEvento'

export type { TipoEvento }

export interface Limitaciones {
  M: boolean
  T: boolean
  N: boolean
}

export type PatronPreferenciaAnual = '4-4-3' | '4-3-4' | '5-3-3'
export type ModoPreferenciaAnual = PatronPreferenciaAnual | 'SIN_PREFERENCIA'

export interface PreferenciaAnual {
  /** Ausente en fichas legacy con objetivos personalizados. */
  modo?: ModoPreferenciaAnual
  objetivoM: number
  objetivoT: number
  objetivoN: number
}

export interface FichaPolicia {
  id: string
  numeroPlaca: string
  nombre: string
  apellidos: string
  rolBase: RolPolicia
  limitaciones: Limitaciones
  preferenciaAnual: PreferenciaAnual
  puestosExcluidos: string[]
  mesAnclaVacaciones: 'JUNIO' | 'JULIO' | 'AGOSTO' | 'SEPTIEMBRE'
  /**
   * Año de referencia del mes ancla. El mes de la ficha es el de 2026;
   * los demás años rotan Jun → Jul → Sep → Ago.
   */
  anioReferenciaVacaciones?: number
  /**
   * Tope anual por código de permiso (anula el del catálogo).
   * DAA no se guarda aquí: sale del cierre del 31 de diciembre
   * o del saldo inicial puesto a mano.
   */
  cuposPermiso?: Record<string, number>
  /** Snapshot por año, sobre todo el cupo de Días del Año Anterior. */
  cuposPermisoAnio?: Record<string, Record<string, number>>
}

export interface EventoOperativo {
  id: string
  fecha: string
  tipo: TipoEvento
  descripcion: string
  modificadoresMinimos: Record<string, { M: number; T: number; N: number }>
}
