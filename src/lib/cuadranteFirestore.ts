import {
  type AsignacionesDiarias,
  type PuestoBase,
  type PuestoConfig,
  type TurnoOperativo,
  abreviaturaDesdePuestos,
} from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { getPuestos } from '@/lib/puestosStore'
import type { FichaPolicia, Turno } from '@/types'

const TURNOS: Turno[] = ['M', 'T', 'N', 'L', 'D', 'V']

export type CeldaCuadranteFirestore = {
  t: Turno
  p?: string
}

export type CuadranteMensualFirestore = {
  anio: number
  mes: number
  agentes: Record<string, CeldaCuadranteFirestore[]>
  actualizadoEn?: string
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

export function idDocumentoCuadrante(anio: number, mes: number) {
  return `${anio}-${pad(mes)}`
}

function esTurno(valor: unknown): valor is Turno {
  return typeof valor === 'string' && TURNOS.includes(valor as Turno)
}

function esTurnoOperativo(turno: Turno): turno is TurnoOperativo {
  return turno === 'M' || turno === 'T' || turno === 'N'
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function mapaAbrevAPuesto(puestos: PuestoConfig[]) {
  return Object.fromEntries(
    puestos.map((puesto) => [puesto.abreviatura, puesto.nombre]),
  ) as Record<string, PuestoBase>
}

function puestoDesdeAbrev(
  abrev: string | undefined,
  puestos: PuestoConfig[],
): PuestoBase | null {
  if (!abrev) return null
  return mapaAbrevAPuesto(puestos)[abrev] ?? null
}

export function cuadranteVacio(
  agentes: FichaPolicia[],
  nDias: number,
): CuadranteMensual {
  const result: CuadranteMensual = {}
  for (const agente of agentes) {
    result[agente.id] = Array.from({ length: nDias }, () => 'D')
  }
  return result
}

export function cuadranteParaFirestore(
  cuadrante: CuadranteMensual,
  asignaciones: AsignacionesDiarias,
  agentes: FichaPolicia[],
  anio: number,
  mes: number,
  nDias: number,
  puestos: PuestoConfig[] = getPuestos(),
): CuadranteMensualFirestore {
  const agentesFirestore: Record<string, CeldaCuadranteFirestore[]> = {}

  for (const agente of agentes) {
    const fila = cuadrante[agente.id] ?? []
    const dias: CeldaCuadranteFirestore[] = []

    for (let dia = 1; dia <= nDias; dia++) {
      const turno = fila[dia - 1] ?? 'D'
      const celda: CeldaCuadranteFirestore = { t: turno }
      if (esTurnoOperativo(turno)) {
        const fecha = isoFecha(anio, mes, dia)
        const puesto = asignaciones[fecha]?.[turno]?.[agente.id]
        if (puesto) celda.p = abreviaturaDesdePuestos(puestos, puesto)
      }
      dias.push(celda)
    }

    agentesFirestore[agente.numeroPlaca] = dias
  }

  return {
    anio,
    mes,
    agentes: agentesFirestore,
    actualizadoEn: new Date().toISOString(),
  }
}

export function cuadranteDesdeFirestore(
  datos: CuadranteMensualFirestore,
  agentes: FichaPolicia[],
  anio: number,
  mes: number,
  nDias: number,
  puestos: PuestoConfig[] = getPuestos(),
): { cuadrante: CuadranteMensual; asignaciones: AsignacionesDiarias } {
  const placaAId = new Map(
    agentes.map((agente) => [agente.numeroPlaca, agente.id]),
  )
  const cuadrante = cuadranteVacio(agentes, nDias)
  const asignaciones: AsignacionesDiarias = {}

  for (const [placa, dias] of Object.entries(datos.agentes ?? {})) {
    const agenteId = placaAId.get(placa)
    if (!agenteId || !Array.isArray(dias)) continue

    for (let indice = 0; indice < Math.min(nDias, dias.length); indice++) {
      const raw = dias[indice]
      if (!raw || typeof raw !== 'object') continue
      const turno = esTurno(raw.t) ? raw.t : 'D'
      cuadrante[agenteId][indice] = turno

      const dia = indice + 1
      const puesto = puestoDesdeAbrev(
        typeof raw.p === 'string' ? raw.p : undefined,
        puestos,
      )
      if (puesto && esTurnoOperativo(turno)) {
        const fecha = isoFecha(anio, mes, dia)
        if (!asignaciones[fecha]) asignaciones[fecha] = {}
        if (!asignaciones[fecha][turno]) asignaciones[fecha][turno] = {}
        asignaciones[fecha][turno]![agenteId] = puesto
      }
    }
  }

  return { cuadrante, asignaciones }
}

export function parseCuadranteFirestore(
  data: Record<string, unknown>,
): CuadranteMensualFirestore | null {
  const anio = typeof data.anio === 'number' ? data.anio : null
  const mes = typeof data.mes === 'number' ? data.mes : null
  if (!anio || !mes) return null

  const agentesRaw = data.agentes
  if (!agentesRaw || typeof agentesRaw !== 'object') {
    return { anio, mes, agentes: {} }
  }

  const agentes: Record<string, CeldaCuadranteFirestore[]> = {}
  for (const [placa, diasRaw] of Object.entries(
    agentesRaw as Record<string, unknown>,
  )) {
    if (!Array.isArray(diasRaw)) continue
    const dias: CeldaCuadranteFirestore[] = []
    for (const item of diasRaw) {
      if (!item || typeof item !== 'object') {
        dias.push({ t: 'D' })
        continue
      }
      const raw = item as Record<string, unknown>
      const turno = esTurno(raw.t) ? raw.t : 'D'
      const celda: CeldaCuadranteFirestore = { t: turno }
      if (typeof raw.p === 'string' && raw.p.trim()) celda.p = raw.p.trim()
      dias.push(celda)
    }
    agentes[placa] = dias
  }

  return {
    anio,
    mes,
    agentes,
    actualizadoEn:
      typeof data.actualizadoEn === 'string' ? data.actualizadoEn : undefined,
  }
}
