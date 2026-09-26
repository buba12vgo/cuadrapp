import {
  puestosPermitidosParaAgente,
} from '@/lib/asignacionPuestos'
import type {
  AsignacionesDiarias,
  MinimosDia,
  PuestoConfig,
  TurnoOperativo,
} from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { esJornadaDisponible } from '@/lib/jornadaDisponible'
import type { FichaPolicia } from '@/types'

const TURNOS: TurnoOperativo[] = ['M', 'T', 'N']

/** Orden de reparto de quien ya no hace falta para cubrir un mínimo. */
const CLAVES_PATRULLA_SOBRANTE = ['muelles', 'arenal', 'bouzas'] as const

export type ResultadoCompletarAsignaciones = {
  asignaciones: AsignacionesDiarias
  asignadas: number
  sinPuesto: number
}

function sinAcentos(valor: string) {
  return valor.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
}

function placaDe(agente: FichaPolicia) {
  const numero = Number.parseInt(agente.numeroPlaca, 10)
  return Number.isFinite(numero) ? numero : Number.MAX_SAFE_INTEGER
}

function compararAgentes(a: FichaPolicia, b: FichaPolicia) {
  const placa = placaDe(a) - placaDe(b)
  if (placa !== 0) return placa
  return a.id.localeCompare(b.id)
}

function clonarAsignaciones(actual: AsignacionesDiarias): AsignacionesDiarias {
  const copia: AsignacionesDiarias = {}
  for (const [fecha, porTurno] of Object.entries(actual)) {
    copia[fecha] = {}
    for (const [turno, porAgente] of Object.entries(porTurno)) {
      copia[fecha][turno as TurnoOperativo] = { ...porAgente }
    }
  }
  return copia
}

/** Patrulla Muelles, Arenal y Bouzas, en ese orden, si existen en el catálogo. */
export function patrullasSobrante(puestos: PuestoConfig[]) {
  const operativos = puestos.filter((puesto) => puesto.ambito === 'OPERATIVO')
  const usadas = new Set<string>()
  const elegidas: PuestoConfig[] = []
  for (const clave of CLAVES_PATRULLA_SOBRANTE) {
    const candidatos = operativos.filter((puesto) => {
      if (usadas.has(puesto.codigo)) return false
      return sinAcentos(`${puesto.nombre} ${puesto.codigo}`).includes(clave)
    })
    candidatos.sort((a, b) => {
      const ap = sinAcentos(a.nombre).includes('patrulla') ? 0 : 1
      const bp = sinAcentos(b.nombre).includes('patrulla') ? 0 : 1
      if (ap !== bp) return ap - bp
      return a.nombre.localeCompare(b.nombre, 'es')
    })
    const elegido = candidatos[0]
    if (!elegido) continue
    usadas.add(elegido.codigo)
    elegidas.push(elegido)
  }
  return elegidas
}

/**
 * Rellena puestos vacíos del mes.
 * Primero cubre los mínimos con puestos habilitados para cada agente.
 * Quien sobra se reparte entre Patrulla Muelles, Patrulla Arenal y Patrulla Bouzas.
 * No cambia una celda que ya tiene puesto ni una Jornada Disponible.
 */
