import { useEffect, useMemo, useRef, useState } from 'react'
import { useAgentesData } from '@/lib/agentesStore'
import { savePlanAnual } from '@/lib/db'
import { ensureFirebase } from '@/lib/firebase'
import { usePlanAnual, planParaAnio } from '@/lib/planAnualStore'
import {
  agentePerteneceGrupo,
  calcularMarcas,
  dentroToleranciaPctPlan,
  filaVaciaPlanAnual,
  generarPlanAnual,
  siguienteTurno,
  validarTurnoEnPlan,
  type CeldaPlanAnual,
  type GrupoPlanAnual,
  type ObjetivosGlobales,
  type PlanAnual,
  type TurnoAnual,
} from '@/lib/generarPlanAnual'
import {
  esSinPreferencia,
  etiquetaPreferenciaEnPlan,
  filaCumplePreferencia,
  patronCumplidoEnFila,
} from '@/lib/preferenciasAnuales'
import {
  ETIQUETA_MES_VACACIONES,
  mesVacacionesCiclo,
} from '@/lib/vacaciones'
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
const ANCHO_AGENTE = 148
const ANCHO_MES = 48
const ANCHO_TOTAL = 28
const ANCHO_PATRON = 44

const CELDA =
  'h-6 border border-slate-400 px-1 py-0 text-xs leading-none'
const CELDA_PIE =
  'h-8 border border-slate-400 px-0.5 py-0 text-[11px] leading-none'
const CAMPO_PCT =
  'h-6 w-11 border border-slate-400 bg-white px-1 text-center text-xs text-slate-900 outline-none focus:border-slate-700'
const CAMPO =
  'h-6 border border-slate-400 bg-white px-1 text-xs text-slate-900 outline-none focus:border-slate-700'

const GRUPOS_PLAN: Array<{ valor: GrupoPlanAnual; label: string }> = [
  { valor: 'OPERATIVO', label: 'Policías + jefes de equipo' },
  { valor: 'JEFE_SERVICIO', label: 'Jefes de Servicio' },
]

const CLASE_TURNO: Record<TurnoAnual, string> = {
  M: 'bg-yellow-200 text-yellow-950',
  T: 'bg-orange-300 text-orange-950',
  N: 'bg-blue-300 text-blue-950',
  V: 'bg-gray-300 text-slate-800',
}

function totalesFila(turnos: CeldaPlanAnual[]) {
  const totales = { M: 0, T: 0, N: 0, V: 0 }
  for (const turno of turnos) {
    if (turno) totales[turno] += 1
  }
  return totales
}

function stickyTotal(indice: number) {
  return {
    right: ANCHO_PATRON + (TOTALES.length - 1 - indice) * ANCHO_TOTAL,
    minWidth: ANCHO_TOTAL,
    width: ANCHO_TOTAL,
  }
}

function stickyPatron() {
  return {
    right: 0,
    minWidth: ANCHO_PATRON,
    width: ANCHO_PATRON,
  }
}

function porcentaje(cantidad: number, base: number) {
  if (base <= 0) return null
  return (cantidad / base) * 100
}

function claseSemaforoPct(real: number | null, objetivo: number) {
  if (real == null) return 'bg-gray-200 text-slate-500'
  return dentroToleranciaPctPlan(real, objetivo)
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
  _clave: TurnoAnual,
) {
  return filaCumplePreferencia(agente, totales)
}

function tituloPreferencia(agente: FichaPolicia, totales: Record<TurnoAnual, number>) {
  const patron = patronCumplidoEnFila(agente, totales)
  if (esSinPreferencia(agente.preferenciaAnual)) {
    if (patron) {
      return `Sin preferencia · cumple patrón ${patron}`
    }
    return 'Sin preferencia · no encaja en 4-4-3, 4-3-4 ni 5-3-3 (según limitaciones)'
  }
  if (patron) {
    return `Preferencia ${patron} cumplida`
  }
  return `Preferencia ${etiquetaPreferenciaEnPlan(agente)} no cumplida`
}

