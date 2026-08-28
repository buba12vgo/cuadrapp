import {
  filaVaciaPlanAnual,
  type ObjetivosGlobales,
  type PlanAnual,
  type TurnoAnual,
} from '@/lib/generarPlanAnual'
import type { FichaPolicia } from '@/types'

const MESES = 12

export type PlanAnualFirestore = {
  anio: number
  agentes: Record<string, (TurnoAnual | null)[]>
  objetivos?: ObjetivosGlobales
  actualizadoEn?: string
}

export function idDocumentoPlanAnual(anio: number) {
  return String(anio)
}

function esTurnoAnual(valor: unknown): valor is TurnoAnual {
  return valor === 'M' || valor === 'T' || valor === 'N' || valor === 'V'
}

function parseFila(valor: unknown): (TurnoAnual | null)[] {
  const fila = filaVaciaPlanAnual()
  if (!Array.isArray(valor)) return fila
  for (let i = 0; i < MESES; i++) {
    const celda = valor[i]
    if (celda == null) {
      fila[i] = null
    } else if (esTurnoAnual(celda)) {
      fila[i] = celda
    } else {
      fila[i] = null
    }
  }
  return fila
}

export function parseObjetivosGlobales(
  valor: unknown,
): ObjetivosGlobales | null {
  if (!valor || typeof valor !== 'object') return null
  const raw = valor as Record<string, unknown>
  const leer = (n: unknown) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return null
    return Math.min(100, Math.max(0, n))
  }
  const M = leer(raw.M)
  const T = leer(raw.T)
  const N = leer(raw.N)
  if (M == null || T == null || N == null) return null
  return { M, T, N }
}

export function parsePlanAnualFirestore(
  docId: string,
  data: Record<string, unknown>,
): PlanAnualFirestore | null {
  const anioDesdeId = Number(docId)
  const anio =
    typeof data.anio === 'number' && Number.isFinite(data.anio)
      ? Math.round(data.anio)
      : Number.isInteger(anioDesdeId)
        ? anioDesdeId
        : null
  if (anio == null || anio < 2000 || anio > 2100) return null

  const agentes: Record<string, (TurnoAnual | null)[]> = {}
  const agentesRaw = data.agentes
  if (agentesRaw && typeof agentesRaw === 'object') {
    for (const [placa, fila] of Object.entries(
      agentesRaw as Record<string, unknown>,
    )) {
      const clave = placa.trim()
      if (!clave) continue
      agentes[clave] = parseFila(fila)
    }
  }

  const objetivos = parseObjetivosGlobales(data.objetivos) ?? undefined

  return {
    anio,
    agentes,
    objetivos,
    actualizadoEn:
      typeof data.actualizadoEn === 'string' ? data.actualizadoEn : undefined,
  }
}

export function planDesdeFirestore(
  datos: PlanAnualFirestore,
  agentes: FichaPolicia[],
): PlanAnual {
  const placaAId = new Map(
    agentes.map((agente) => [agente.numeroPlaca, agente.id]),
  )
  const plan: PlanAnual = {}
  for (const [placa, fila] of Object.entries(datos.agentes)) {
    const id = placaAId.get(placa) ?? placa
    plan[id] = [...fila]
  }
  return plan
}

export function planParaFirestore(
  plan: PlanAnual,
  agentes: FichaPolicia[],
): Record<string, (TurnoAnual | null)[]> {
  const idAPlaca = new Map(
    agentes.map((agente) => [agente.id, agente.numeroPlaca]),
  )
  const agentesFs: Record<string, (TurnoAnual | null)[]> = {}
  for (const [id, fila] of Object.entries(plan)) {
    const placa = (idAPlaca.get(id) ?? id).trim()
    if (!placa) continue
    const normalizada = filaVaciaPlanAnual()
    for (let i = 0; i < MESES; i++) {
      const celda = fila[i]
      normalizada[i] = esTurnoAnual(celda) ? celda : null
    }
    agentesFs[placa] = normalizada
  }
  return agentesFs
}
