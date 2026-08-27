import { useMemo, useState } from 'react'
import { useAgentesData } from '@/lib/agentesStore'
import { usePlanAnual } from '@/lib/planAnualStore'
import {
  generarPlanAnual,
  siguienteTurno,
  vacacionesObjetivo,
  type ObjetivosGlobales,
  type TurnoAnual,
} from '@/lib/generarPlanAnual'
import type { FichaPolicia } from '@/types'

const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
] as const

const TOTALES = ['M', 'T', 'N', 'V'] as const
const TOLERANCIA_PCT = 2
const ANCHO_AGENTE = 140
const ANCHO_TOTAL = 28

const CELDA =
  'h-6 border border-slate-400 px-1 py-0 text-xs leading-none'
const CAMPO_PCT =
  'h-6 w-11 border border-slate-400 bg-white px-1 text-center text-xs text-slate-900 outline-none focus:border-slate-700'

const CLASE_TURNO: Record<TurnoAnual, string> = {
  M: 'bg-yellow-200 text-yellow-950',
  T: 'bg-orange-300 text-orange-950',
  N: 'bg-blue-300 text-blue-950',
  V: 'bg-gray-300 text-slate-800',
}

function totalesFila(turnos: TurnoAnual[]) {
  const totales = { M: 0, T: 0, N: 0, V: 0 }
  for (const turno of turnos) totales[turno] += 1
  return totales
}

function stickyDerecha(indice: number) {
  return {
    right: (TOTALES.length - 1 - indice) * ANCHO_TOTAL,
    minWidth: ANCHO_TOTAL,
    width: ANCHO_TOTAL,
  }
}

function porcentaje(cantidad: number, base: number) {
  if (base <= 0) return null
  return (cantidad / base) * 100
}

function claseSemaforo(real: number | null, objetivo: number) {
  if (real == null) return 'bg-gray-200 text-slate-500'
  return Math.abs(real - objetivo) <= TOLERANCIA_PCT
    ? 'bg-green-100 font-bold text-green-800'
    : 'bg-red-200 font-bold text-red-900'
}

function clasePreferencia(cuadra: boolean) {
  return cuadra
    ? 'bg-green-100 font-bold text-green-800'
    : 'bg-red-200 font-bold text-red-900'
}

function leerPorcentaje(valor: string) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.min(100, Math.max(0, n))
}

function cuadraTotal(
  totales: Record<TurnoAnual, number>,
  agente: FichaPolicia,
  clave: TurnoAnual,
) {
  if (clave === 'V') return totales.V === vacacionesObjetivo(agente)
  const objetivos = {
    M: agente.preferenciaAnual.objetivoM,
    T: agente.preferenciaAnual.objetivoT,
    N: agente.preferenciaAnual.objetivoN,
  }
  return totales[clave] === objetivos[clave]
}