export function PlanAnualPage() {
  const [agentesData] = useAgentesData()
  const {
    anio,
    plan: planAnual,
    objetivos: objetivosGlobales,
    cargado,
    errorCarga,
    setAnio,
    setPlanAnual,
    setObjetivos,
    setMarcas,
    registrarPlan,
  } = usePlanAnual()
  const [grupoVista, setGrupoVista] = useState<GrupoPlanAnual>('OPERATIVO')
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const persistTimer = useRef(0)
  const pendienteRef = useRef<{
    anio: number
    plan: PlanAnual
    objetivos: ObjetivosGlobales
    agentes: typeof agentesData
  } | null>(null)

  const agentesVisibles = useMemo(
    () => agentesData.filter((agente) => agentePerteneceGrupo(agente, grupoVista)),
    [agentesData, grupoVista],
  )

  const hayPlanAnio = Object.keys(planAnual).length > 0
  const planAnioAnterior = planParaAnio(anio - 1)
  const planListo = cargado && !errorCarga

  const marcas = useMemo(
    () =>
      calcularMarcas(
        planAnual,
        agentesVisibles,
        objetivosGlobales,
        planAnioAnterior,
      ),
    [planAnual, agentesVisibles, objetivosGlobales, planAnioAnterior],
  )

  const totalesMes = useMemo(() => {
    const columnas = MESES.map(() => ({ M: 0, T: 0, N: 0, V: 0 }))
    for (const agente of agentesVisibles) {
      const fila = planAnual[agente.id] ?? filaVaciaPlanAnual()
      fila.forEach((turno, mes) => {
        if (turno) columnas[mes][turno] += 1
      })
    }
    return columnas
  }, [agentesVisibles, planAnual])

  const mesesMarcados = useMemo(
    () => new Set(hayPlanAnio ? (marcas?.mesesSinCuadrar ?? []) : []),
    [hayPlanAnio, marcas],
  )
  const agentesMarcados = useMemo(
    () => new Set(hayPlanAnio ? (marcas?.agentesSinCuadrar ?? []) : []),
    [hayPlanAnio, marcas],
  )

  useEffect(() => {
    return () => {
      window.clearTimeout(persistTimer.current)
      const pendiente = pendienteRef.current
      pendienteRef.current = null
      if (!pendiente) return
      void savePlanAnual(
        pendiente.anio,
        pendiente.plan,
        pendiente.objetivos,
        pendiente.agentes,
      ).catch((err) => {
        console.error('[plan-anual] No se pudo guardar al salir', err)
      })
    }
  }, [])

  async function persistir(plan: PlanAnual, objetivos: ObjetivosGlobales) {
    pendienteRef.current = null
    const ready = await ensureFirebase()
    if (!ready) return
    setGuardando(true)
    setGuardadoOk(false)
    try {
      await savePlanAnual(anio, plan, objetivos, agentesData)
      setErrorGuardado(null)
      setGuardadoOk(true)
    } catch (err) {
      setErrorGuardado(
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el plan anual en Firestore',
      )
    } finally {
      setGuardando(false)
    }
  }

  function persistirYa(plan: PlanAnual, objetivos: ObjetivosGlobales) {
    pendienteRef.current = null
    window.clearTimeout(persistTimer.current)
    void persistir(plan, objetivos)
  }

  function persistirLuego(plan: PlanAnual, objetivos: ObjetivosGlobales) {
    pendienteRef.current = {
      anio,
      plan,
      objetivos,
      agentes: agentesData,
    }
    window.clearTimeout(persistTimer.current)
    persistTimer.current = window.setTimeout(() => {
      void persistir(plan, objetivos)
    }, 400)
  }

  function rotarCelda(agente: FichaPolicia, mes: number) {
    if (!planListo) return
    const filaActual = [...(planAnual[agente.id] ?? filaVaciaPlanAnual())]
    const turnoActual = filaActual[mes] ?? null
    filaActual[mes] = siguienteTurno(agente, turnoActual)
    const planActualizado = { ...planAnual, [agente.id]: filaActual }
    setPlanAnual(planActualizado)
    setMarcas(
      calcularMarcas(
        planActualizado,
        agentesVisibles,
        objetivosGlobales,
        planAnioAnterior,
      ),
    )
    persistirYa(planActualizado, objetivosGlobales)
  }

  /** Regenera solo el año del selector; no escribe años vecinos. */
  function autogenerar() {
    if (!planListo) return
    const resultado = generarPlanAnual(
      agentesData,
      objetivosGlobales,
      anio,
      planParaAnio(anio - 1),
      { grupo: grupoVista, planBase: planAnual },
    )
    registrarPlan(anio, resultado.plan, resultado.marcas)
    persistirYa(resultado.plan, objetivosGlobales)
  }

  /** Vacía solo el año del selector, tras dos confirmaciones. */
  function limpiarAnio() {
    if (!planListo || !hayPlanAnio) return
    const seguir = window.confirm(
      `¿Vaciar el plan de ${anio}?\n\nSe borrarán todos los turnos de este año. ${anio + 1} y el resto no se tocan.\n\nDespués puedes rellenar ${anio} a mano (el cuadrante real) y autogenerar ${anio + 1} con las normas de fin de año.`,
    )
    if (!seguir) return
    const confirmar = window.confirm(
      `Confirmación final: el plan de ${anio} se dejará en blanco y se guardará. Esta acción no se puede deshacer.\n\n¿Limpiar ${anio}?`,
    )
    if (!confirmar) return

    const vacio: PlanAnual = {}
    setPlanAnual(vacio)
    setMarcas(null)
    persistirYa(vacio, objetivosGlobales)
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 py-1">
        <div className="flex items-center gap-2">
          <h1 className="text-xs font-bold text-slate-900">Plan anual</h1>
          <label className="flex items-center gap-1 text-xs text-slate-600">
            <span className="font-semibold">Año</span>
            <select
              className="h-6 border border-slate-400 bg-white px-1 text-xs"
              value={anio}
              onChange={(event) =>
                setAnio(Number(event.target.value) || anio)
              }
            >
              {Array.from({ length: 11 }, (_, i) => 2020 + i).map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
          </label>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Vista</span>
            <select
              className={CAMPO}
              value={grupoVista}
              onChange={(event) =>
                setGrupoVista(event.target.value as GrupoPlanAnual)
              }
            >
              {GRUPOS_PLAN.map((grupo) => (
                <option key={grupo.valor} value={grupo.valor}>
                  {grupo.label}
                </option>
              ))}
            </select>
          </label>
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
                disabled={!planListo}
                onChange={(event) => {
                  const siguientes = {
                    ...objetivosGlobales,
                    [turno]: leerPorcentaje(event.target.value),
                  }
                  setObjetivos(siguientes)
                  persistirLuego(planAnual, siguientes)
                }}
              />
            </label>
          ))}
          <button
            type="button"
            className="h-6 bg-slate-900 px-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Regenera solo ${anio} (hasta 3 pasadas de refinado). Los demás años no se modifican.`}
            disabled={!planListo}
            onClick={autogenerar}
          >
            Autogenerar Año
          </button>
          <button
            type="button"
            className="h-6 border border-red-300 bg-white px-2 text-xs font-semibold text-red-800 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={`Vacía el plan de ${anio} tras dos confirmaciones. Los demás años no se tocan.`}
            disabled={!planListo || !hayPlanAnio}
            onClick={limpiarAnio}
          >
            Limpiar año
          </button>
          {guardando ? (
            <span className="text-[11px] text-slate-500">Guardando…</span>
          ) : null}
          {guardadoOk && !guardando ? (
            <span className="text-[11px] text-green-700">Guardado</span>
          ) : null}
        </div>
      </div>

      {errorGuardado ? (
        <div className="mx-1 mb-1 border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
          {errorGuardado}
        </div>
      ) : null}

      {errorCarga ? (
        <div className="mx-1 mb-1 border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
          No se pudo cargar el plan anual desde Firestore: {errorCarga}. No se
          puede editar ni guardar hasta recargar la página.
        </div>
      ) : null}

      {!cargado ? (
        <div className="mx-1 mb-1 border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700">
          Cargando plan anual desde Firestore…
        </div>
      ) : null}

      {cargado && !hayPlanAnio ? (
        <div className="mx-1 mb-1 border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700">
          <p>
            {anio} no tiene plan. Rellena las celdas a mano o pulsa{' '}
            <span className="font-semibold">Autogenerar Año</span>. Los
            anteriores y siguientes no se tocan.
          </p>
        </div>
      ) : null}

      {hayPlanAnio && marcas ? (
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
              colocables o sin patrón compatible):{' '}
              <span className="font-semibold">
                {marcas.agentesSinCuadrar
                  .map((id) => {
                    const agente = agentesData.find((a) => a.id === id)
                    const flex = agente
                      ? esSinPreferencia(agente.preferenciaAnual)
                      : false
                    return agente
                      ? `${agente.numeroPlaca} ${agente.nombre}${flex ? ' (Flex)' : ''}`
                      : id
                  })
                  .join(', ')}
              </span>
              . Marcadas a la izquierda; columna Pat indica el patrón asignado.
            </p>
          ) : null}
          <p className="text-[11px] text-slate-600">
            <span className="font-semibold text-violet-700">Flex</span> = sin
            preferencia (4-4-3, 4-3-4 o 5-3-3). Totales y columna{' '}
            <span className="font-semibold">Pat</span> en verde cuando cumple
            algún patrón compatible.
          </p>
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
                  style={{ minWidth: ANCHO_MES }}
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
                  style={stickyTotal(indice)}
                >
                  {clave}
                </th>
              ))}
              <th
                className={`${CELDA} sticky top-0 z-30 border-l border-slate-400 bg-white font-bold`}
                style={stickyPatron()}
                title="Patrón asignado o preferencia flexible"
              >
                Pat
              </th>
            </tr>
          </thead>
          <tbody>
            {agentesVisibles.map((agente) => {
              const fila = planAnual[agente.id] ?? filaVaciaPlanAnual()
              const totales = totalesFila(fila)
              const fichaMarcada = agentesMarcados.has(agente.id)
              const sinPref = esSinPreferencia(agente.preferenciaAnual)
              const patronAsignado = patronCumplidoEnFila(agente, totales)
              const cuadra = filaCumplePreferencia(agente, totales)

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
                        ? tituloPreferencia(agente, totales)
                        : `Vacaciones ${anio}: ${ETIQUETA_MES_VACACIONES[mesVacacionesCiclo(agente, anio)]}${sinPref ? ' · Sin preferencia de turnos' : ''}`
                    }
                  >
                    <div className="flex min-w-0 flex-col gap-0.5">
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
                      {sinPref ? (
                        <span
                          className="truncate text-[10px] font-semibold text-violet-700"
                          title="Sin preferencia: se asigna 4-4-3, 4-3-4 o 5-3-3"
                        >
                          Flex · sin preferencia
                        </span>
                      ) : null}
                    </div>
                  </td>
                  {fila.map((turno, mes) => {
                    const aviso =
                      turno && turno !== 'V'
                        ? validarTurnoEnPlan(
                            agente,
                            fila,
                            mes,
                            turno,
                            planAnioAnterior,
                          )
                        : null
                    return (
                      <td
                        key={MESES[mes]}
                        role="button"
                        tabIndex={0}
                        className={`${CELDA} cursor-pointer select-none text-center font-bold hover:z-10 hover:ring-2 hover:ring-blue-500 ${
                          turno ? CLASE_TURNO[turno] : 'bg-white text-slate-400'
                        } ${
                          mesesMarcados.has(mes)
                            ? 'outline outline-1 outline-amber-400'
                            : ''
                        } ${aviso ? 'ring-1 ring-inset ring-dashed ring-red-500' : ''}`}
                        style={{ minWidth: ANCHO_MES }}
                        title={
                          turno
                            ? aviso
                              ? `${MESES[mes]} · ${turno} · ${aviso}`
                              : `${MESES[mes]} · ${turno}`
                            : `${MESES[mes]} · sin asignar`
                        }
                        aria-label={`${agente.numeroPlaca} ${MESES[mes]} ${turno ?? 'vacío'}`}
                        onClick={() => rotarCelda(agente, mes)}
                        onKeyDown={(event) => {
                          if (event.key === 'Enter' || event.key === ' ') {
                            event.preventDefault()
                            rotarCelda(agente, mes)
                          }
                        }}
                      >
                        {turno ?? ''}
                      </td>
                    )
                  })}
                  {TOTALES.map((clave, indice) => (
                    <td
                      key={clave}
                      className={`${CELDA} sticky z-10 text-center ${
                        indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                      } ${clasePreferencia(cuadraTotal(totales, agente, clave))}`}
                      style={stickyTotal(indice)}
                      title={tituloPreferencia(agente, totales)}
                    >
                      {totales[clave]}
                    </td>
                  ))}
                  <td
                    className={`${CELDA} sticky z-10 border-l border-slate-400 text-center leading-tight ${
                      patronAsignado
                        ? 'bg-green-100 font-bold text-green-800'
                        : sinPref
                          ? 'bg-violet-50 font-semibold text-violet-800'
                          : cuadra
                            ? 'bg-green-100 font-bold text-green-800'
                            : 'bg-red-200 font-bold text-red-900'
                    }`}
                    style={stickyPatron()}
                    title={tituloPreferencia(agente, totales)}
                  >
                    {sinPref ? (
                      <span className="block text-[10px]">
                        {patronAsignado ? (
                          <>
                            <span className="text-violet-700">Flex</span>
                            <span className="block text-green-800">
                              {patronAsignado}
                            </span>
                          </>
                        ) : (
                          'Flex'
                        )}
                      </span>
                    ) : patronAsignado ? (
                      <span className="text-[10px]">{patronAsignado}</span>
                    ) : (
                      <span className="text-[10px]">
                        {etiquetaPreferenciaEnPlan(agente)}
                      </span>
                    )}
                  </td>
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
                    className={`${CELDA_PIE} sticky left-0 z-40 text-left ${
                      hayPlanAnio && marcas && !marcas.anioCuadra
                        ? 'bg-amber-200 text-amber-950'
                        : 'bg-gray-200'
                    }`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                  >
                    % {turnoPie}
                    {hayPlanAnio && marcas && !marcas.anioCuadra ? ' !' : ''}
                  </td>
                  {totalesMes.map((columna, mes) => {
                    const activos = columna.M + columna.T + columna.N
                    const cantidad = columna[turnoPie]
                    const real = porcentaje(cantidad, activos)
                    return (
                      <td
                        key={MESES[mes]}
                        className={`${CELDA_PIE} text-center tabular-nums ${claseSemaforoPct(
                          real,
                          objetivosGlobales[turnoPie],
                        )} ${
                          mesesMarcados.has(mes)
                            ? 'ring-2 ring-inset ring-amber-500'
                            : ''
                        }`}
                        style={{ minWidth: ANCHO_MES }}
                        title={
                          real == null
                            ? undefined
                            : `${cantidad} en ${turnoPie} · ${real.toFixed(1)}%`
                        }
                      >
                        {real == null ? (
                          '—'
                        ) : (
                          <span className="flex flex-col items-center justify-center gap-0.5">
                            <span>{cantidad}</span>
                            <span>{real.toFixed(1)}%</span>
                          </span>
                        )}
                      </td>
                    )
                  })}
                  {TOTALES.map((clave, indice) => (
                    <td
                      key={clave}
                      className={`${CELDA_PIE} sticky z-40 text-center tabular-nums ${
                        indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                      } ${
                        clave === turnoPie
                          ? `${claseSemaforoPct(
                              pctAnio,
                              objetivosGlobales[turnoPie],
                            )} ${
                              hayPlanAnio && marcas && !marcas.anioCuadra
                                ? 'ring-2 ring-inset ring-amber-500'
                                : ''
                            }`
                          : 'bg-gray-200'
                      }`}
                      style={stickyTotal(indice)}
                    >
                      {clave === turnoPie && pctAnio != null
                        ? `${pctAnio.toFixed(1)}%`
                        : ''}
                    </td>
                  ))}
                  <td
                    className={`${CELDA_PIE} sticky z-40 bg-gray-200`}
                    style={stickyPatron()}
                  />
                </tr>
              )
            })}
          </tfoot>
        </table>
      </div>
    </section>
  )
}
