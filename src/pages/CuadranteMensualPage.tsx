import { useEffect, useMemo, useRef, useState } from 'react'
import { BolsaPuestosPanel, filtroTurnoInicial } from '@/components/BolsaPuestosPanel'
import { PopoverPuestosCelda } from '@/components/PopoverPuestosCelda'
import { RepartoOperativoModal } from '@/components/RepartoOperativoModal'
import { useAgentesData } from '@/lib/agentesStore'
import {
  abreviaturaPuesto,
  asignarPuestoEnCelda,
  asignarPuestoMesAgente,
  crearMinimosDeFecha,
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
  totalMinimosTurno,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import {
  cuadranteDesdeFirestore,
  cuadranteParaFirestore,
  cuadranteVacio,
} from '@/lib/cuadranteFirestore'
import {
  colaMesAnteriorPorAgente,
  mesCalendarioAnterior,
} from '@/lib/cuadranteBordeMes'
import { getAgentes, getCuadrante, saveCuadrante } from '@/lib/db'
import { useEventosData } from '@/lib/eventosStore'
import type { FiltroTurnoBolsa } from '@/lib/bolsaPuestosPreferencias'
import {
  useMinimosSemanaData,
  usePuestosData,
} from '@/lib/puestosStore'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import { usePlanAnual } from '@/lib/planAnualStore'
import {
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
import {
  esPoliciaBolsa,
  type PlanAnual,
  type TurnoAnual,
} from '@/lib/generarPlanAnual'
import { mensajesInfraccion } from '@/lib/reglasCuadrante'
import { exportarCuadranteMensualExcel } from '@/lib/exportarCuadranteMensualExcel'
import {
  contarVariablesCobroAgente,
  sumatorioFMensual,
  totalConciliaciones,
} from '@/lib/variablesCobro'
import { maxFindesConsecutivosLaborados } from '@/lib/finesSemana'
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
  'POLICIA_BOLSA',
]
const ROL_LABEL: Record<RolPolicia, string> = {
  RESPONSABLE: 'Responsable',
  JEFE_SERVICIO: 'Jefe de servicio',
  JEFE_EQUIPO: 'Jefe de equipo',
  POLICIA: 'Policía',
  POLICIA_BOLSA: 'Policía Bolsa',
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

type FiltroVistaTurno = 'TODOS' | 'M' | 'T' | 'N' | 'V'

const TURNOS_VISTA: Array<{ valor: FiltroVistaTurno; label: string }> = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'M', label: 'M' },
  { valor: 'T', label: 'T' },
  { valor: 'N', label: 'N' },
  { valor: 'V', label: 'V' },
]

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function turnoPlanMes(
  agente: { rolBase: RolPolicia; id: string },
  planAnual: PlanAnual,
  mes: number,
): TurnoAnual | null {
  const turno = planAnual[agente.id]?.[mes - 1]
  if (turno != null) return turno
  if (esPoliciaBolsa(agente.rolBase)) return null
  return 'M'
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

function claseSumatorioF(valor: number, valoresGrupo: number[]) {
  if (valoresGrupo.length < 2) {
    return claseIndicador(true)
  }
  const minimo = Math.min(...valoresGrupo)
  const maximo = Math.max(...valoresGrupo)
  const equilibrado = maximo - minimo <= 1 || valor <= minimo + 1
  return claseIndicador(equilibrado)
}

export function CuadranteMensualPage() {
  const [agentesData, setAgentesData] = useAgentesData()
  const [eventosData] = useEventosData()
  const [puestos] = usePuestosData()
  const [minimosSemana] = useMinimosSemanaData()
  const { plan: planAnual, setAnio: setAnioPlan } = usePlanAnual()
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [mes, setMes] = useState(8)
  const [diaDesde, setDiaDesde] = useState(1)
  const [diaHasta, setDiaHasta] = useState(() => diasDelMes(ANIO_ACTUAL, 8))
  const [rolFiltro, setRolFiltro] = useState<'TODOS' | RolPolicia>('TODOS')
  const [filtroVistaTurno, setFiltroVistaTurno] =
    useState<FiltroVistaTurno>('TODOS')
  const [diaReparto, setDiaReparto] = useState<number | null>(null)
  const [asignacionesDiarias, setAsignacionesDiarias] =
    useState<AsignacionesDiarias>({})
  const [cuadrante, setCuadrante] = useState<CuadranteMensual>({})
  const [colaMesAnterior, setColaMesAnterior] = useState<
    Record<string, Turno[]>
  >({})
  const [loadingCuadrante, setLoadingCuadrante] = useState(true)
  const [cuadranteCargaFallida, setCuadranteCargaFallida] = useState(false)
  const [guardandoCuadrante, setGuardandoCuadrante] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [mesGuardadoEnFirestore, setMesGuardadoEnFirestore] = useState(false)
  const [errorCuadrante, setErrorCuadrante] = useState<string | null>(null)
  const [agentesCargados, setAgentesCargados] = useState(false)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())
  const [filtroTurno, setFiltroTurno] =
    useState<FiltroTurnoBolsa>(filtroTurnoInicial)

  const ids = useMemo(
    () => agentesData.map((agente) => agente.id),
    [agentesData],
  )
  const agentesIdsKey = useMemo(
    () => agentesData.map((agente) => agente.id).join('\0'),
    [agentesData],
  )

  const nDias = diasDelMes(anio, mes)
  const objetivo = diasOperativosConvenio(anio, mes)
  const tieneCuadranteLocal = Object.keys(cuadrante).length > 0
  const cuadranteListo =
    !loadingCuadrante && (!cuadranteCargaFallida || tieneCuadranteLocal)
  const puedeAutogenerar = agentesCargados && ids.length > 0
  const cargaCuadranteRef = useRef(0)
  const cuadranteEditadoLocalRef = useRef(false)

  useEffect(() => {
    setAnioPlan(anio)
  }, [anio, setAnioPlan])

  const agentesVisibles = useMemo(
    () =>
      agentesData.filter((agente) => {
        if (rolFiltro !== 'TODOS' && agente.rolBase !== rolFiltro) return false
        if (filtroVistaTurno === 'TODOS') return true
        const turnoPlan = turnoPlanMes(agente, planAnual, mes)
        if (!turnoPlan) return false
        return turnoPlan === filtroVistaTurno
      }),
    [agentesData, rolFiltro, filtroVistaTurno, planAnual, mes],
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

  const sumatoriosFPorTurno = useMemo(() => {
    const mapa = new Map<string, number[]>()
    for (const agente of agentesData) {
      const turno = turnoPlanMes(agente, planAnual, mes)
      const clave = turno ?? '—'
      const fila = cuadrante[agente.id] ?? []
      const valor = sumatorioFMensual(fila, anio, mes, eventosData)
      const lista = mapa.get(clave) ?? []
      lista.push(valor)
      mapa.set(clave, lista)
    }
    return mapa
  }, [agentesData, planAnual, mes, cuadrante, anio, eventosData])

  useEffect(() => {
    let cancelado = false
    async function cargarAgentes() {
      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)
      if (!ready) {
        setAgentesCargados(true)
        return
      }
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
    cuadranteEditadoLocalRef.current = false
    setMesGuardadoEnFirestore(false)
  }, [mes, anio])

  useEffect(() => {
    if (!agentesCargados) return
    const cargaId = ++cargaCuadranteRef.current
    let cancelado = false

    async function cargarCuadranteMes() {
      setLoadingCuadrante(true)
      setErrorCuadrante(null)
      setGuardadoOk(false)
      setCuadranteCargaFallida(false)

      const ready = await ensureFirebase()
      if (cancelado || cargaId !== cargaCuadranteRef.current) return
      setFirebaseOk(ready)

      if (!ready) {
        if (cargaId === cargaCuadranteRef.current) {
          setLoadingCuadrante(false)
        }
        return
      }

      const prev = mesCalendarioAnterior(anio, mes)
      const nDiasPrev = diasDelMes(prev.anio, prev.mes)

      try {
        const [datos, datosPrev] = await Promise.all([
          getCuadrante(mes, anio),
          getCuadrante(prev.mes, prev.anio).catch(() => null),
        ])
        if (cancelado || cargaId !== cargaCuadranteRef.current) return

        if (datosPrev && agentesData.length > 0) {
          const { cuadrante: prevCuad } = cuadranteDesdeFirestore(
            datosPrev,
            agentesData,
            prev.anio,
            prev.mes,
            nDiasPrev,
          )
          setColaMesAnterior(
            colaMesAnteriorPorAgente(prevCuad, ids, prev.anio, prev.mes),
          )
        } else {
          setColaMesAnterior({})
        }

        if (datos && agentesData.length > 0) {
          setMesGuardadoEnFirestore(true)
          if (!cuadranteEditadoLocalRef.current) {
            const { cuadrante: cargado, asignaciones } = cuadranteDesdeFirestore(
              datos,
              agentesData,
              anio,
              mes,
              nDias,
            )
            setCuadrante(cargado)
            setAsignacionesDiarias(asignaciones)
          }
        } else if (agentesData.length > 0) {
          setMesGuardadoEnFirestore(false)
          if (!cuadranteEditadoLocalRef.current) {
            setCuadrante(cuadranteVacio(agentesData, nDias))
            setAsignacionesDiarias({})
          }
        }
      } catch (err) {
        if (!cancelado && cargaId === cargaCuadranteRef.current) {
          setCuadranteCargaFallida(true)
          setErrorCuadrante(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el cuadrante desde Firestore',
          )
        }
      } finally {
        if (!cancelado && cargaId === cargaCuadranteRef.current) {
          setLoadingCuadrante(false)
        }
      }
    }

    void cargarCuadranteMes()
    return () => {
      cancelado = true
    }
  }, [mes, anio, nDias, agentesIdsKey, agentesCargados, agentesData, ids])

  function aplicarMes(siguienteAnio: number, siguienteMes: number) {
    const dias = diasDelMes(siguienteAnio, siguienteMes)
    setAnio(siguienteAnio)
    setMes(siguienteMes)
    setDiaDesde(1)
    setDiaHasta(dias)
  }

  function autogenerar() {
    if (!puedeAutogenerar) return

    if (mesGuardadoEnFirestore || cuadranteEditadoLocalRef.current) {
      const nombreMes = MESES[mes - 1]
      const seguir = window.confirm(
        `¿Volver a autogenerar ${nombreMes} ${anio}?\n\nSe sustituirá el cuadrante actual${
          mesGuardadoEnFirestore
            ? ' (hay uno guardado en Firestore; no se actualiza hasta que pulses Guardar)'
            : ''
        }. Los puestos asignados del mes también se borrarán.`,
      )
      if (!seguir) return
      const confirmar = window.confirm(
        `Confirmación final: se perderán los cambios de ${nombreMes} ${anio} al autogenerar de nuevo.\n\n¿Continuar?`,
      )
      if (!confirmar) return
    }

    cuadranteEditadoLocalRef.current = true
    setCuadranteCargaFallida(false)
    setErrorCuadrante(null)
    setCuadrante(
      generarCuadranteMensual(planAnual, ids, anio, mes, eventosData),
    )
    setAsignacionesDiarias({})
  }

  async function guardarCuadranteEnFirestore() {
    if (cuadranteCargaFallida && !tieneCuadranteLocal) {
      window.alert(
        'No se puede guardar: el cuadrante no se cargó correctamente desde Firestore.',
      )
      return
    }
    const ready = await ensureFirebase()
    setFirebaseOk(ready)
    if (!ready) {
      window.alert('Firebase no configurado. Define VITE_FIREBASE_* en Vercel (valores no vacíos) y redespliega, o en .env.local en desarrollo.')
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
      cuadranteEditadoLocalRef.current = false
      setMesGuardadoEnFirestore(true)
      setCuadranteCargaFallida(false)
      setErrorCuadrante(null)
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
    )
      .filter(
        ({ turno }) => filtroTurno === 'TODOS' || turno === filtroTurno,
      )
      .map(({ fecha, turno }) => ({ fecha, turno }))
    if (fechasTurno.length === 0) {
      window.alert(
        filtroTurno === 'TODOS'
          ? 'Este agente no tiene días operativos este mes'
          : `Este agente no tiene días de ${filtroTurno} este mes`,
      )
      return
    }
    const resultado = asignarPuestoMesAgente(
      asignacionesDiarias,
      agente,
      puesto,
      fechasTurno,
      puestos,
      crearMinimosDeFecha(eventosData, minimosSemana, puestos),
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
    if (filtroTurno !== 'TODOS' && turno !== filtroTurno) return
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
            Convenio: {objetivo} días · fatiga ≤ 5 · D de 2+ · cobertura vs
            mínimos del día
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
          <div
            className="flex items-center gap-0.5"
            title="Muestra solo agentes con ese turno en el plan anual de este mes. Las celdas de otros turnos se atenúan."
          >
            <span className="text-xs font-semibold text-slate-600">Turno</span>
            {TURNOS_VISTA.map((opcion) => (
              <button
                key={opcion.valor}
                type="button"
                className={`h-6 min-w-7 px-1.5 text-[11px] font-bold ${
                  filtroVistaTurno === opcion.valor
                    ? opcion.valor === 'TODOS'
                      ? 'bg-slate-900 text-white'
                      : CLASE_TURNO[opcion.valor]
                    : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
                } ${
                  filtroVistaTurno === opcion.valor && opcion.valor !== 'TODOS'
                    ? 'ring-2 ring-slate-700'
                    : ''
                }`}
                aria-pressed={filtroVistaTurno === opcion.valor}
                onClick={() =>
                  setFiltroVistaTurno((actual) =>
                    actual === opcion.valor && opcion.valor !== 'TODOS'
                      ? 'TODOS'
                      : opcion.valor,
                  )
                }
              >
                {opcion.label}
              </button>
            ))}
          </div>
          <button
            type="button"
            className="h-6 border border-slate-400 bg-white px-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title="Exporta la tabla visible a Excel (mes, filtros y rango de días actual)"
            disabled={!cuadranteListo || agentesVisibles.length === 0}
            onClick={() =>
              exportarCuadranteMensualExcel({
                anio,
                mes,
                diaDesde,
                diaHasta,
                rolLabel:
                  rolFiltro === 'TODOS'
                    ? 'Todos'
                    : ROL_LABEL[rolFiltro],
                turnoVistaLabel:
                  TURNOS_VISTA.find((t) => t.valor === filtroVistaTurno)?.label ??
                  filtroVistaTurno,
                agentes: agentesVisibles,
                agentesTotales: agentesData,
                cuadrante,
                planAnual,
                asignacionesDiarias,
                puestos,
                diasVisibles,
                eventos: eventosData,
              })
            }
          >
            Exportar Excel
          </button>
          <button
            type="button"
            className="h-6 bg-slate-900 px-2 text-xs font-semibold text-white hover:bg-slate-700 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={!puedeAutogenerar}
            title={
              mesGuardadoEnFirestore
                ? 'Sustituye el cuadrante guardado (doble confirmación)'
                : 'Genera el cuadrante del mes desde el plan anual'
            }
            onClick={autogenerar}
          >
            Autogenerar mes
          </button>
          <button
            type="button"
            className="h-6 bg-emerald-700 px-2 text-xs font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50"
            disabled={
              !cuadranteListo || guardandoCuadrante || !firebaseOk
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
        {cuadranteCargaFallida && !tieneCuadranteLocal ? (
          <p className="border-t border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
            No se pudo cargar este mes desde Firestore. Puedes autogenerar el
            cuadrante o recargar la página.
          </p>
        ) : cuadranteCargaFallida ? (
          <p className="border-t border-amber-200 bg-amber-50 px-2 py-1 text-[11px] text-amber-900">
            No se pudo sincronizar con Firestore; se muestra el cuadrante en
            pantalla. Guardar o autogenerar de nuevo actualizará los datos.
          </p>
        ) : null}
        {errorCuadrante ? (
          <p className="border-t border-red-200 bg-red-50 px-2 py-1 text-[11px] text-red-800">
            {errorCuadrante}
          </p>
        ) : null}
        {agentesVisibles.length === 0 && !loadingCuadrante ? (
          <p className="border-t border-slate-200 px-2 py-1 text-[11px] text-slate-600">
            Ningún agente con ese rol o turno este mes.
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
                const turnoPlan = turnoPlanMes(agente, planAnual, mes)
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
                      {nombre} · {turnoPlan ?? '—'}
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
                  title={`Agentes en ${turno} · el rojo es si no llega al mínimo de puestos de ese día`}
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
              for (const agente of agentesData) {
                const turno = cuadrante[agente.id]?.[dia - 1]
                if (turno === 'M' || turno === 'T' || turno === 'N') {
                  totales[turno] += 1
                }
              }
              const fechaDia = isoFecha(anio, mes, dia)
              const minimosDia = minimosParaFecha(
                fechaDia,
                eventosData,
                minimosSemana,
                puestos,
              )

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
                    const avisos = mensajesInfraccion(fila, dia - 1, {
                      anio,
                      mes,
                      colaMesAnterior: colaMesAnterior[agente.id],
                    })
                    const rota = avisos.length > 0
                    const atenuada =
                      filtroVistaTurno !== 'TODOS'
                        ? turno !== filtroVistaTurno
                        : filtroTurno !== 'TODOS' && turno !== filtroTurno
                    const fondoSuave =
                      especial && (turno === 'D' || turno === 'V')
                        ? '!bg-amber-50'
                        : ''
                    return (
                      <td
                        key={agente.id}
                        className={`${CELDA} text-center font-bold ${CLASE_TURNO[turno]} ${fondoSuave} ${
                          rota ? 'border-red-600 !text-red-800' : ''
                        } ${atenuada ? 'opacity-30' : ''} ${
                          operativo && !atenuada
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
                          operativo && !atenuada
                            ? permitirSoltarPuesto
                            : undefined
                        }
                        onDragEnter={
                          operativo && !atenuada
                            ? (event) => {
                                event.currentTarget.dataset.over = 'true'
                              }
                            : undefined
                        }
                        onDragLeave={
                          operativo && !atenuada
                            ? (event) => {
                                event.currentTarget.dataset.over = 'false'
                              }
                            : undefined
                        }
                        onDrop={
                          operativo && !atenuada
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
                          operativo && !atenuada
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
                  {TURNOS_OP.map((turno, indice) => {
                    const minimo = totalMinimosTurno(minimosDia, turno, puestos)
                    return (
                      <td
                        key={turno}
                        className={`${CELDA} sticky z-10 text-center tabular-nums ${
                          indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                        } ${claseMinimo(totales[turno], minimo, especial)}`}
                        style={stickyDerecha(indice)}
                        title={`${totales[turno]} en ${turno} · mínimo ${minimo}`}
                      >
                        {totales[turno]}
                      </td>
                    )
                  })}
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
                const turnoPlan = turnoPlanMes(agente, planAnual, mes)
                const trabajados = totalTrabajados(fila)
                const findes = totalFindesTrabajados(fila, anio, mes)
                const findesConsec = maxFindesConsecutivosLaborados(fila, anio, mes)
                const variables = contarVariablesCobroAgente(
                  fila,
                  anio,
                  mes,
                  eventosData,
                )
                const conciliaciones = totalConciliaciones(variables)
                const sumatorioF = findes + conciliaciones
                const turnoClave = turnoPlan ?? '—'
                const grupoF = sumatoriosFPorTurno.get(turnoClave) ?? [sumatorioF]
                const objetivoFila =
                  turnoPlan === 'V' || turnoPlan == null ? 0 : objetivo
                return (
                  <td
                    key={agente.id}
                    className={`${CELDA_PIE} bg-slate-200`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                    title={`Trabajados ${trabajados} / ${objetivoFila} · F=${sumatorioF} (${findes} findes + ${conciliaciones} conc.) · Máx. findes seguidos ${findesConsec}`}
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
                        className={`flex flex-1 items-center justify-center ${claseSumatorioF(
                          sumatorioF,
                          grupoF,
                        )}`}
                      >
                        {sumatorioF}F
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
        <BolsaPuestosPanel
          filtroTurno={filtroTurno}
          onFiltroTurno={setFiltroTurno}
        />
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
          minimos={minimosParaFecha(
            fechaReparto,
            eventosData,
            minimosSemana,
            puestos,
          )}
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
