import { useEffect, useMemo, useState } from 'react'
import { BolsaPuestosPanel } from '@/components/BolsaPuestosPanel'
import { PopoverPuestosCelda } from '@/components/PopoverPuestosCelda'
import { RepartoOperativoModal } from '@/components/RepartoOperativoModal'
import { useAgentesData } from '@/lib/agentesStore'
import {
  abreviaturaPuesto,
  asignarPuestoEnCelda,
  asignarPuestoMesAgente,
  esTurnoOperativo,
  fechasOperativasAgenteMes,
  leerPuestoArrastrado,
  permitirSoltarPuesto,
  puestosPermitidosParaAgente,
} from '@/lib/asignacionPuestos'
import {
  type AsignacionesDiarias,
  minimosParaFecha,
  type PuestoBase,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import {
  cuadranteDesdeFirestore,
  cuadranteParaFirestore,
  cuadranteVacio,
} from '@/lib/cuadranteFirestore'
import { getAgentes, getCuadrante, saveCuadrante } from '@/lib/db'
import { useEventosData } from '@/lib/eventosStore'
import { isFirebaseConfigured } from '@/lib/firebase'
import { usePlanAnual } from '@/lib/planAnualStore'
import {
  MINIMO_AGENTES_TURNO,
  diasDelMes,
  diasOperativosConvenio,
  esFinDeSemana,
  totalFindesTrabajados,
  totalTrabajados,
} from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import {
  generarCuadranteMensual,
  type CuadranteMensual,
} from '@/lib/generarCuadranteMensual'
import { mensajesInfraccion } from '@/lib/reglasCuadrante'
import type { RolPolicia, Turno } from '@/types'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

const DIA_SEMANA = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const
const ROLES: RolPolicia[] = [
  'RESPONSABLE',
  'JEFE_SERVICIO',
  'JEFE_EQUIPO',
  'POLICIA',
]
const ROL_LABEL: Record<RolPolicia, string> = {
  RESPONSABLE: 'Responsable',
  JEFE_SERVICIO: 'Jefe de servicio',
  JEFE_EQUIPO: 'Jefe de equipo',
  POLICIA: 'Policía',
}

const ANIO_ACTUAL = 2026
const ANCHO_DIA = 36
const ANCHO_TOT = 28
const ANCHO_AGENTE = 36

const CELDA =
  'h-7 border border-slate-400 px-0.5 py-0 text-xs leading-none'
const CELDA_PIE =
  'h-8 border border-slate-400 border-t-2 border-t-slate-500 px-0 py-0 text-[9px] leading-tight'
const CAMPO =
  'h-6 border border-slate-400 bg-white px-1 text-xs text-slate-900 outline-none focus:border-slate-700'

const CLASE_TURNO: Record<Turno, string> = {
  M: 'bg-yellow-200 text-yellow-950',
  T: 'bg-orange-300 text-orange-950',
  N: 'bg-blue-300 text-blue-950',
  L: 'bg-emerald-200 text-emerald-950',
  D: 'bg-white text-slate-500',
  V: 'bg-gray-300 text-slate-800',
}

const TURNOS_OP = ['M', 'T', 'N'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function leerFecha(valor: string) {
  const [anio, mes, dia] = valor.split('-').map(Number)
  if (!anio || !mes || !dia) return null
  return { anio, mes, dia }
}

function claseMinimo(real: number, minimo: number, especial: boolean) {
  if (real < minimo) return 'bg-red-200 font-bold text-red-900'
  return especial ? 'bg-amber-50' : 'bg-white'
}

function stickyDerecha(indice: number) {
  return {
    right: (TURNOS_OP.length - 1 - indice) * ANCHO_TOT,
    minWidth: ANCHO_TOT,
    width: ANCHO_TOT,
  }
}

function claseIndicador(ok: boolean) {
  return ok
    ? 'bg-green-100 font-bold text-green-800'
    : 'bg-red-200 font-bold text-red-900'
}

export function CuadranteMensualPage() {
  const [agentesData, setAgentesData] = useAgentesData()
  const [eventosData] = useEventosData()
  const [planAnual] = usePlanAnual()
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [mes, setMes] = useState(8)
  const [diaDesde, setDiaDesde] = useState(1)
  const [diaHasta, setDiaHasta] = useState(() => diasDelMes(ANIO_ACTUAL, 8))
  const [rolFiltro, setRolFiltro] = useState<'TODOS' | RolPolicia>('TODOS')
  const [diaReparto, setDiaReparto] = useState<number | null>(null)
  const [asignacionesDiarias, setAsignacionesDiarias] =
    useState<AsignacionesDiarias>({})
  const [cuadrante, setCuadrante] = useState<CuadranteMensual>({})
  const [loadingCuadrante, setLoadingCuadrante] = useState(true)
  const [guardandoCuadrante, setGuardandoCuadrante] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [errorCuadrante, setErrorCuadrante] = useState<string | null>(null)
  const [agentesCargados, setAgentesCargados] = useState(!isFirebaseConfigured)

  const nDias = diasDelMes(anio, mes)
  const objetivo = diasOperativosConvenio(anio, mes)
  const ids = useMemo(
    () => agentesData.map((agente) => agente.id),
    [agentesData],
  )

  const agentesVisibles = useMemo(
    () =>
      agentesData.filter(
        (agente) => rolFiltro === 'TODOS' || agente.rolBase === rolFiltro,
      ),
    [agentesData, rolFiltro],
  )

  const diasVisibles = useMemo(() => {
    const inicio = Math.min(diaDesde, diaHasta)
    const fin = Math.max(diaDesde, diaHasta)
    const dias: number[] = []
    for (let dia = 1; dia <= nDias; dia++) {
      if (dia >= inicio && dia <= fin) dias.push(dia)
    }
    return dias
  }, [diaDesde, diaHasta, nDias])

  useEffect(() => {
    if (!isFirebaseConfigured) {
      setAgentesCargados(true)
      return
    }
    let cancelado = false
    async function cargarAgentes() {
      try {
        const lista = await getAgentes()
        if (!cancelado) setAgentesData(lista)
      } catch {
        // La carga de agentes se gestiona al intentar pintar el cuadrante.
      } finally {
        if (!cancelado) setAgentesCargados(true)
      }
    }
    void cargarAgentes()
    return () => {
      cancelado = true
    }
  }, [setAgentesData])

  useEffect(() => {
    if (!agentesCargados) return
    let cancelado = false

    async function cargarCuadranteMes() {
      setLoadingCuadrante(true)
      setErrorCuadrante(null)
      setGuardadoOk(false)

      if (!isFirebaseConfigured) {
        setCuadrante(cuadranteVacio(agentesData, nDias))
        setAsignacionesDiarias({})
        setLoadingCuadrante(false)
        return
      }

      try {
        const datos = await getCuadrante(mes, anio)
        if (cancelado) return

        if (datos && agentesData.length > 0) {
          const { cuadrante: cargado, asignaciones } = cuadranteDesdeFirestore(
            datos,
            agentesData,
            anio,
            mes,
            nDias,
          )
          setCuadrante(cargado)
          setAsignacionesDiarias(asignaciones)
        } else {
          setCuadrante(cuadranteVacio(agentesData, nDias))
          setAsignacionesDiarias({})
        }
      } catch (err) {
        if (!cancelado) {
          setErrorCuadrante(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el cuadrante desde Firestore',
          )
          setCuadrante(cuadranteVacio(agentesData, nDias))
          setAsignacionesDiarias({})
        }
      } finally {
        if (!cancelado) setLoadingCuadrante(false)
      }
    }

    void cargarCuadranteMes()
    return () => {
      cancelado = true
    }
  }, [mes, anio, nDias, agentesData, agentesCargados])

  function aplicarMes(siguienteAnio: number, siguienteMes: number) {
    const dias = diasDelMes(siguienteAnio, siguienteMes)
    setAnio(siguienteAnio)
    setMes(siguienteMes)
    setDiaDesde(1)
    setDiaHasta(dias)
  }

  function autogenerar() {
    setCuadrante(generarCuadranteMensual(planAnual, ids, anio, mes))
  }

  async function guardarCuadranteEnFirestore() {
    if (!isFirebaseConfigured) {
      window.alert('Firebase no configurado. Define VITE_FIREBASE_* en Vercel y redespliega, o en .env.local en desarrollo.')
      return
    }
    if (agentesData.length === 0) {
      window.alert('No hay agentes cargados para guardar el cuadrante.')
      return
    }

    setGuardandoCuadrante(true)
    setErrorCuadrante(null)
    setGuardadoOk(false)
    try {
      const payload = cuadranteParaFirestore(
        cuadrante,
        asignacionesDiarias,
        agentesData,
        anio,
        mes,
        nDias,
      )
      await saveCuadrante(mes, anio, payload)
      setCuadrante((actual) => ({ ...actual }))
      setAsignacionesDiarias((actual) => ({ ...actual }))
      setGuardadoOk(true)
      window.setTimeout(() => setGuardadoOk(false), 3000)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el cuadrante en Firestore'
      setErrorCuadrante(mensaje)
      window.alert(mensaje)
    } finally {
      setGuardandoCuadrante(false)
    }
  }

  function guardarRepartoDia(
    fecha: string,
    asignaciones: AsignacionesDiarias[string],
  ) {
    setAsignacionesDiarias((actual) => ({
      ...actual,
      [fecha]: asignaciones,
    }))
    setDiaReparto(null)
  }

  const fechaReparto =
    diaReparto != null ? isoFecha(anio, mes, diaReparto) : null

  const [popoverCelda, setPopoverCelda] = useState<{
    agenteId: string
    fecha: string
    turno: TurnoOperativo
    rect: DOMRect
  } | null>(null)

  const agentesPorId = useMemo(
    () => new Map(agentesData.map((agente) => [agente.id, agente])),
    [agentesData],
  )

  function avisarExclusion() {
    window.alert('Puesto excluido para este agente')
  }

  function aplicarAsignacionCelda(
    agenteId: string,
    fecha: string,
    turno: TurnoOperativo,
    puesto: PuestoBase,
  ) {
    const agente = agentesPorId.get(agenteId)
    if (!agente) return
    const resultado = asignarPuestoEnCelda(
      asignacionesDiarias,
      agente,
      fecha,
      turno,
      puesto,
    )
    if (!resultado.ok) {
      avisarExclusion()
      return
    }
    setAsignacionesDiarias(resultado.asignaciones)
  }

  function aplicarAsignacionMesAgente(agenteId: string, puesto: PuestoBase) {
    const agente = agentesPorId.get(agenteId)
    if (!agente) return
    const fechasTurno = fechasOperativasAgenteMes(
      cuadrante,
      agenteId,
      anio,
      mes,
      nDias,
      isoFecha,
    ).map(({ fecha, turno }) => ({ fecha, turno }))
    const resultado = asignarPuestoMesAgente(
      asignacionesDiarias,
      agente,
      puesto,
      fechasTurno,
    )
    if (!resultado.ok) {
      avisarExclusion()
      return
    }
    setAsignacionesDiarias(resultado.asignaciones)
  }

  function soltarEnCabeceraAgente(
    event: React.DragEvent,
    agenteId: string,
  ) {
    event.preventDefault()
    const puesto = leerPuestoArrastrado(event.dataTransfer)
    if (!puesto) return
    aplicarAsignacionMesAgente(agenteId, puesto)
  }

  function soltarEnCelda(
    event: React.DragEvent,
    agenteId: string,
    fecha: string,
    turno: TurnoOperativo,
  ) {
    event.preventDefault()
    event.stopPropagation()
    const puesto = leerPuestoArrastrado(event.dataTransfer)
    if (!puesto) return
    aplicarAsignacionCelda(agenteId, fecha, turno, puesto)
  }

  return (
    <section className="flex h-full min-h-0 flex-col">
      <div className="sticky top-0 z-50 shrink-0 border-b border-slate-300 bg-white">
        <div className="flex flex-wrap items-center justify-between gap-2 px-1 py-1">
        <div>
          <h1 className="text-xs font-bold text-slate-900">
            Cuadrante mensual
          </h1>
          <p className="text-[11px] text-slate-500">
            Convenio: {objetivo} días · fatiga ≤ 5 · D de 2+ · mín.{' '}
            {MINIMO_AGENTES_TURNO}/turno
            {loadingCuadrante ? ' · Cargando…' : ''}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Mes</span>
            <select
              className={CAMPO}
              value={mes}
              onChange={(event) =>
                aplicarMes(anio, Number(event.target.value))
              }
            >
              {MESES.map((nombre, indice) => (
                <option key={nombre} value={indice + 1}>
                  {nombre}
                </option>
              ))}
            </select>
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Año</span>
            <input
              type="number"
              min={2020}
              max={2040}
              className={`${CAMPO} w-16`}
              value={anio}
              onChange={(event) =>
                aplicarMes(Number(event.target.value) || anio, mes)
              }
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Desde</span>
            <input
              type="date"
              className={CAMPO}
              min={isoFecha(anio, mes, 1)}
              max={isoFecha(anio, mes, nDias)}
              value={isoFecha(anio, mes, Math.min(diaDesde, nDias))}
              onChange={(event) => {
                const leida = leerFecha(event.target.value)
                if (!leida) return
                setDiaDesde(Math.min(leida.dia, nDias))
              }}
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Hasta</span>
            <input
              type="date"
              className={CAMPO}
              min={isoFecha(anio, mes, 1)}
              max={isoFecha(anio, mes, nDias)}
              value={isoFecha(anio, mes, Math.min(diaHasta, nDias))}
              onChange={(event) => {
                const leida = leerFecha(event.target.value)
                if (!leida) return
                setDiaHasta(Math.min(leida.dia, nDias))
              }}
            />
          </label>
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Rol</span>
            <select
              className={CAMPO}
              value={rolFiltro}
              onChange={(event) =>
                setRolFiltro(event.target.value as 'TODOS' | RolPolicia)
              }
            >
              <option value="TODOS">Todos</option>
              {ROLES.map((rol) => (
                <option key={rol} value={rol}>
                  {ROL_LABEL[rol]}
                </option>
              ))}
            </select>
          </label>
          <button
            type="button"
            className="h-6 bg-slate-900 px-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={loadingCuadrante}
            onClick={autogenerar}
          >
            Autogenerar mes
          </button>
          <button
            type="button"
            className="h-6 bg-emerald-700 px-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              loadingCuadrante || guardandoCuadrante || !isFirebaseConfigured
            }
            onClick={() => void guardarCuadranteEnFirestore()}
          >
            {guardandoCuadrante ? 'Guardando…' : '💾 Guardar Cuadrante'}
          </button>
          {guardadoOk ? (
            <span className="text-xs font-semibold text-green-700">
              Guardado con éxito
            </span>
          ) : null}
        </div>
        </div>
        {errorCuadrante ? (
          <p className="border-t border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
            {errorCuadrante}
          </p>
        ) : null}
      </div>

      <div className="flex min-h-0 flex-1">
        <div className="min-h-0 flex-1 overflow-auto border border-slate-500 bg-white">
          <table className="w-max border-separate border-spacing-0 text-xs leading-none">
          <thead>
            <tr>
              <th
                className={`${CELDA} sticky top-0 left-0 z-40 bg-white text-left font-bold`}
                style={{ width: ANCHO_DIA, minWidth: ANCHO_DIA }}
              >
                Día
              </th>
              {agentesVisibles.map((agente) => {
                const turnoPlan = planAnual[agente.id]?.[mes - 1] ?? 'M'
                const nombre = `${agente.nombre} ${agente.apellidos}`
                return (
                  <th
                    key={agente.id}
                    className={`${CELDA} group relative sticky top-0 z-20 bg-white text-center font-mono font-bold hover:bg-blue-50 data-[over=true]:bg-blue-100 data-[over=true]:ring-2 data-[over=true]:ring-inset data-[over=true]:ring-blue-500`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                    title={`${nombre} · soltar puesto = mes completo`}
                    onDragOver={permitirSoltarPuesto}
                    onDragEnter={(event) => {
                      event.currentTarget.dataset.over = 'true'
                    }}
                    onDragLeave={(event) => {
                      event.currentTarget.dataset.over = 'false'
                    }}
                    onDrop={(event) => {
                      event.currentTarget.dataset.over = 'false'
                      soltarEnCabeceraAgente(event, agente.id)
                    }}
                  >
                    {agente.numeroPlaca}
                    <span className="pointer-events-none absolute top-full left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap border border-slate-300 bg-white px-1.5 py-0.5 text-[10px] font-sans font-medium text-slate-800 shadow group-hover:block">
                      {nombre} · {turnoPlan}
                    </span>
                  </th>
                )
              })}
              {TURNOS_OP.map((turno, indice) => (
                <th
                  key={turno}
                  className={`${CELDA} sticky top-0 z-30 bg-white text-center font-bold ${
                    indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                  }`}
                  style={stickyDerecha(indice)}
                  title={`Agentes en ${turno} · mínimo ${MINIMO_AGENTES_TURNO}`}
                >
                  {turno}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {diasVisibles.map((dia) => {
              const weekday = new Date(anio, mes - 1, dia).getDay()
              const especial =
                esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
              const fondoFila = especial ? 'bg-amber-50' : 'bg-white'
              const totales = { M: 0, T: 0, N: 0 }
              for (const agente of agentesVisibles) {
                const turno = cuadrante[agente.id]?.[dia - 1]
                if (turno === 'M' || turno === 'T' || turno === 'N') {
                  totales[turno] += 1
                }
              }

              return (
                <tr key={dia} className={fondoFila}>
                  <td
                    className={`${CELDA} sticky left-0 z-20 p-0 ${fondoFila}`}
                    style={{ width: ANCHO_DIA, minWidth: ANCHO_DIA }}
                  >
                    <button
                      type="button"
                      className={`flex h-full w-full items-center px-0.5 hover:bg-blue-50 hover:ring-2 hover:ring-inset hover:ring-blue-500 ${
                        especial ? 'text-red-600' : ''
                      }`}
                      title={`Reparto operativo · día ${dia}`}
                      onClick={() => setDiaReparto(dia)}
                    >
                      <span className="font-bold">{dia}</span>
                      <span
                        className={`ml-0.5 font-bold ${
                          especial ? 'text-red-600' : 'text-slate-500'
                        }`}
                      >
                        {DIA_SEMANA[weekday]}
                      </span>
                    </button>
                  </td>
                  {agentesVisibles.map((agente) => {
                    const fila = cuadrante[agente.id] ?? []
                    const turno = fila[dia - 1] ?? 'D'
                    const fecha = isoFecha(anio, mes, dia)
                    const abrevPuesto =
                      turno === 'M' || turno === 'T' || turno === 'N'
                        ? abreviaturaPuesto(
                            asignacionesDiarias,
                            fecha,
                            agente.id,
                            turno,
                          )
                        : null
                    const operativo = esTurnoOperativo(turno)
                    const avisos = mensajesInfraccion(fila, dia - 1)
                    const rota = avisos.length > 0
                    const fondoSuave =
                      especial && (turno === 'D' || turno === 'V')
                        ? '!bg-amber-50'
                        : ''
                    return (
                      <td
                        key={agente.id}
                        className={`${CELDA} text-center font-bold ${CLASE_TURNO[turno]} ${fondoSuave} ${
                          rota ? 'border-red-600 !text-red-800' : ''
                        } ${
                          operativo
                            ? 'cursor-pointer hover:z-10 hover:ring-2 hover:ring-blue-500 data-[over=true]:ring-2 data-[over=true]:ring-emerald-600'
                            : ''
                        }`}
                        title={
                          avisos.length > 0
                            ? avisos.join(' · ')
                            : operativo
                              ? `${agente.numeroPlaca} · día ${dia} · ${turno}${abrevPuesto ? ` · ${abrevPuesto}` : ''} · clic o soltar puesto`
                              : `${agente.numeroPlaca} · día ${dia} · ${turno}`
                        }
                        onDragOver={
                          operativo ? permitirSoltarPuesto : undefined
                        }
                        onDragEnter={
                          operativo
                            ? (event) => {
                                event.currentTarget.dataset.over = 'true'
                              }
                            : undefined
                        }
                        onDragLeave={
                          operativo
                            ? (event) => {
                                event.currentTarget.dataset.over = 'false'
                              }
                            : undefined
                        }
                        onDrop={
                          operativo
                            ? (event) => {
                                event.currentTarget.dataset.over = 'false'
                                soltarEnCelda(
                                  event,
                                  agente.id,
                                  fecha,
                                  turno,
                                )
                              }
                            : undefined
                        }
                        onClick={
                          operativo
                            ? (event) => {
                                event.stopPropagation()
                                setPopoverCelda({
                                  agenteId: agente.id,
                                  fecha,
                                  turno,
                                  rect: event.currentTarget.getBoundingClientRect(),
                                })
                              }
                            : undefined
                        }
                      >
                        <span className="block text-xs leading-none">{turno}</span>
                        {abrevPuesto ? (
                          <span className="block text-[8px] font-bold leading-none text-gray-700">
                            {abrevPuesto}
                          </span>
                        ) : null}
                      </td>
                    )
                  })}
                  {TURNOS_OP.map((turno, indice) => (
                    <td
                      key={turno}
                      className={`${CELDA} sticky z-10 text-center tabular-nums ${
                        indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                      } ${claseMinimo(totales[turno], MINIMO_AGENTES_TURNO, especial)}`}
                      style={stickyDerecha(indice)}
                    >
                      {totales[turno]}
                    </td>
                  ))}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="sticky bottom-0 z-20">
            <tr>
              <td
                className={`${CELDA_PIE} sticky left-0 z-40 bg-slate-200 text-left font-bold`}
                style={{ width: ANCHO_DIA, minWidth: ANCHO_DIA }}
              >
                Σ
              </td>
              {agentesVisibles.map((agente) => {
                const fila = cuadrante[agente.id] ?? []
                const turnoPlan = planAnual[agente.id]?.[mes - 1] ?? 'M'
                const trabajados = totalTrabajados(fila)
                const findes = totalFindesTrabajados(fila, anio, mes)
                const objetivoFila = turnoPlan === 'V' ? 0 : objetivo
                return (
                  <td
                    key={agente.id}
                    className={`${CELDA_PIE} bg-slate-200`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                    title={`Trabajados ${trabajados} / ${objetivoFila} · Findes ${findes}`}
                  >
                    <div className="flex h-full flex-col">
                      <span
                        className={`flex flex-1 items-center justify-center ${claseIndicador(
                          trabajados === objetivoFila,
                        )}`}
                      >
                        {trabajados}d
                      </span>
                      <span
                        className={`flex flex-1 items-center justify-center ${claseIndicador(
                          findes >= 2,
                        )}`}
                      >
                        {findes}F
                      </span>
                    </div>
                  </td>
                )
              })}
              {TURNOS_OP.map((turno, indice) => (
                <td
                  key={turno}
                  className={`${CELDA_PIE} sticky z-30 bg-slate-200 ${
                    indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                  }`}
                  style={stickyDerecha(indice)}
                />
              ))}
            </tr>
          </tfoot>
        </table>
        </div>
        <BolsaPuestosPanel />
      </div>

      {popoverCelda ? (
        <PopoverPuestosCelda
          rect={popoverCelda.rect}
          puestos={
            agentesPorId.get(popoverCelda.agenteId)
              ? puestosPermitidosParaAgente(
                  agentesPorId.get(popoverCelda.agenteId)!,
                )
              : []
          }
          onElegir={(puesto) =>
            aplicarAsignacionCelda(
              popoverCelda.agenteId,
              popoverCelda.fecha,
              popoverCelda.turno,
              puesto,
            )
          }
          onCerrar={() => setPopoverCelda(null)}
        />
      ) : null}

      {diaReparto != null && fechaReparto ? (
        <RepartoOperativoModal
          key={fechaReparto}
          dia={diaReparto}
          fecha={fechaReparto}
          agentes={agentesData}
          cuadrante={cuadrante}
          minimos={minimosParaFecha(fechaReparto, eventosData)}
          asignacionesDia={asignacionesDiarias[fechaReparto] ?? {}}
          onGuardar={(asignaciones) =>
            guardarRepartoDia(fechaReparto, asignaciones)
          }
          onCerrar={() => setDiaReparto(null)}
        />
      ) : null}
    </section>
  )
}
