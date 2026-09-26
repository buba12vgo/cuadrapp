import { useMemo } from 'react'
import type { PlanAnual, TurnoAnual } from '@/lib/generarPlanAnual'
import { planParaAnio, usePlanAnual } from '@/lib/planAnualStore'
import {
  companerosCambioMes,
  companerosVacacionesMes,
  ETIQUETA_TURNO_ANUAL,
  NOMBRES_MES,
  turnoPlanMes,
  type CompaneroPlan,
} from '@/lib/solicitudes'
import { FOCUS_RING } from '@/lib/uiStyles'
import type { FichaPolicia } from '@/types'

const TURNOS_SERVICIO: TurnoAnual[] = ['M', 'T', 'N']

function partirMes(iso: string) {
  const [anio, mes] = iso.split('-').map(Number)
  return { anio: anio || new Date().getFullYear(), mes: mes || 1 }
}

export function SelectorCambioPlan({
  modo,
  agente,
  agentes,
  mes,
  turnoDestino,
  companeroId,
  onMes,
  onTurno,
  onCompanero,
}: {
  modo: 'MES' | 'VACACIONES'
  agente: FichaPolicia
  agentes: FichaPolicia[]
  mes: string
  turnoDestino: string
  companeroId: string
  onMes: (mes: string) => void
  onTurno: (turno: TurnoAnual) => void
  onCompanero: (companero: CompaneroPlan, turnoActual: TurnoAnual) => void
}) {
  const { cargado, plan: planActivo } = usePlanAnual()
  const { anio, mes: numeroMes } = partirMes(mes)
  const plan = useMemo(
    () => planParaAnio(anio),
    [anio, cargado, planActivo],
  )
  const turnoActual = turnoPlanMes(plan, agente.id, numeroMes - 1)
  const anios = [anio, new Date().getFullYear(), new Date().getFullYear() + 1]
  const aniosUnicos = [...new Set(anios)].sort((a, b) => a - b)

  return (
    <div className="flex flex-col gap-3">
      <div className="grid gap-2 sm:grid-cols-2">
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Año
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm"
            value={anio}
            onChange={(event) => onMes(`${event.target.value}-${String(numeroMes).padStart(2, '0')}`)}
          >
            {aniosUnicos.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </select>
        </label>
        <label className="flex flex-col gap-1 text-xs font-semibold text-slate-600">
          Mes
          <select
            className="h-9 rounded-lg border border-slate-200 bg-white px-2 text-sm capitalize"
            value={numeroMes}
            onChange={(event) =>
              onMes(`${anio}-${String(event.target.value).padStart(2, '0')}`)
            }
          >
            {NOMBRES_MES.map((nombre, indice) => (
              <option key={nombre} value={indice + 1}>
                {nombre}
              </option>
            ))}
          </select>
        </label>
      </div>
      <Cuerpo
        modo={modo}
        plan={plan}
        agente={agente}
        agentes={agentes}
        mesIndice={numeroMes - 1}
        turnoActual={turnoActual}
        turnoDestino={turnoDestino}
        companeroId={companeroId}
        onTurno={onTurno}
        onCompanero={onCompanero}
      />
    </div>
  )
}

function Cuerpo({
  modo,
  plan,
  agente,
  agentes,
  mesIndice,
  turnoActual,
  turnoDestino,
  companeroId,
  onTurno,
  onCompanero,
}: {
  modo: 'MES' | 'VACACIONES'
  plan: PlanAnual
  agente: FichaPolicia
  agentes: FichaPolicia[]
  mesIndice: number
  turnoActual: TurnoAnual | null
  turnoDestino: string
  companeroId: string
  onTurno: (turno: TurnoAnual) => void
  onCompanero: (companero: CompaneroPlan, turnoActual: TurnoAnual) => void
}) {
  if (!turnoActual) {
    return (
      <p className="text-sm text-slate-600">No hay turno asignado en el plan de ese mes.</p>
    )
  }
  if (modo === 'MES' && turnoActual === 'V') {
    return (
      <p className="text-sm text-slate-600">
        Ese mes estás de vacaciones. El cambio de mes es para un turno de servicio.
      </p>
    )
  }
  if (modo === 'VACACIONES' && turnoActual === 'V') {
    return <p className="text-sm text-slate-600">Ese mes ya estás de vacaciones.</p>
  }

  if (modo === 'VACACIONES') {
    const personas = companerosVacacionesMes({
      plan,
      agentes,
      agenteId: agente.id,
      mesIndice,
    })
    return (
      <div className="flex flex-col gap-2">
        <p className="text-xs font-semibold text-slate-600">
          Ese mes estás de {ETIQUETA_TURNO_ANUAL[turnoActual].toLowerCase()}. Elige quién está de
          vacaciones.
        </p>
        <ListaPersonas
          personas={personas}
          companeroId={companeroId}
          vacio="Nadie de tu cuadrante está de vacaciones ese mes."
          onElegir={(persona) => onCompanero(persona, turnoActual)}
        />
      </div>
    )
  }

  const destino = turnoDestino === 'M' || turnoDestino === 'T' || turnoDestino === 'N'
    ? turnoDestino
    : null
  const personas = destino
    ? companerosCambioMes({
        plan,
        agentes,
        agenteId: agente.id,
        mesIndice,
        turnoDestino: destino,
      })
    : []

  return (
    <div className="flex flex-col gap-2">
      <p className="text-xs font-semibold text-slate-600">
        Ese mes estás de {ETIQUETA_TURNO_ANUAL[turnoActual].toLowerCase()}. Elige el turno que
        necesitas.
      </p>
      <div className="flex flex-wrap gap-2">
        {TURNOS_SERVICIO.filter((turno) => turno !== turnoActual).map((turno) => (
          <button
            key={turno}
            type="button"
            aria-pressed={turnoDestino === turno}
            className={`rounded-lg border px-3 py-1.5 text-xs font-semibold ${FOCUS_RING} ${
              turnoDestino === turno
                ? 'border-brand-600 bg-brand-50 text-brand-900'
                : 'border-slate-200 bg-white hover:bg-slate-50'
            }`}
            onClick={() => onTurno(turno)}
          >
            {ETIQUETA_TURNO_ANUAL[turno]}
          </button>
        ))}
      </div>
      {destino ? (
        <ListaPersonas
          personas={personas}
          companeroId={companeroId}
          vacio={`No hay compañeros de ${ETIQUETA_TURNO_ANUAL[destino].toLowerCase()} ese mes.`}
          onElegir={(persona) => onCompanero(persona, turnoActual)}
        />
      ) : null}
    </div>
  )
}

function ListaPersonas({
  personas,
  companeroId,
  vacio,
  onElegir,
}: {
  personas: CompaneroPlan[]
  companeroId: string
  vacio: string
  onElegir: (persona: CompaneroPlan) => void
}) {
  if (personas.length === 0) {
    return <p className="text-sm text-slate-600">{vacio}</p>
  }
  return (
    <ul className="overflow-hidden rounded-lg border border-slate-200">
      {personas.map((persona) => {
        const activo = companeroId === persona.id
        return (
          <li key={persona.id}>
            <button
              type="button"
              aria-pressed={activo}
              className={`flex w-full items-baseline justify-between gap-2 px-2 py-1.5 text-left text-xs ${FOCUS_RING} ${
                activo ? 'bg-brand-50 text-brand-900' : 'hover:bg-slate-50'
              }`}
              onClick={() => onElegir(persona)}
            >
              <span className="font-semibold">
                {persona.placa} {persona.nombre}
              </span>
              <span className="text-slate-500">{ETIQUETA_TURNO_ANUAL[persona.turno]}</span>
            </button>
          </li>
        )
      })}
    </ul>
  )
}
