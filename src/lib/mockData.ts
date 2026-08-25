import type { FichaPolicia } from '@/types'

export const mockAgentes: FichaPolicia[] = [
  {
    id: 'ag-001',
    numeroPlaca: '1001',
    nombre: 'Elena',
    apellidos: 'Vázquez Souto',
    rolBase: 'RESPONSABLE',
    limitaciones: {
      soloManana: true,
      soloMananaNoche: false,
      exentoNoches: false,
    },
    preferenciaAnual: { objetivoM: 11, objetivoT: 0, objetivoN: 0 },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'JUNIO',
  },
  {
    id: 'ag-002',
    numeroPlaca: '1020',
    nombre: 'Marcos',
    apellidos: 'Rivas Freire',
    rolBase: 'JEFE_SERVICIO',
    limitaciones: {
      soloManana: false,
      soloMananaNoche: false,
      exentoNoches: false,
    },
    preferenciaAnual: { objetivoM: 4, objetivoT: 4, objetivoN: 3 },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'JULIO',
  },
  {
    id: 'ag-003',
    numeroPlaca: '1108',
    nombre: 'Xoán',
    apellidos: 'Pérez Otero',
    rolBase: 'POLICIA',
    limitaciones: {
      soloManana: false,
      soloMananaNoche: true,
      exentoNoches: false,
    },
    preferenciaAnual: { objetivoM: 4, objetivoT: 0, objetivoN: 7 },
    puestosExcluidos: ['LONJAS'],
    mesAnclaVacaciones: 'AGOSTO',
  },
]
