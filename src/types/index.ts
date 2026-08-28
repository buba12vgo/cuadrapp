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

export interface PreferenciaAnual {
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
}

export interface EventoOperativo {
  id: string
  fecha: string
  tipo: TipoEvento
  descripcion: string
  modificadoresMinimos: Record<string, { M: number; T: number; N: number }>
}
