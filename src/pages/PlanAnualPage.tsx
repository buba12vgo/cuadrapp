import { useMemo, useState } from 'react'
import { useAgentesData } from '@/lib/agentesStore'
import { usePlanAnual } from '@/lib/planAnualStore'
import {
  generarPlanAnual,
  siguienteTurno,
  vacacionesObjetivo,
  type MarcasPlanAnual,
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
  const [marcas, setMarcas] = useState<MarcasPlanAnual | null>(null)

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

  const mesesMarcados = useMemo(
    () => new Set(marcas?.mesesSinCuadrar ?? []),
    [marcas],
  )
  const agentesMarcados = useMemo(
    () => new Set(marcas?.agentesSinCuadrar ?? []),
    [marcas],
  )

  function rotarCelda(agente: FichaPolicia, mes: number) {
    setMarcas(null)
    setPlanAnual((actual) => {
      const fila = [...(actual[agente.id] ?? [])]
      const actualTurno = fila[mes]
      if (!actualTurno) return actual
      fila[mes] = siguienteTurno(agente, actualTurno)
      return { ...actual, [agente.id]: fila }
    })
  }

  function autogenerar() {
    const resultado = generarPlanAnual(agentesData, objetivosGlobales)
    setPlanAnual(resultado.plan)
    setMarcas(resultado.marcas)
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
            onClick={autogenerar}
          >
            Autogenerar Año
          </button>
        </div>
      </div>

      {marcas ? (
        <div
          className={`mx-1 mb-1 border px-2 py-1 text-xs ${
            marcas.anioCuadra &&
            marcas.mesesSinCuadrar.length === 0 &&
            marcas.agentesSinCuadrar.length === 0
              ? 'border-green-300 bg-green-50 text-green-900'
              : 'border-amber-300 bg-amber-50 text-amber-950'
          }`}
        >
          {marcas.preferenciasIncompatibles ? (
            <p>
              Las preferencias de las fichas no suman el % global del selector
              {marcas.pctAnio
                ? ` (real ≈ ${marcas.pctAnio.M.toFixed(1)}/${marcas.pctAnio.T.toFixed(1)}/${marcas.pctAnio.N.toFixed(1)}%). Ajusta objetivos M/T/N en Agentes.`
                : '. Ajusta objetivos M/T/N en Agentes.'}
            </p>
          ) : null}
          {!marcas.anioCuadra && !marcas.preferenciasIncompatibles ? (
            <p>
              No se ha podido cuadrar el % anual sin tocar preferencias
              {marcas.pctAnio
                ? ` (queda ${marcas.pctAnio.M.toFixed(1)}/${marcas.pctAnio.T.toFixed(1)}/${marcas.pctAnio.N.toFixed(1)}%).`
                : '.'}
            </p>
          ) : null}
          {marcas.mesesSinCuadrar.length > 0 ? (
            <p>
              Meses sin cuadrar:{' '}
              <span className="font-semibold">
                {marcas.mesesSinCuadrar.map((m) => MESES[m]).join(', ')}
              </span>
              . Marcados en cabecera.
            </p>
          ) : null}
          {marcas.agentesSinCuadrar.length > 0 ? (
            <p>
              Fichas que no respetan su preferencia (p. ej. noches no
              colocables):{' '}
              <span className="font-semibold">
                {marcas.agentesSinCuadrar
                  .map((id) => {
                    const agente = agentesData.find((a) => a.id === id)
                    return agente
                      ? `${agente.numeroPlaca} ${agente.nombre}`
                      : id
                  })
                  .join(', ')}
              </span>
              . Marcadas a la izquierda.
            </p>
          ) : null}
          {marcas.anioCuadra &&
          marcas.mesesSinCuadrar.length === 0 &&
          marcas.agentesSinCuadrar.length === 0 ? (
            <p>Plan cuadrado con las preferencias de cada ficha.</p>
          ) : null}
        </div>
      ) : null}

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
              {MESES.map((mes, indiceMes) => (
                <th
                  key={mes}
                  className={`${CELDA} sticky top-0 z-20 font-bold ${
                    mesesMarcados.has(indiceMes)
                      ? 'bg-amber-200 text-amber-950 ring-2 ring-inset ring-amber-500'
                      : 'bg-white'
                  }`}
                  title={
                    mesesMarcados.has(indiceMes)
                      ? `${mes}: no se ha podido cuadrar el % del selector`
                      : mes
                  }
                >
                  {mesesMarcados.has(indiceMes) ? `!${mes}` : mes}
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
              const fichaMarcada = agentesMarcados.has(agente.id)

              return (
                <tr key={agente.id}>
                  <td
                    className={`${CELDA} sticky left-0 z-10 ${
                      fichaMarcada
                        ? 'bg-amber-100 font-semibold text-amber-950 ring-2 ring-inset ring-amber-500'
                        : 'bg-white'
                    }`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                    title={
                      fichaMarcada
                        ? 'No se ha podido respetar la preferencia M/T/N de esta ficha'
                        : undefined
                    }
                  >
                    <div className="flex min-w-0 items-center gap-1">
                      {fichaMarcada ? (
                        <span className="shrink-0 text-amber-700" aria-hidden>
                          !
                        </span>
                      ) : null}
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
                      className={`${CELDA} cursor-pointer select-none text-center font-bold hover:z-10 hover:ring-2 hover:ring-blue-500 ${CLASE_TURNO[turno]} ${
                        mesesMarcados.has(mes) ? 'outline outline-1 outline-amber-400' : ''
                      }`}
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
                    className={`${CELDA} sticky left-0 z-40 text-left ${
                      marcas && !marcas.anioCuadra
                        ? 'bg-amber-200 text-amber-950'
                        : 'bg-gray-200'
                    }`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                  >
                    % {turnoPie}
                    {marcas && !marcas.anioCuadra ? ' !' : ''}
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
                        )} ${
                          mesesMarcados.has(mes)
                            ? 'ring-2 ring-inset ring-amber-500'
                            : ''
                        }`}
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
                          ? `${claseSemaforo(pctAnio, objetivosGlobales[turnoPie])} ${
                              marcas && !marcas.anioCuadra
                                ? 'ring-2 ring-inset ring-amber-500'
                                : ''
                            }`
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
