import { useMemo, useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { puestoEnCelda } from '@/lib/asignacionPuestos'
import { minimosParaFecha } from '@/lib/calendarioPuestos'
import {
  CLASE_SEMAFORO,
  ETIQUETA_SEMAFORO,
  resumenDiaServicio,
  type NivelSemaforo,
} from '@/lib/coberturaDia'
import { esDiaTrabajado, esFinDeSemana } from '@/lib/convenio'
import { celdasMesCalendario } from '@/lib/exportarCalendarioJefesPdf'
import { esFestivo } from '@/lib/festivos'
import { useMinimosSemanaData } from '@/lib/puestosStore'
import { esRolCuadranteJefes } from '@/lib/rolesCuadrante'
import { useCuadranteJefesMes } from '@/lib/useCuadranteJefesMes'
import { useCuadranteOperativoMes } from '@/lib/useCuadranteOperativoMes'
import { BTN_GHOST, FOCUS_RING } from '@/lib/uiStyles'
import type { FichaPolicia, Turno } from '@/types'
import { MESES, isoFecha } from '@/lib/fechas'

const DIAS = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

const PILDORA: Record<Turno, string> = {
  M: 'bg-blue-100 text-blue-800',
  T: 'bg-orange-100 text-orange-800',
  N: 'bg-violet-100 text-violet-800',
  MT: 'bg-teal-100 text-teal-800',
  L: 'bg-rose-100 text-rose-800',
  P: 'bg-rose-100 text-rose-800',
  D: 'bg-slate-200 text-slate-500',
  V: 'bg-emerald-100 text-emerald-800',
}

function partir(iso: string) {
  const [anio, mes, dia] = iso.split('-').map(Number)
  return {
    anio: anio || new Date().getFullYear(),
    mes: mes || new Date().getMonth() + 1,
    dia: dia || 1,
  }
}

function mesVecino(anio: number, mes: number, delta: number) {
  const fecha = new Date(anio, mes - 1 + delta, 1)
  return { anio: fecha.getFullYear(), mes: fecha.getMonth() + 1 }
}

function etiquetaCorta(turno: Turno) {
  if (turno === 'MT') return 'M-T'
  if (turno === 'L') return 'P'
  return turno
}

function puntosDelTurno(turno: Turno, niveles: { M: NivelSemaforo; T: NivelSemaforo; N: NivelSemaforo }) {
  if (turno === 'M' || turno === 'T' || turno === 'N') {
    return [{ codigo: turno, nivel: niveles[turno] }]
  }
  if (turno === 'MT') {
    return [
      { codigo: 'M', nivel: niveles.M },
      { codigo: 'T', nivel: niveles.T },
    ]
  }
  return []
}

export function CalendarioSolicitudPermiso({
  agente,
  fecha,
  onElegir,
  soloDiasTrabajados = false,
}: {
  agente: FichaPolicia
  fecha: string
  onElegir: (iso: string) => void
  /** En un cambio de día solo se puede librar un día de servicio. */
  soloDiasTrabajados?: boolean
}) {
  const elegida = partir(fecha)
  const [vista, setVista] = useState({ anio: elegida.anio, mes: elegida.mes })
  const jefatura = esRolCuadranteJefes(agente.rolBase)
  const operativo = useCuadranteOperativoMes(vista.anio, vista.mes)
  const jefes = useCuadranteJefesMes(vista.anio, vista.mes)
  const datos = jefatura ? jefes : operativo
  const plantilla = jefatura ? jefes.jefes : operativo.operativos
  const [minimosSemana] = useMinimosSemanaData()
  const puestos = useMemo(
    () =>
      datos.puestos.filter((puesto) =>
        puesto.ambito === (jefatura ? 'JEFE_SERVICIO' : 'OPERATIVO'),
      ),
    [datos.puestos, jefatura],
  )
  const celdas = useMemo(
    () => celdasMesCalendario(vista.anio, vista.mes),
    [vista.anio, vista.mes],
  )
  const fila = datos.cuadrante[agente.id] ?? []
  const mismoMes = elegida.anio === vista.anio && elegida.mes === vista.mes

  return (
    <div className="flex flex-col gap-2">
      <div className="flex items-center justify-between gap-2">
        <button
          type="button"
          className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
          aria-label="Mes anterior"
          onClick={() => setVista((actual) => mesVecino(actual.anio, actual.mes, -1))}
        >
          <ChevronLeft className="h-4 w-4" />
        </button>
        <p className="text-sm font-bold text-slate-800">
          {MESES[vista.mes - 1]} {vista.anio}
        </p>
        <button
          type="button"
          className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
          aria-label="Mes siguiente"
          onClick={() => setVista((actual) => mesVecino(actual.anio, actual.mes, 1))}
        >
          <ChevronRight className="h-4 w-4" />
        </button>
      </div>
      <div className="overflow-hidden rounded-xl border border-slate-200">
        <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50">
          {DIAS.map((dia, indice) => (
            <div
              key={dia}
              className={`py-1 text-center text-[10px] font-bold uppercase ${
                indice >= 5 ? 'text-red-600' : 'text-slate-500'
              }`}
            >
              {dia}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-px bg-slate-200">
          {celdas.map((dia, indice) => {
            if (dia == null) {
              return <div key={`hueco-${indice}`} className="min-h-16 bg-slate-50" />
            }
            const turno = (fila[dia - 1] ?? 'D') as Turno
            const fechaDia = isoFecha(vista.anio, vista.mes, dia)
            const trabaja = esDiaTrabajado(turno)
            const especial = esFinDeSemana(vista.anio, vista.mes, dia) || esFestivo(vista.anio, vista.mes, dia)
            const puesto = puestoEnCelda(
              datos.asignaciones,
              fechaDia,
              agente.id,
              turno,
              puestos,
            )
            const semaforos = resumenDiaServicio({
              cuadrante: datos.cuadrante,
              asignaciones: datos.asignaciones,
              agentes: plantilla,
              puestos,
              minimos: minimosParaFecha(fechaDia, datos.eventos, minimosSemana, puestos),
              fecha: fechaDia,
              dia,
            }).turnos
            const puntos = puntosDelTurno(turno, {
              M: semaforos.M.nivel,
              T: semaforos.T.nivel,
              N: semaforos.N.nivel,
            })
            const seleccionado =
              mismoMes && elegida.dia === dia && (!soloDiasTrabajados || trabaja)
            const textoPuesto = puesto
              ? `${puesto.abreviatura} ${puesto.nombre}`
              : trabaja
                ? 'Sin puesto'
                : ''
            return (
              <button
                key={dia}
                type="button"
                aria-pressed={seleccionado}
                aria-label={`${dia} ${MESES[vista.mes - 1]}, ${etiquetaCorta(turno)}${
                  textoPuesto ? `, ${textoPuesto}` : ''
                }${puntos.map((punto) => `, ${punto.codigo} ${ETIQUETA_SEMAFORO[punto.nivel]}`).join('')}`}
                disabled={soloDiasTrabajados && !trabaja}
                className={`flex min-h-16 flex-col gap-0.5 p-1 text-left ${FOCUS_RING} ${
                  trabaja ? 'bg-white' : 'bg-slate-50'
                } ${seleccionado ? 'ring-2 ring-inset ring-brand-600' : ''} ${
                  soloDiasTrabajados && !trabaja ? 'cursor-default' : ''
                }`}
                onClick={() => {
                  if (soloDiasTrabajados && !trabaja) return
                  onElegir(fechaDia)
                }}
              >
                <span className="flex items-center justify-between gap-1">
                  <span
                    className={`text-xs font-extrabold tabular-nums ${
                      especial ? 'text-red-600' : trabaja ? 'text-slate-900' : 'text-slate-400'
                    }`}
                  >
                    {dia}
                  </span>
                  {puntos.length > 0 ? (
                    <span className="flex items-center gap-0.5">
                      {puntos.map((punto) => (
                        <span
                          key={punto.codigo}
                          className={`h-2 w-2 rounded-full ${CLASE_SEMAFORO[punto.nivel]}`}
                          title={`${punto.codigo}: ${ETIQUETA_SEMAFORO[punto.nivel]}`}
                        />
                      ))}
                    </span>
                  ) : null}
                </span>
                {trabaja ? (
                  <>
                    <span className={`w-fit rounded px-1 text-[10px] font-extrabold ${PILDORA[turno]}`}>
                      {etiquetaCorta(turno)}
                    </span>
                    <span className="truncate text-[10px] font-bold leading-tight text-slate-700" title={puesto?.nombre ?? 'Sin puesto'}>
                      {puesto ? `${puesto.abreviatura} ${puesto.nombre}` : 'Sin puesto'}
                    </span>
                  </>
                ) : (
                  <span className="text-[10px] font-semibold text-slate-400">
                    {turno === 'V' ? 'Vac' : turno === 'P' || turno === 'L' ? 'Perm' : 'Desc'}
                  </span>
                )}
              </button>
            )
          })}
        </div>
      </div>
      {datos.loading ? <p className="text-xs text-slate-500">Cargando el cuadrante…</p> : null}
    </div>
  )
}