export function PlanAnualPage() {
  const [agentesData] = useAgentesData()
  const [planAnual, setPlanAnual] = usePlanAnual()
  const [objetivosGlobales, setObjetivosGlobales] = useState<ObjetivosGlobales>({
    M: 34,
    T: 33,
    N: 33,
  })

  const totalesMes = useMemo(() => {
    const columnas = MESES.map(() => ({ M: 0, T: 0, N: 0, V: 0 }))
    for (const agente of agentesData) {
      const fila = planAnual[agente.id] ?? []
      fila.forEach((turno, mes) => {
        columnas[mes][turno] += 1
      })
    }
    return columnas
  }, [agentesData, planAnual])

  function rotarCelda(agente: FichaPolicia, mes: number) {
    setPlanAnual((actual) => {
      const fila = [...(actual[agente.id] ?? [])]
      const actualTurno = fila[mes]
      if (!actualTurno) return actual
      fila[mes] = siguienteTurno(agente, actualTurno)
      return { ...actual, [agente.id]: fila }
    })
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 py-1">
        <h1 className="text-xs font-bold text-slate-900">Plan anual</h1>
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-semibold text-slate-600">
            Objetivo global
          </span>
          {(['M', 'T', 'N'] as const).map((turno) => (
            <label key={turno} className="flex items-center gap-0.5">
              <span className="text-xs font-semibold text-slate-600">
                % {turno}
              </span>
              <input
                type="number"
                min={0}
                max={100}
                className={CAMPO_PCT}
                value={objetivosGlobales[turno]}
                onChange={(event) =>
                  setObjetivosGlobales((actual) => ({
                    ...actual,
                    [turno]: leerPorcentaje(event.target.value),
                  }))
                }
              />
            </label>
          ))}
          <button
            type="button"
            className="h-6 bg-slate-900 px-2 text-xs font-semibold text-white hover:bg-slate-700"
            onClick={() =>
              setPlanAnual(generarPlanAnual(agentesData, objetivosGlobales))
            }
          >
            Autogenerar Año
          </button>
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-slate-500 bg-white">
        <table className="w-full table-fixed border-separate border-spacing-0 text-xs leading-none">
          <thead>
            <tr>
              <th
                className={`${CELDA} sticky top-0 left-0 z-40 bg-white text-left font-bold`}
                style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
              >
                Agente
              </th>
              {MESES.map((mes) => (
                <th
                  key={mes}
                  className={`${CELDA} sticky top-0 z-20 bg-white font-bold`}
                >
                  {mes}
                </th>
              ))}
              {TOTALES.map((clave, indice) => (
                <th
                  key={clave}
                  className={`${CELDA} sticky top-0 z-30 bg-white font-bold ${
                    indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                  }`}
                  style={stickyDerecha(indice)}
                >
                  {clave}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {agentesData.map((agente) => {
              const fila = planAnual[agente.id] ?? []
              const totales = totalesFila(fila)

              return (
                <tr key={agente.id}>
                  <td
                    className={`${CELDA} sticky left-0 z-10 bg-white`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      <span className="shrink-0 font-mono font-semibold">
                        {agente.numeroPlaca}
                      </span>
                      <span className="truncate text-slate-700">
                        {agente.nombre} {agente.apellidos}
                      </span>
                    </div>
                  </td>
                  {fila.map((turno, mes) => (
                    <td
                      key={MESES[mes]}
                      role="button"
                      tabIndex={0}
                      className={`${CELDA} cursor-pointer select-none text-center font-bold hover:z-10 hover:ring-2 hover:ring-blue-500 ${CLASE_TURNO[turno]}`}
                      title={`${MESES[mes]} · ${turno}`}
                      aria-label={`${agente.numeroPlaca} ${MESES[mes]} ${turno}`}
                      onClick={() => rotarCelda(agente, mes)}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' || event.key === ' ') {
                          event.preventDefault()
                          rotarCelda(agente, mes)
                        }
                      }}
                    >
                      {turno}
                    </td>
                  ))}
                  {TOTALES.map((clave, indice) => (
                    <td
                      key={clave}
                      className={`${CELDA} sticky z-10 text-center ${
                        indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                      } ${clasePreferencia(cuadraTotal(totales, agente, clave))}`}
                      style={stickyDerecha(indice)}
                    >
                      {totales[clave]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-30 font-bold">
            {(['M', 'T', 'N'] as const).map((turnoPie) => {
              const activosAnio = totalesMes.reduce(
                (suma, columna) => suma + columna.M + columna.T + columna.N,
                0,
              )
              const cantidadAnio = totalesMes.reduce(
                (suma, columna) => suma + columna[turnoPie],
                0,
              )
              const pctAnio = porcentaje(cantidadAnio, activosAnio)

              return (
                <tr key={turnoPie}>
                  <td
                    className={`${CELDA} sticky left-0 z-40 bg-gray-200 text-left`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                  >
                    % {turnoPie}
                  </td>
                  {totalesMes.map((columna, mes) => {
                    const activos = columna.M + columna.T + columna.N
                    const real = porcentaje(columna[turnoPie], activos)
                    return (
                      <td
                        key={MESES[mes]}
                        className={`${CELDA} text-center tabular-nums ${claseSemaforo(
                          real,
                          objetivosGlobales[turnoPie],
                        )}`}
                      >
                        {real == null ? '—' : `${real.toFixed(1)}%`}
                      </td>
                    )
                  })}
                  {TOTALES.map((clave, indice) => (
                    <td
                      key={clave}
                      className={`${CELDA} sticky z-40 text-center tabular-nums ${
                        indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                      } ${
                        clave === turnoPie
                          ? claseSemaforo(pctAnio, objetivosGlobales[turnoPie])
                          : 'bg-gray-200'
                      }`}
                      style={stickyDerecha(indice)}
                    >
                      {clave === turnoPie && pctAnio != null
                        ? `${pctAnio.toFixed(1)}%`
                        : ''}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tfoot>
        </table>
      </div>
    </section>
  )
}
