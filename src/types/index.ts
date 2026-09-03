export type RolPolicia =
  | 'RESPONSABLE'
  | 'JEFE_SERVICIO'
  | 'JEFE_EQUIPO'
  | 'POLICIA'
  | 'POLICIA_BOLSA'

export type Turno = 'M' | 'T' | 'N' | 'L' | 'D' | 'V'

export type TipoEvento =
  | 'FESTIVO'
  | 'CRUCERO'
  | 'CONCIERTO'
  | 'OPERATIVA_ESPECIAL'

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
}

export interface EventoOperativo {
  id: string
  fecha: string
  tipo: TipoEvento
  descripcion: string
  modificadoresMinimos: Record<string, { M: number; T: number; N: number }>
}