export function completarAsignacionesMes(opts: {
  cuadrante: CuadranteMensual
  asignaciones: AsignacionesDiarias
  agentes: FichaPolicia[]
  puestos: PuestoConfig[]
  minimosDeFecha: (fecha: string) => MinimosDia
  anio: number
  mes: number
  nDias: number
  isoFecha: (anio: number, mes: number, dia: number) => string
}): ResultadoCompletarAsignaciones {
  const operativos = opts.puestos.filter((puesto) => puesto.ambito === 'OPERATIVO')
  const patrullas = patrullasSobrante(operativos)
  const codigosPatrulla = new Set(patrullas.map((puesto) => puesto.codigo))
  const resto = operativos.filter((puesto) => !codigosPatrulla.has(puesto.codigo))
  const ordenMinimos = [...resto, ...patrullas]
  const copia = clonarAsignaciones(opts.asignaciones)
  let asignadas = 0
  let sinPuesto = 0

  const permitidosDe = new Map<string, string[]>()
  function permitidos(agente: FichaPolicia) {
    const ya = permitidosDe.get(agente.id)
    if (ya) return ya
    const nombres = puestosPermitidosParaAgente(agente, operativos, 'OPERATIVO')
    permitidosDe.set(agente.id, nombres)
    return nombres
  }

  function colocar(
    fecha: string,
    turno: TurnoOperativo,
    agenteId: string,
    puesto: string,
    ocupacion: Map<string, number>,
  ) {
    if (!copia[fecha]) copia[fecha] = {}
    const porAgente = { ...(copia[fecha][turno] ?? {}) }
    porAgente[agenteId] = puesto
    copia[fecha] = { ...copia[fecha], [turno]: porAgente }
    ocupacion.set(puesto, (ocupacion.get(puesto) ?? 0) + 1)
    asignadas += 1
  }

  for (let dia = 1; dia <= opts.nDias; dia += 1) {
    const fecha = opts.isoFecha(opts.anio, opts.mes, dia)
    const minimos = opts.minimosDeFecha(fecha)
    for (const turno of TURNOS) {
      const trabajando = opts.agentes
        .filter((agente) => opts.cuadrante[agente.id]?.[dia - 1] === turno)
        .sort(compararAgentes)
      const ocupacion = new Map<string, number>()
      const libres: FichaPolicia[] = []
      for (const agente of trabajando) {
        const actual = copia[fecha]?.[turno]?.[agente.id]
        if (!actual) {
          libres.push(agente)
          continue
        }
        if (!esJornadaDisponible(actual)) {
          ocupacion.set(actual, (ocupacion.get(actual) ?? 0) + 1)
        }
      }

      function deficit(nombre: string) {
        const minimo = minimos[nombre]?.[turno] ?? 0
        return Math.max(0, minimo - (ocupacion.get(nombre) ?? 0))
      }

      function candidatosDe(nombre: string) {
        return libres.filter((agente) => permitidos(agente).includes(nombre))
      }

      while (libres.length > 0) {
        const necesitados = ordenMinimos.filter(
          (puesto) =>
            deficit(puesto.nombre) > 0 && candidatosDe(puesto.nombre).length > 0,
        )
        if (necesitados.length === 0) break
        necesitados.sort((a, b) => {
          const diferencia =
            candidatosDe(a.nombre).length - candidatosDe(b.nombre).length
          if (diferencia !== 0) return diferencia
          return ordenMinimos.indexOf(a) - ordenMinimos.indexOf(b)
        })
        const puesto = necesitados[0]!
        const otros = ordenMinimos.filter(
          (item) => item.nombre !== puesto.nombre && deficit(item.nombre) > 0,
        )
        const candidatos = candidatosDe(puesto.nombre).sort((a, b) => {
          const fa = otros.filter((item) => permitidos(a).includes(item.nombre)).length
          const fb = otros.filter((item) => permitidos(b).includes(item.nombre)).length
          if (fa !== fb) return fa - fb
          return compararAgentes(a, b)
        })
        const agente = candidatos[0]!
        colocar(fecha, turno, agente.id, puesto.nombre, ocupacion)
        const indice = libres.findIndex((item) => item.id === agente.id)
        if (indice >= 0) libres.splice(indice, 1)
      }

      for (const agente of [...libres]) {
        const puede = patrullas.filter((puesto) =>
          permitidos(agente).includes(puesto.nombre),
        )
        if (puede.length === 0) {
          sinPuesto += 1
          continue
        }
        puede.sort((a, b) => {
          const ca = ocupacion.get(a.nombre) ?? 0
          const cb = ocupacion.get(b.nombre) ?? 0
          if (ca !== cb) return ca - cb
          return patrullas.indexOf(a) - patrullas.indexOf(b)
        })
        colocar(fecha, turno, agente.id, puede[0]!.nombre, ocupacion)
        const indice = libres.findIndex((item) => item.id === agente.id)
        if (indice >= 0) libres.splice(indice, 1)
      }
    }
  }

  return { asignaciones: copia, asignadas, sinPuesto }
}
