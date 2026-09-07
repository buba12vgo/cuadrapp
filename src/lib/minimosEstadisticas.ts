import {
  DIAS_SEMANA_CONFIG,
  type DiaSemana,
  type MinimosSemana,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'

const TURNOS: TurnoOperativo[] = ['M', 'T', 'N']

export function sumatoriosDia(
  dia: DiaSemana,
  puestos: { nombre: string }[],
  minimos: MinimosSemana,
) {
  const porTurno = { M: 0, T: 0, N: 0 }
  for (const puesto of puestos) {
    const fila = minimos[dia][puesto.nombre]
    if (!fila) continue
    porTurno.M += fila.M
    porTurno.T += fila.T
    porTurno.N += fila.N
  }
  return {
    ...porTurno,
    total: porTurno.M + porTurno.T + porTurno.N,
  }
}

export function estadisticasMinimosSemana(
  puestos: { nombre: string }[],
  minimos: MinimosSemana,
) {
  const porDia = DIAS_SEMANA_CONFIG.map((item) => ({
    dia: item.dia,
    clave: item.clave,
    label: item.label,
    ...sumatoriosDia(item.dia, puestos, minimos),
  }))

  const porTurnoSemana = { M: 0, T: 0, N: 0 }
  let totalSemanal = 0
  let picoTurno = 0

  for (const dia of porDia) {
    porTurnoSemana.M += dia.M
    porTurnoSemana.T += dia.T
    porTurnoSemana.N += dia.N
    totalSemanal += dia.total
    for (const turno of TURNOS) {
      picoTurno = Math.max(picoTurno, dia[turno])
    }
  }

  const diaMayor = porDia.reduce((mejor, actual) =>
    actual.total > mejor.total ? actual : mejor,
  )
  const diaMenor = porDia.reduce((mejor, actual) =>
    actual.total < mejor.total ? actual : mejor,
  )

  const maxTurnoSemana = Math.max(
    porTurnoSemana.M,
    porTurnoSemana.T,
    porTurnoSemana.N,
  )

  return {
    porDia,
    porTurnoSemana,
    totalSemanal,
    picoTurno,
    diaMayor,
    diaMenor,
    maxTurnoSemana,
  }
}

export type CategoriaPuestoMinimos =
  | 'Accesos y controles'
  | 'Patrullas'
  | 'Cruceros y puerto'
  | 'General'

export function categoriaDePuesto(puesto: {
  nombre: string
  codigo: string
}): CategoriaPuestoMinimos {
  const texto = `${puesto.nombre} ${puesto.codigo}`.toLowerCase()
  if (/crucero|puerto|lonja|atlántida|atlantida/.test(texto)) {
    return 'Cruceros y puerto'
  }
  if (/patrulla|motor|seguridad/.test(texto)) {
    return 'Patrullas'
  }
  if (/control|retén|reten|berbés|berbes|acceso/.test(texto)) {
    return 'Accesos y controles'
  }
  return 'General'
}

export const ORDEN_CATEGORIAS_MINIMOS: CategoriaPuestoMinimos[] = [
  'Accesos y controles',
  'Cruceros y puerto',
  'Patrullas',
  'General',
]

export function agruparPuestosPorCategoria<
  T extends { nombre: string; codigo: string },
>(puestos: T[]) {
  const mapa = new Map<CategoriaPuestoMinimos, T[]>()
  for (const cat of ORDEN_CATEGORIAS_MINIMOS) mapa.set(cat, [])
  for (const puesto of puestos) {
    const cat = categoriaDePuesto(puesto)
    mapa.get(cat)?.push(puesto)
  }
  return ORDEN_CATEGORIAS_MINIMOS
    .map((categoria) => ({ categoria, puestos: mapa.get(categoria) ?? [] }))
    .filter((grupo) => grupo.puestos.length > 0)
}
