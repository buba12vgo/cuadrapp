import { useMemo } from 'react'
import { puestoEnCelda } from '@/lib/asignacionPuestos'
import {
  etiquetaTurnoServicio,
  opcionesCambioDia,
  type OpcionCambioDia,
} from '@/lib/solicitudes'
import { esRolCuadranteJefes } from '@/lib/rolesCuadrante'
import { useCuadranteJefesMes } from '@/lib/useCuadranteJefesMes'
import { useCuadranteOperativoMes } from '@/lib/useCuadranteOperativoMes'
import { FOCUS_RING } from '@/lib/uiStyles'
import type { FichaPolicia, Turno } from '@/types'

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function partir(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return { anio: anio || 0, mes: mes || 0, dia: dia || 0 }
}

function etiquetaDia(iso: string) {
  const { anio, mes, dia } = partir(iso)
  const nombre = DIAS[new Date(anio, mes - 1, dia).getDay()] ?? ''
  return `${dia} ${nombre}`
}

export function ListaCambiosDia({
  agente,
  fecha,
  fechaFin,
  companeroId,
  onElegir,
}: {
  agente: FichaPolicia
  fecha: string
  fechaFin: string
  companeroId: string
  onElegir: (opcion: OpcionCambioDia) => void
}) {
  const elegida = partir(fecha)
  const jefatura = esRolCuadranteJefes(agente.rolBase)
  const operativo = useCuadranteOperativoMes(elegida.anio, elegida.mes)
  const jefes = useCuadranteJefesMes(elegida.anio, elegida.mes)
  const datos = jefatura ? jefes : operativo
  const plantilla = jefatura ? jefes.jefes : operativo.operativos
  const puestos = useMemo(
    () =>
      datos.puestos.filter((puesto) =>
        puesto.ambito === (jefatura ? 'JEFE_SERVICIO' : 'OPERATIVO'),
      ),
    [datos.puestos, jefatura],
  )
  const turno = (datos.cuadrante[agente.id]?.[elegida.dia - 1] ?? 'D') as Turno
  const trabaja = turno === 'M' || turno === 'T' || turno === 'N' || turno === 'MT'
  const opciones = useMemo(() => {
    if (!trabaja) return []
    const nombres = new Map(
      plantilla.map((item) => [
        item.id,
        {
          placa: item.numeroPlaca,
          nombre: `${item.nombre} ${item.apellidos}`.trim(),
        },
      ]),
    )
    return opcionesCambioDia({
      cuadrante: datos.cuadrante,
      asignaciones: datos.asignaciones,
      anio: elegida.anio,
      mes: elegida.mes,
      diaLibre: elegida.dia,
      agenteId: agente.id,
      nombres,
    }).map((opcion) => {
      const puesto = puestoEnCelda(
        datos.asignaciones,
        opcion.fecha,
        opcion.agenteId,
        opcion.turno,
        puestos,
      )
      return {
        ...opcion,
        puesto: puesto ? `${puesto.abreviatura} ${puesto.nombre}` : opcion.puesto,
      }
    })
  }, [agente.id, datos.asignaciones, datos.cuadrante, elegida.anio, elegida.dia, elegida.mes, plantilla, puestos, trabaja])

  const grupos = useMemo(() => {
    const mapa = new Map<string, OpcionCambioDia[]>()
    for (const opcion of opciones) {
      const lista = mapa.get(opcion.fecha) ?? []
      lista.push(opcion)
      mapa.set(opcion.fecha, lista)
    }
    return [...mapa.entries()]
  }, [opciones])

  if (datos.loading) {
    return <p className="text-xs text-slate-500">Buscando cambios posibles…</p>
  }
  if (!trabaja) {
    return (
      <p className="text-sm text-slate-600">
        Elige un día que trabajes. Solo se puede librar un día de servicio.
      </p>
    )
  }
  if (grupos.length === 0) {
    return (
      <p className="text-sm text-slate-600">
        No hay compañeros de {etiquetaTurnoServicio(turno)} que puedan cambiarte un día este mes.
      </p>
    )
  }

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-600">
        Libras el {etiquetaDia(fecha)} de {etiquetaTurnoServicio(turno)}. Elige el día que
        compensas y el compañero.
      </p>
      <ul className="flex flex-col gap-2">
        {grupos.map(([dia, lista]) => (
          <li key={dia} className="rounded-lg border border-slate-200">
            <p className="border-b border-slate-100 px-2 py-1 text-xs font-bold capitalize text-slate-700">
              {etiquetaDia(dia)} · {etiquetaTurnoServicio(lista[0]?.turno ?? turno)}
            </p>
            <ul>
              {lista.map((opcion) => {
                const activo = fechaFin === opcion.fecha && companeroId === opcion.agenteId
                return (
                  <li key={`${opcion.fecha}-${opcion.agenteId}`}>
                    <button
                      type="button"
                      aria-pressed={activo}
                      className={`flex w-full items-baseline justify-between gap-2 px-2 py-1.5 text-left text-xs ${FOCUS_RING} ${
                        activo ? 'bg-brand-50 text-brand-900' : 'hover:bg-slate-50'
                      }`}
                      onClick={() => onElegir(opcion)}
                    >
                      <span className="font-semibold">
                        {opcion.placa} {opcion.nombre}
                      </span>
                      <span className="truncate text-slate-500">
                        {opcion.puesto ?? 'Sin puesto'}
                      </span>
                    </button>
                  </li>
                )
              })}
            </ul>
          </li>
        ))}
      </ul>
    </div>
  )
}
