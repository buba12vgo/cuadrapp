import type {
  AsignacionesDiarias,
  MinimosDia,
  PuestoConfig,
  TurnoOperativo,
} from '@/lib/calendarioPuestos'
import { abreviaturaDesdePuestos } from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { esJornadaDisponible } from '@/lib/jornadaDisponible'
import type { FichaPolicia, Turno } from '@/types'

export const TURNOS_COBERTURA: TurnoOperativo[] = ['M', 'T', 'N']

export type NivelSemaforo = 'verde' | 'ambar' | 'rojo'

export const ETIQUETA_SEMAFORO: Record<NivelSemaforo, string> = {
  verde: 'Dos o más por encima del mínimo',
  ambar: 'Uno por encima del mínimo',
  rojo: 'Justo en el mínimo o falta gente',
}

export const CLASE_SEMAFORO: Record<NivelSemaforo, string> = {
  verde: 'bg-emerald-500',
  ambar: 'bg-amber-400',
  rojo: 'bg-rose-500',
}

/** Verde con 2 o más de sobra, ámbar con 1, rojo si está justo o por debajo. */
export function nivelSemaforo(trabajando: number, minimo: number): NivelSemaforo {
  const sobrante = trabajando - minimo
  if (sobrante >= 2) return 'verde'
  if (sobrante === 1) return 'ambar'
  return 'rojo'
}

export type PersonaServicio = {
  id: string
  placa: string
  nombre: string
}

export type LineaPuestoDia = {
  turno: TurnoOperativo
  puesto: string
  abreviatura: string
  minimo: number
  personas: PersonaServicio[]
}

export type PersonaTurno = PersonaServicio & { turno: TurnoOperativo }

export type CoberturaTurno = {
  turno: TurnoOperativo
  trabajando: number
  minimo: number
  sobrante: number
  nivel: NivelSemaforo
}

export type ResumenDiaServicio = {
  turnos: Record<TurnoOperativo, CoberturaTurno>
  lineas: LineaPuestoDia[]
  sinPuesto: PersonaTurno[]
  jornadaDisponible: PersonaTurno[]
}

function nombrePersona(agente: FichaPolicia) {
  return `${agente.nombre} ${agente.apellidos}`.trim()
}

function personaDe(agente: FichaPolicia): PersonaServicio {
  return {
    id: agente.id,
    placa: agente.numeroPlaca,
    nombre: nombrePersona(agente),
  }
}

function placaDe(agente: FichaPolicia) {
  const numero = Number.parseInt(agente.numeroPlaca, 10)
  return Number.isFinite(numero) ? numero : Number.MAX_SAFE_INTEGER
}

function esTurnoCobertura(turno: Turno | undefined): turno is TurnoOperativo {
  return turno === 'M' || turno === 'T' || turno === 'N'
}

export function resumenDiaServicio(opts: {
  cuadrante: CuadranteMensual
  asignaciones: AsignacionesDiarias
  agentes: FichaPolicia[]
  puestos: PuestoConfig[]
  minimos: MinimosDia
  fecha: string
  dia: number
}): ResumenDiaServicio {
  const operativos = opts.puestos.filter((puesto) => puesto.ambito === 'OPERATIVO')
  const porTurno = new Map<TurnoOperativo, FichaPolicia[]>()
  for (const turno of TURNOS_COBERTURA) porTurno.set(turno, [])

  for (const agente of opts.agentes) {
    const turno = opts.cuadrante[agente.id]?.[opts.dia - 1]
    if (!esTurnoCobertura(turno)) continue
    porTurno.get(turno)?.push(agente)
  }
  for (const lista of porTurno.values()) {
    lista.sort((a, b) => placaDe(a) - placaDe(b) || a.id.localeCompare(b.id))
  }

  const turnos = {} as Record<TurnoOperativo, CoberturaTurno>
  for (const turno of TURNOS_COBERTURA) {
    const gente = porTurno.get(turno)?.length ?? 0
    let minimoTurno = 0
    for (const puesto of operativos) {
      minimoTurno += opts.minimos[puesto.nombre]?.[turno] ?? 0
    }
    turnos[turno] = {
      turno,
      trabajando: gente,
      minimo: minimoTurno,
      sobrante: gente - minimoTurno,
      nivel: nivelSemaforo(gente, minimoTurno),
    }
  }

  const lineas: LineaPuestoDia[] = []
  const sinPuesto: PersonaTurno[] = []
  const jornadaDisponible: PersonaTurno[] = []
  const asignados = opts.asignaciones[opts.fecha] ?? {}

  for (const turno of TURNOS_COBERTURA) {
    const gente = porTurno.get(turno) ?? []
    const porPuesto = new Map<string, PersonaServicio[]>()
    for (const puesto of operativos) porPuesto.set(puesto.nombre, [])

    for (const agente of gente) {
      const puesto = asignados[turno]?.[agente.id]
      if (!puesto) {
        sinPuesto.push({ ...personaDe(agente), turno })
        continue
      }
      if (esJornadaDisponible(puesto)) {
        jornadaDisponible.push({ ...personaDe(agente), turno })
        continue
      }
      const lista = porPuesto.get(puesto)
      if (lista) lista.push(personaDe(agente))
      else sinPuesto.push({ ...personaDe(agente), turno })
    }

    for (const puesto of operativos) {
      const personas = porPuesto.get(puesto.nombre) ?? []
      const cupo = opts.minimos[puesto.nombre]?.[turno] ?? 0
      if (cupo <= 0 && personas.length === 0) continue
      lineas.push({
        turno,
        puesto: puesto.nombre,
        abreviatura: abreviaturaDesdePuestos(operativos, puesto.nombre),
        minimo: cupo,
        personas,
      })
    }
  }

  return {
    turnos,
    lineas,
    sinPuesto,
    jornadaDisponible,
  }
}
