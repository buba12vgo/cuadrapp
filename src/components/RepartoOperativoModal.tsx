import { useEffect, useMemo, useState } from 'react'
import {
  ABREV_PUESTO,
  PUESTOS_BASE,
  puestoExcluidoParaAgente,
  type MinimosDia,
  type PuestoBase,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import type { FichaPolicia } from '@/types'

const TURNOS: TurnoOperativo[] = ['M', 'T', 'N']
const TURNO_LABEL: Record<TurnoOperativo, string> = {
  M: 'Mañana',
  T: 'Tarde',
  N: 'Noche',
}

const CAMPO =
  'h-7 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-700'

function claseContador(ocupacion: number, minimo: number) {
  return ocupacion >= minimo
    ? 'bg-green-100 font-bold text-green-800'
    : 'bg-red-200 font-bold text-red-900'
}

export function RepartoOperativoModal({
  dia,
  fecha,
  agentes,
  cuadrante,
  minimos,
  asignacionesDia,
  onGuardar,
  onCerrar,
}: {
  dia: number
  fecha: string
  agentes: FichaPolicia[]
  cuadrante: CuadranteMensual
  minimos: MinimosDia
  asignacionesDia: Partial<Record<TurnoOperativo, Record<string, PuestoBase>>>
  onGuardar: (
    asignaciones: Partial<Record<TurnoOperativo, Record<string, PuestoBase>>>,
  ) => void
  onCerrar: () => void
}) {
  const [turnoActivo, setTurnoActivo] = useState<TurnoOperativo>('M')
  const [borrador, setBorrador] = useState(asignacionesDia)

  useEffect(() => {
    setBorrador(asignacionesDia)
    setTurnoActivo('M')
  }, [fecha, asignacionesDia])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  const bolsa = useMemo(
    () =>
      agentes.filter(
        (agente) => cuadrante[agente.id]?.[dia - 1] === turnoActivo,
      ),
    [agentes, cuadrante, dia, turnoActivo],
  )

  const asignacionesTurno = borrador[turnoActivo] ?? {}

  const ocupacion = useMemo(() => {
    const conteo: Record<PuestoBase, number> = {
      'Centro de Control': 0,
      Lonjas: 0,
      'Berbés Acceso': 0,
      Retén: 0,
    }
    for (const puesto of Object.values(asignacionesTurno)) {
      if (puesto) conteo[puesto] += 1
    }
    return conteo
  }, [asignacionesTurno])

  function asignar(agenteId: string, puesto: PuestoBase | '') {
    setBorrador((actual) => {
      const turno = { ...(actual[turnoActivo] ?? {}) }
      if (puesto === '') delete turno[agenteId]
      else turno[agenteId] = puesto
      return { ...actual, [turnoActivo]: turno }
    })
  }

  function guardar() {
    onGuardar(borrador)
  }

  return (
    <div
      className="fixed inset-0 z-[70] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCerrar}
    >
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="reparto-titulo"
        className="flex max-h-[90vh] w-full max-w-4xl flex-col border border-slate-300 bg-white shadow-xl"
        onClick={(event) => event.stopPropagation()}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 px-4 py-3">
          <div>
            <h2 id="reparto-titulo" className="text-sm font-bold text-slate-900">
              Reparto operativo: Día {dia}
            </h2>
            <p className="text-xs text-slate-500">{fecha}</p>
          </div>
          <button
            type="button"
            className="text-xs font-semibold text-slate-500 hover:text-slate-800"
            onClick={onCerrar}
          >
            Cerrar
          </button>
        </header>

        <div className="flex gap-1 border-b border-slate-200 px-4 pt-2">
          {TURNOS.map((turno) => (
            <button
              key={turno}
              type="button"
              className={`px-3 py-1.5 text-xs font-semibold ${
                turnoActivo === turno
                  ? 'border-b-2 border-slate-900 text-slate-900'
                  : 'text-slate-500 hover:text-slate-700'
              }`}
              onClick={() => setTurnoActivo(turno)}
            >
              {TURNO_LABEL[turno]} ({turno})
            </button>
          ))}
        </div>

        <div className="grid min-h-0 flex-1 grid-cols-2 gap-3 overflow-auto p-4">
          <section className="flex min-h-0 flex-col border border-slate-200">
            <h3 className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700">
              Bolsa de agentes ({bolsa.length})
            </h3>
            <ul className="min-h-0 flex-1 overflow-auto">
              {bolsa.length === 0 ? (
                <li className="px-2 py-3 text-xs text-slate-500">
                  Nadie con turno {turnoActivo} este día.
                </li>
              ) : (
                bolsa.map((agente) => (
                  <li
                    key={agente.id}
                    className="flex items-center gap-2 border-b border-slate-100 px-2 py-1.5"
                  >
                    <span className="min-w-0 flex-1 truncate text-xs">
                      <span className="font-mono font-bold">
                        {agente.numeroPlaca}
                      </span>{' '}
                      <span className="text-slate-700">
                        {agente.nombre} {agente.apellidos}
                      </span>
                    </span>
                    <select
                      className={`${CAMPO} w-36 shrink-0`}
                      value={asignacionesTurno[agente.id] ?? ''}
                      onChange={(event) =>
                        asignar(
                          agente.id,
                          event.target.value as PuestoBase | '',
                        )
                      }
                    >
                      <option value="">Sin puesto</option>
                      {PUESTOS_BASE.map((puesto) => (
                        <option
                          key={puesto}
                          value={puesto}
                          disabled={puestoExcluidoParaAgente(
                            agente.puestosExcluidos,
                            puesto,
                          )}
                        >
                          {ABREV_PUESTO[puesto]} · {puesto}
                          {puestoExcluidoParaAgente(
                            agente.puestosExcluidos,
                            puesto,
                          )
                            ? ' (excluido)'
                            : ''}
                        </option>
                      ))}
                    </select>
                  </li>
                ))
              )}
            </ul>
          </section>

          <section className="flex min-h-0 flex-col border border-slate-200">
            <h3 className="border-b border-slate-200 bg-slate-50 px-2 py-1.5 text-[11px] font-bold text-slate-700">
              Puestos a cubrir · mínimos exigidos
            </h3>
            <ul className="flex flex-col gap-2 p-2">
              {PUESTOS_BASE.map((puesto) => {
                const minimo = minimos[puesto][turnoActivo]
                const actual = ocupacion[puesto]
                return (
                  <li
                    key={puesto}
                    className="border border-slate-200 bg-white px-2 py-2"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-semibold text-slate-800">
                        {puesto}
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs tabular-nums ${claseContador(
                          actual,
                          minimo,
                        )}`}
                      >
                        [ {actual} / {minimo} ]
                      </span>
                    </div>
                    <ul className="mt-1 space-y-0.5">
                      {bolsa
                        .filter(
                          (agente) => asignacionesTurno[agente.id] === puesto,
                        )
                        .map((agente) => (
                          <li
                            key={agente.id}
                            className="text-[11px] text-slate-600"
                          >
                            {agente.numeroPlaca} · {agente.nombre}
                          </li>
                        ))}
                      {bolsa.every(
                        (agente) => asignacionesTurno[agente.id] !== puesto,
                      ) ? (
                        <li className="text-[11px] text-slate-400">—</li>
                      ) : null}
                    </ul>
                  </li>
                )
              })}
            </ul>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            className="h-8 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            onClick={onCerrar}
          >
            Cancelar
          </button>
          <button
            type="button"
            className="h-8 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800"
            onClick={guardar}
          >
            Guardar reparto
          </button>
        </footer>
      </div>
    </div>
  )
}
