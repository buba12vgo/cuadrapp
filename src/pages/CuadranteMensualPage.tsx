import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react'
import { BolsaPuestosPanel, filtroTurnoInicial } from '@/components/BolsaPuestosPanel'
import { BolsaPermisosPanel } from '@/components/BolsaPermisosPanel'
import { JornadaDisponibleChip } from '@/components/JornadaDisponibleChip'
import { CuadranteResumenPanel } from '@/components/dashboard/CuadranteResumenPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
  DashboardSidebar,
} from '@/components/ui/DashboardLayout'
import {
  ALERT_ERROR,
  ALERT_INFO,
  ALERT_WARN,
  BTN_PRIMARY,
  BTN_SECONDARY,
  BTN_SUCCESS,
  CLASE_TURNO_CELDA,
  FOCUS_RING,
  PAGE_SECTION,
  SEMAFORO_KO,
  SEMAFORO_OK,
  SEMAFORO_WARN,
} from '@/lib/uiStyles'
import { AvisoSoloLectura } from '@/components/AvisoSoloLectura'
import { LeyendaTurnos } from '@/components/LeyendaTurnos'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { useAcceso } from '@/contexts/AccesoContext'
import { PageHeader, ToolbarDivider, ToolbarSection } from '@/components/ui/PageHeader'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { PopoverPuestosCelda } from '@/components/PopoverPuestosCelda'
import { RepartoOperativoModal } from '@/components/RepartoOperativoModal'
import { useAgentesData } from '@/lib/agentesStore'
import {
  abreviaturaPuesto,
  asignarPuestoEnCelda,
  asignarPuestoMesAgente,
  crearMinimosDeFecha,
  esTurnoAsignable,
  esTurnoOperativo,
  esTurnoPermiso,
  fechasOperativasAgenteMes,
  leerPermisoArrastrado,
  leerPuestoArrastrado,
  permitirSoltarPuesto,
  puestosPermitidosParaAgente,
  quitarAsignacionCelda,
} from '@/lib/asignacionPuestos'
import {
  type AsignacionesDiarias,
  abreviaturaDesdePuestos,
  minimosParaFecha,
  type PuestoBase,
  totalMinimosTurno,
  type TurnoAsignable,
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
  generarCuadranteMensualAsync,
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
import { maxFindesConsecutivosLaborados, findesLaboradosEnMes, MAX_FINDES_MES, OBJETIVO_FINDES_MES } from '@/lib/finesSemana'
import type { RolPolicia, Turno } from '@/types'
import {
  ROLES_OPERATIVO_CUADRANTE,
  ROL_LABEL,
  agentesOperativosCuadrante,
} from '@/lib/rolesCuadrante'
import { abreviaturaDesdePermisos } from '@/lib/permisos'
import { useTiposPermiso } from '@/lib/permisosStore'
import {
  asegurarRolloverDaaPlantilla,
  cargarResumenesPermisosAnio,
  resumenPermisosVacio,
  type ResumenPermisosAgente,
} from '@/lib/conteoPermisos'
import {
  mensajeSiNoPuedeAsignarCelda,
  mensajeSiNoPuedeAsignarMes,
  resumenesMesCuadrante,
} from '@/lib/saldoPermisoCuadrante'
import {
  abreviaturaJornadaOPuesto,
  conJornadaDisponible,
  esJornadaDisponible,
  NOMBRE_JORNADA_DISPONIBLE,
} from '@/lib/jornadaDisponible'

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
const ROLES = ROLES_OPERATIVO_CUADRANTE
const ANIO_ACTUAL = 2026
const ANCHO_DIA = 28
const ANCHO_TOT = 24
const ANCHO_AGENTE = 32

/** El mes reparte la altura del panel: los 28–31 días quedan a la vista. */
const CELDA =
  'overflow-hidden border border-line px-0 py-0 text-[10px] leading-none'
const CELDA_PIE =
  'overflow-hidden border border-line border-t-2 border-t-slate-300 px-0 py-0 text-[9px] leading-none'
const CAMPO_TOOLBAR =
  'h-7 rounded-md border border-line bg-white px-1.5 text-xs text-ink outline-none focus:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500/40'

const CLASE_TURNO: Record<Turno, string> = {
  M: CLASE_TURNO_CELDA.M,
  T: CLASE_TURNO_CELDA.T,
  N: CLASE_TURNO_CELDA.N,
  MT: CLASE_TURNO_CELDA.MT,
  L: 'bg-emerald-50 font-bold text-emerald-900',
  P: 'bg-rose-100 font-bold text-rose-900',
  D: 'bg-white text-slate-500',
  V: CLASE_TURNO_CELDA.V,
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

function apellidoCorto(apellidos: string) {
  const parte = apellidos.trim().split(/\s+/)[0]
  return parte ? parte.slice(0, 5) : ''
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

function claseMinimo(real: number, minimo: number) {
  return real < minimo ? SEMAFORO_KO : SEMAFORO_OK
}

function CeldaSumatorioMinimo({
  real,
  minimo,
  turno,
  className = CELDA,
  style,
}: {
  real: number
  minimo: number
  turno: TurnoOperativo
  especial?: boolean
  className?: string
  style?: CSSProperties
}) {
  const bajoMinimo = real < minimo
  return (
    <td
      className={`${className} sticky z-10 text-center tabular-nums ${claseMinimo(
        real,
        minimo,
      )}`}
      style={style}
      title={`${real} en ${turno} · mínimo ${minimo}`}
    >
      <div className="flex h-full items-center justify-center gap-px leading-none">
        <span
          className={`text-[10px] font-bold ${bajoMinimo ? 'text-red-900' : ''}`}
        >
          {real}
        </span>
        <span
          className={`text-[9px] font-semibold ${
            bajoMinimo ? 'text-red-800' : 'text-slate-500'
          }`}
        >
          /{minimo}
        </span>
      </div>
    </td>
  )
}

function stickyDerecha(indice: number) {
  return {
    right: (TURNOS_OP.length - 1 - indice) * ANCHO_TOT,
    minWidth: ANCHO_TOT,
    width: ANCHO_TOT,
  }
}

function claseIndicador(ok: boolean) {
  return ok ? SEMAFORO_OK : SEMAFORO_KO
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

function claseFindesMes(cantidad: number) {
  if (cantidad < OBJETIVO_FINDES_MES || cantidad > MAX_FINDES_MES) {
    return SEMAFORO_KO
  }
  if (cantidad > OBJETIVO_FINDES_MES) {
    return SEMAFORO_WARN
  }
  return SEMAFORO_OK
}

export function CuadranteMensualPage() {
  const { alert, confirm } = useAppDialog()
  const { puedeEscribir } = useAcceso()
  const soloLectura = !puedeEscribir('cuadrante-mensual')
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
  const [generandoCuadrante, setGenerandoCuadrante] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [mesGuardadoEnFirestore, setMesGuardadoEnFirestore] = useState(false)
  const [errorCuadrante, setErrorCuadrante] = useState<string | null>(null)
  const [agentesCargados, setAgentesCargados] = useState(false)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())
  const [filtroTurno, setFiltroTurno] =
    useState<FiltroTurnoBolsa>(filtroTurnoInicial)
  const [tiposPermiso] = useTiposPermiso()
  const [puestoSeleccionado, setPuestoSeleccionado] = useState<string | null>(
    null,
  )
  const [permisoSeleccionado, setPermisoSeleccionado] = useState<string | null>(
    null,
  )
  const [resumenesAnio, setResumenesAnio] = useState<
    Record<string, ResumenPermisosAgente>
  >({})
  const [resumenesMesCargado, setResumenesMesCargado] = useState<
    Record<string, ResumenPermisosAgente>
  >({})

  const agentesOperativos = useMemo(
    () => agentesOperativosCuadrante(agentesData),
    [agentesData],
  )

  const ids = useMemo(
    () => agentesOperativos.map((agente) => agente.id),
    [agentesOperativos],
  )
  const agentesIdsKey = useMemo(
    () => agentesOperativos.map((agente) => agente.id).join('\0'),
    [agentesOperativos],
  )

  const nDias = diasDelMes(anio, mes)
  const objetivo = diasOperativosConvenio(anio, mes)
  const tieneCuadranteLocal = Object.keys(cuadrante).length > 0
  const cuadranteListo =
    !loadingCuadrante && (!cuadranteCargaFallida || tieneCuadranteLocal)
  const puedeAutogenerar =
    agentesCargados && ids.length > 0 && !generandoCuadrante
  const cargaCuadranteRef = useRef(0)
  const cuadranteEditadoLocalRef = useRef(false)

  useEffect(() => {
    setAnioPlan(anio)
  }, [anio, setAnioPlan])

  const agentesVisibles = useMemo(
    () =>
      agentesOperativos.filter((agente) => {
        if (rolFiltro !== 'TODOS' && agente.rolBase !== rolFiltro) return false
        if (filtroVistaTurno === 'TODOS') return true
        const turnoPlan = turnoPlanMes(agente, planAnual, mes)
        if (!turnoPlan) return false
        return turnoPlan === filtroVistaTurno
      }),
    [agentesOperativos, rolFiltro, filtroVistaTurno, planAnual, mes],
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
    for (const agente of agentesOperativos) {
      const turno = turnoPlanMes(agente, planAnual, mes)
      const clave = turno ?? '—'
      const fila = cuadrante[agente.id] ?? []
      const valor = sumatorioFMensual(fila, anio, mes, eventosData)
      const lista = mapa.get(clave) ?? []
      lista.push(valor)
      mapa.set(clave, lista)
    }
    return mapa
  }, [agentesOperativos, planAnual, mes, cuadrante, anio, eventosData])

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
    setResumenesMesCargado({})
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
        setMesGuardadoEnFirestore(false)
        if (
          agentesOperativos.length > 0 &&
          !cuadranteEditadoLocalRef.current
        ) {
          setCuadrante(cuadranteVacio(agentesOperativos, nDias))
          setAsignacionesDiarias({})
          setResumenesMesCargado({})
        }
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

        if (datosPrev && agentesOperativos.length > 0) {
          const { cuadrante: prevCuad } = cuadranteDesdeFirestore(
            datosPrev,
            agentesOperativos,
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

        if (datos && agentesOperativos.length > 0) {
          setMesGuardadoEnFirestore(true)
          if (!cuadranteEditadoLocalRef.current) {
            const { cuadrante: cargado, asignaciones } = cuadranteDesdeFirestore(
              datos,
              agentesOperativos,
              anio,
              mes,
              nDias,
              { permisos: tiposPermiso },
            )
            setCuadrante(cargado)
            setAsignacionesDiarias(asignaciones)
            setResumenesMesCargado(
              resumenesMesCuadrante(
                agentesOperativos,
                cargado,
                asignaciones,
                anio,
                mes,
              ),
            )
          }
        } else if (agentesOperativos.length > 0) {
          setMesGuardadoEnFirestore(false)
          if (!cuadranteEditadoLocalRef.current) {
            setCuadrante(cuadranteVacio(agentesOperativos, nDias))
            setAsignacionesDiarias({})
            setResumenesMesCargado({})
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
  }, [mes, anio, nDias, agentesIdsKey, agentesCargados, agentesOperativos, ids, tiposPermiso])

  useEffect(() => {
    if (!agentesCargados || agentesOperativos.length === 0) return
    let cancelado = false
    async function cargarCupos() {
      const ready = await ensureFirebase()
      if (!ready || cancelado) {
        if (!cancelado) setResumenesAnio({})
        return
      }
      try {
        const cambiados = await asegurarRolloverDaaPlantilla(
          agentesOperativos,
          anio,
          tiposPermiso,
        )
        if (cancelado) return
        if (cambiados.length > 0) {
          const porId = new Map(cambiados.map((agente) => [agente.id, agente]))
          setAgentesData((lista) =>
            lista.map((agente) => porId.get(agente.id) ?? agente),
          )
        }
        const resumenes = await cargarResumenesPermisosAnio(
          agentesOperativos,
          anio,
          tiposPermiso,
        )
        if (!cancelado) setResumenesAnio(resumenes)
      } catch {
        if (!cancelado) setResumenesAnio({})
      }
    }
    void cargarCupos()
    return () => {
      cancelado = true
    }
  }, [
    anio,
    agentesIdsKey,
    agentesCargados,
    agentesOperativos,
    tiposPermiso,
    setAgentesData,
  ])

  function aplicarMes(siguienteAnio: number, siguienteMes: number) {
    const dias = diasDelMes(siguienteAnio, siguienteMes)
    setAnio(siguienteAnio)
    setMes(siguienteMes)
    setDiaDesde(1)
    setDiaHasta(dias)
  }

  async function autogenerar() {
    if (soloLectura) return
    if (!puedeAutogenerar || generandoCuadrante) return

    if (mesGuardadoEnFirestore || cuadranteEditadoLocalRef.current) {
      const nombreMes = MESES[mes - 1]
      const seguir = await confirm(
        `¿Volver a autogenerar ${nombreMes} ${anio}?\n\nSe sustituirá el cuadrante actual${
          mesGuardadoEnFirestore
            ? ' (hay uno guardado en Firestore; no se actualiza hasta que pulses Guardar)'
            : ''
        }. Los puestos asignados del mes también se borrarán.`,
        'Autogenerar cuadrante',
      )
      if (!seguir) return
      const confirmar = await confirm(
        `Confirmación final: se perderán los cambios de ${nombreMes} ${anio} al autogenerar de nuevo.\n\n¿Continuar?`,
        'Confirmar autogeneración',
        true,
      )
      if (!confirmar) return
    }

    setGenerandoCuadrante(true)
    setCuadranteCargaFallida(false)
    setErrorCuadrante(null)

    try {
      await new Promise<void>((resolve) => {
        requestAnimationFrame(() => resolve())
      })

      const nuevo = await generarCuadranteMensualAsync(
        planAnual,
        ids,
        anio,
        mes,
        eventosData,
        { minimosSemana, puestos: puestosOperativos },
      )

      cuadranteEditadoLocalRef.current = true
      setCuadrante(nuevo)
      setAsignacionesDiarias({})
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo autogenerar el cuadrante mensual'
      setErrorCuadrante(mensaje)
      await alert(mensaje, 'Error al autogenerar')
    } finally {
      setGenerandoCuadrante(false)
    }
  }

  async function guardarCuadranteEnFirestore() {
    if (soloLectura) return
    if (cuadranteCargaFallida && !tieneCuadranteLocal) {
      await alert(
        'No se puede guardar: el cuadrante no se cargó correctamente desde Firestore.',
        'No se puede guardar',
      )
      return
    }
    const ready = await ensureFirebase()
    setFirebaseOk(ready)
    if (!ready) {
      await alert(
        'Firebase no configurado. Define VITE_FIREBASE_* en Vercel (valores no vacíos) y redespliega, o en .env.local en desarrollo.',
        'Firebase no configurado',
      )
      return
    }
    if (agentesOperativos.length === 0) {
      await alert('No hay agentes cargados para guardar el cuadrante.', 'Sin agentes')
      return
    }

    setGuardandoCuadrante(true)
    setErrorCuadrante(null)
    setGuardadoOk(false)
    try {
      const payload = cuadranteParaFirestore(
        cuadrante,
        asignacionesDiarias,
        agentesOperativos,
        anio,
        mes,
        nDias,
        { puestos: puestosOperativos, permisos: tiposPermiso },
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
      await alert(mensaje, 'Error al guardar')
    } finally {
      setGuardandoCuadrante(false)
    }
  }

  function guardarRepartoDia(
    fecha: string,
    asignaciones: AsignacionesDiarias[string],
  ) {
    if (soloLectura) return
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
    turno: TurnoAsignable
    rect: DOMRect
  } | null>(null)

  const agentesPorId = useMemo(
    () => new Map(agentesOperativos.map((agente) => [agente.id, agente])),
    [agentesOperativos],
  )

  const puestosOperativos = useMemo(
    () => puestos.filter((puesto) => puesto.ambito === 'OPERATIVO'),
    [puestos],
  )
  const nombresPermiso = useMemo(
    () => tiposPermiso.map((permiso) => permiso.nombre),
    [tiposPermiso],
  )

  function marcarEditado() {
    cuadranteEditadoLocalRef.current = true
  }

  function avisarExclusion() {
    void alert('Puesto excluido para este agente', 'Puesto no disponible')
  }

  function seleccionarPuesto(puesto: string | null) {
    setPuestoSeleccionado(puesto)
    if (puesto) setPermisoSeleccionado(null)
  }

  function seleccionarPermiso(permiso: string | null) {
    setPermisoSeleccionado(permiso)
    if (permiso) setPuestoSeleccionado(null)
  }

  function bloquearSiSinSaldoCelda(
    agenteId: string,
    dia: number,
    fecha: string,
    turnoActual: Turno,
    permiso: string,
  ) {
    const agente = agentesPorId.get(agenteId)
    if (!agente) return true
    const mensaje = mensajeSiNoPuedeAsignarCelda({
      agente,
      permisos: tiposPermiso,
      anio,
      mes,
      nDias,
      dia,
      fecha,
      turnoActual,
      permiso,
      cuadrante,
      asignaciones: asignacionesDiarias,
      resumenAnio: resumenesAnio[agenteId] ?? resumenPermisosVacio(),
      mesCargado: resumenesMesCargado[agenteId] ?? resumenPermisosVacio(),
    })
    if (!mensaje) return false
    void alert(mensaje, 'Sin saldo de permiso')
    return true
  }

  function aplicarPermisoEnCelda(
    agenteId: string,
    dia: number,
    fecha: string,
    turnoActual: Turno,
    permiso: string,
  ) {
    if (soloLectura) return
    if (turnoActual === 'V') return
    if (bloquearSiSinSaldoCelda(agenteId, dia, fecha, turnoActual, permiso)) {
      return
    }
    if (turnoActual !== 'P') {
      const indice = dia - 1
      setCuadrante((actual) => {
        const fila = [
          ...(actual[agenteId] ??
            Array.from({ length: nDias }, () => 'D' as Turno)),
        ]
        fila[indice] = 'P'
        return { ...actual, [agenteId]: fila }
      })
      setAsignacionesDiarias((actual) => {
        let siguiente = actual
        if (esTurnoAsignable(turnoActual)) {
          siguiente = quitarAsignacionCelda(
            siguiente,
            agenteId,
            fecha,
            turnoActual,
          )
        }
        return {
          ...siguiente,
          [fecha]: {
            ...(siguiente[fecha] ?? {}),
            P: {
              ...(siguiente[fecha]?.P ?? {}),
              [agenteId]: permiso,
            },
          },
        }
      })
      marcarEditado()
      return
    }
    aplicarAsignacionCelda(agenteId, fecha, 'P', permiso)
  }

  function aplicarAsignacionCelda(
    agenteId: string,
    fecha: string,
    turno: TurnoAsignable,
    puesto: PuestoBase,
  ) {
    if (soloLectura) return
    const agente = agentesPorId.get(agenteId)
    if (!agente) return
    if (esTurnoPermiso(turno)) {
      if (bloquearSiSinSaldoCelda(agenteId, Number(fecha.slice(-2)), fecha, turno, puesto)) {
        return
      }
      setAsignacionesDiarias((actual) => ({
        ...actual,
        [fecha]: {
          ...(actual[fecha] ?? {}),
          P: {
            ...(actual[fecha]?.P ?? {}),
            [agenteId]: puesto,
          },
        },
      }))
      marcarEditado()
      return
    }
    const resultado = asignarPuestoEnCelda(
      asignacionesDiarias,
      agente,
      fecha,
      turno,
      puesto,
      puestosOperativos,
    )
    if (!resultado.ok) {
      avisarExclusion()
      return
    }
    setAsignacionesDiarias(resultado.asignaciones)
    marcarEditado()
  }

  function aplicarAsignacionMesAgente(agenteId: string, puesto: PuestoBase) {
    if (soloLectura) return
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
        ({ turno }) =>
          !esTurnoPermiso(turno) &&
          (filtroTurno === 'TODOS' || turno === filtroTurno),
      )
      .map(({ fecha, turno }) => ({ fecha, turno }))
    if (fechasTurno.length === 0) {
      void alert(
        filtroTurno === 'TODOS'
          ? 'Este agente no tiene días operativos este mes'
          : `Este agente no tiene días de ${filtroTurno} este mes`,
        'Sin días operativos',
      )
      return
    }
    const resultado = asignarPuestoMesAgente(
      asignacionesDiarias,
      agente,
      puesto,
      fechasTurno,
      puestosOperativos,
      crearMinimosDeFecha(eventosData, minimosSemana, puestosOperativos),
    )
    if (!resultado.ok) {
      avisarExclusion()
      return
    }
    setAsignacionesDiarias(resultado.asignaciones)
    marcarEditado()
  }

  function aplicarPermisoMesAgente(agenteId: string, permiso: string) {
    if (soloLectura) return
    const fechasPermiso = fechasOperativasAgenteMes(
      cuadrante,
      agenteId,
      anio,
      mes,
      nDias,
      isoFecha,
    ).filter(({ turno }) => esTurnoPermiso(turno))
    if (fechasPermiso.length === 0) {
      void alert(
        'Este agente no tiene días de permiso (P) este mes.',
        'Sin días de permiso',
      )
      return
    }
    const agente = agentesPorId.get(agenteId)
    if (agente) {
      const mensaje = mensajeSiNoPuedeAsignarMes({
        agente,
        permisos: tiposPermiso,
        anio,
        mes,
        permiso,
        cuadrante,
        asignaciones: asignacionesDiarias,
        resumenAnio: resumenesAnio[agenteId] ?? resumenPermisosVacio(),
        mesCargado: resumenesMesCargado[agenteId] ?? resumenPermisosVacio(),
      })
      if (mensaje) {
        void alert(mensaje, 'Sin saldo de permiso')
        return
      }
    }
    setAsignacionesDiarias((actual) => {
      const copia: AsignacionesDiarias = { ...actual }
      for (const { fecha, turno } of fechasPermiso) {
        copia[fecha] = {
          ...(copia[fecha] ?? {}),
          [turno]: {
            ...(copia[fecha]?.[turno] ?? {}),
            [agenteId]: permiso,
          },
        }
      }
      return copia
    })
    marcarEditado()
  }

  function soltarEnCabeceraAgente(
    event: React.DragEvent,
    agenteId: string,
  ) {
    event.preventDefault()
    if (soloLectura) return
    const permiso = leerPermisoArrastrado(event.dataTransfer, nombresPermiso)
    if (permiso) {
      aplicarPermisoMesAgente(agenteId, permiso)
      return
    }
    const puesto = leerPuestoArrastrado(event.dataTransfer)
    if (!puesto) return
    aplicarAsignacionMesAgente(agenteId, puesto)
  }

  function soltarEnCelda(
    event: React.DragEvent,
    agenteId: string,
    dia: number,
    fecha: string,
    turno: Turno,
  ) {
    event.preventDefault()
    event.stopPropagation()
    if (soloLectura) return
    const permiso = leerPermisoArrastrado(event.dataTransfer, nombresPermiso)
    if (permiso) {
      aplicarPermisoEnCelda(agenteId, dia, fecha, turno, permiso)
      return
    }
    if (!esTurnoAsignable(turno) || esTurnoPermiso(turno)) return
    const puesto = leerPuestoArrastrado(event.dataTransfer)
    if (!puesto) return
    if (filtroTurno !== 'TODOS' && turno !== filtroTurno) return
    aplicarAsignacionCelda(agenteId, fecha, turno, puesto)
  }

  function clicCelda(
    event: React.MouseEvent<HTMLTableCellElement>,
    agenteId: string,
    dia: number,
    turno: Turno,
    fecha: string,
  ) {
    event.stopPropagation()
    if (soloLectura) return
    if (permisoSeleccionado && turno !== 'V') {
      aplicarPermisoEnCelda(
        agenteId,
        dia,
        fecha,
        turno,
        permisoSeleccionado,
      )
      return
    }
    if (
      puestoSeleccionado &&
      esTurnoAsignable(turno) &&
      !esTurnoPermiso(turno)
    ) {
      aplicarAsignacionCelda(agenteId, fecha, turno, puestoSeleccionado)
      return
    }
    if (esTurnoPermiso(turno) || esTurnoOperativo(turno)) {
      setPopoverCelda({
        agenteId,
        fecha,
        turno,
        rect: event.currentTarget.getBoundingClientRect(),
      })
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Cuadrante mensual"
        subtitle={`Convenio: ${objetivo} días · fatiga ≤ 5 · cobertura vs mínimos · permisos y JD${loadingCuadrante ? ' · Cargando…' : ''}${generandoCuadrante ? ' · Generando…' : ''}`}
        status={
          <SaveStatus
            guardando={guardandoCuadrante}
            guardadoOk={guardadoOk}
          />
        }
        toolbar={
          <>
            <ToolbarSection label="Periodo">
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Mes</span>
                <select
                  className={CAMPO_TOOLBAR}
                  value={mes}
                  onChange={(event) =>
                    aplicarMes(anio, Number(event.target.value))
                  }
                >
                  {MESES.map((nombre, indice) => (
                    <option key={nombre} value={indice + 1}>{nombre}</option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Año</span>
                <select
                  className={`${CAMPO_TOOLBAR} min-w-[5.25rem] pr-6`}
                  value={anio}
                  onChange={(event) =>
                    aplicarMes(Number(event.target.value) || anio, mes)
                  }
                >
                  {Array.from({ length: 21 }, (_, i) => 2020 + i).map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Desde</span>
                <input
                  type="date"
                  className={`${CAMPO_TOOLBAR} w-[8.5rem]`}
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
                <span className="text-xs font-medium text-slate-600">Hasta</span>
                <input
                  type="date"
                  className={`${CAMPO_TOOLBAR} w-[8.5rem]`}
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
            </ToolbarSection>
            <ToolbarDivider />
            <ToolbarSection label="Filtros">
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Rol</span>
                <select
                  className={CAMPO_TOOLBAR}
                  value={rolFiltro}
                  onChange={(event) =>
                    setRolFiltro(event.target.value as 'TODOS' | RolPolicia)
                  }
                >
                  <option value="TODOS">Todos</option>
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>{ROL_LABEL[rol]}</option>
                  ))}
                </select>
              </label>
              <div
                className="flex items-center gap-0.5"
                title="Filtra agentes por turno del plan anual"
              >
                <span className="text-xs font-medium text-slate-600">Turno</span>
                {TURNOS_VISTA.map((opcion) => (
                  <button
                    key={opcion.valor}
                    type="button"
                    className={`h-7 min-w-7 rounded-md px-1.5 text-xs font-bold ${FOCUS_RING} ${
                      filtroVistaTurno === opcion.valor
                        ? opcion.valor === 'TODOS'
                          ? 'bg-brand-600 text-white'
                          : CLASE_TURNO[opcion.valor]
                        : 'border border-line bg-white text-slate-700 hover:bg-brand-50'
                    } ${
                      filtroVistaTurno === opcion.valor && opcion.valor !== 'TODOS'
                        ? 'ring-1 ring-brand-400'
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
            </ToolbarSection>
            <ToolbarDivider />
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={!cuadranteListo || agentesVisibles.length === 0}
              onClick={() =>
                exportarCuadranteMensualExcel({
                  anio,
                  mes,
                  diaDesde,
                  diaHasta,
                  rolLabel:
                    rolFiltro === 'TODOS' ? 'Todos' : ROL_LABEL[rolFiltro],
                  turnoVistaLabel:
                    TURNOS_VISTA.find((t) => t.valor === filtroVistaTurno)?.label ??
                    filtroVistaTurno,
                  agentes: agentesVisibles,
                  agentesTotales: agentesOperativos,
                  cuadrante,
                  planAnual,
                  asignacionesDiarias,
                  puestos: puestosOperativos,
                  diasVisibles,
                  eventos: eventosData,
                })
              }
            >
              Exportar
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={soloLectura || !puedeAutogenerar}
              onClick={() => void autogenerar()}
            >
              {generandoCuadrante ? 'Generando…' : 'Autogenerar'}
            </button>
            <button
              type="button"
              className={BTN_SUCCESS}
              disabled={
                soloLectura ||
                !cuadranteListo || guardandoCuadrante || generandoCuadrante || !firebaseOk
              }
              onClick={() => void guardarCuadranteEnFirestore()}
            >
              {guardandoCuadrante ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      />

      {soloLectura ? (
        <AvisoSoloLectura texto="Solo consulta del cuadrante mensual. La edición de jefes está en Cuadrante jefes." />
      ) : null}
      {cuadranteCargaFallida && !tieneCuadranteLocal ? (
        <p className={ALERT_ERROR}>
          No se pudo cargar este mes desde Firestore. Puedes autogenerar el
          cuadrante o recargar la página.
        </p>
      ) : cuadranteCargaFallida ? (
        <p className={ALERT_WARN}>
          No se pudo sincronizar con Firestore; se muestra el cuadrante en
          pantalla.
        </p>
      ) : null}
      {errorCuadrante ? <p className={ALERT_ERROR}>{errorCuadrante}</p> : null}

      {permisoSeleccionado ? (
        <p className={ALERT_INFO}>
          Permiso seleccionado: <strong>{permisoSeleccionado}</strong>. Pulsa
          una celda (excepto V) para marcarla como P.
        </p>
      ) : null}
      {puestoSeleccionado === NOMBRE_JORNADA_DISPONIBLE ? (
        <p className={ALERT_INFO}>
          Jornada Disponible seleccionada. Pulsa una celda M/T/N para marcarla
          como JD (se cobra y genera un LPD).
        </p>
      ) : null}
      {agentesVisibles.length === 0 && !loadingCuadrante ? (
        <p className={ALERT_INFO}>Ningún agente con ese rol o turno este mes.</p>
      ) : null}

      <DashboardBody>
        <DashboardMain>
          <LeyendaTurnos className="border-b border-line" />
          <DashboardMainScroll overflow="x">
          <table className={`rejilla-mes border-separate border-spacing-0 text-[11px] leading-none ${soloLectura ? 'pointer-events-none' : ''}`}>
          <thead>
            <tr>
              <th
                className={`${CELDA} sticky top-0 left-0 z-40 bg-brand-800 text-left font-bold text-white`}
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
                    className={`${CELDA} group relative sticky top-0 z-20 bg-brand-800 text-center font-mono font-bold text-white hover:bg-brand-700 data-[over=true]:bg-brand-600 data-[over=true]:ring-2 data-[over=true]:ring-inset data-[over=true]:ring-amber-300`}
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
                    <span className="block font-mono">{agente.numeroPlaca}</span>
                    <span className="block truncate text-[10px] font-sans font-normal text-slate-600 sm:hidden">
                      {apellidoCorto(agente.apellidos)}
                    </span>
                    <span className="pointer-events-none absolute top-full left-1/2 z-50 hidden -translate-x-1/2 whitespace-nowrap rounded border border-slate-200 bg-white px-2 py-1 text-xs font-sans font-medium text-slate-800 shadow-md group-hover:block">
                      {nombre} · {turnoPlan ?? '—'}
                    </span>
                  </th>
                )
              })}
              {TURNOS_OP.map((turno, indice) => (
                <th
                  key={turno}
                  className={`${CELDA} sticky top-0 z-30 bg-brand-800 text-center font-bold text-white ${
                    indice === 0 ? 'border-l-2 border-l-white/40' : ''
                  }`}
                  style={stickyDerecha(indice)}
                  title={`${turno}: asignados / mínimo del día · rojo si no llega`}
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
              for (const agente of agentesOperativos) {
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
                puestosOperativos,
              )
              const diaCubierto = TURNOS_OP.every(
                (turno) =>
                  totales[turno] >=
                  totalMinimosTurno(minimosDia, turno, puestosOperativos),
              )
              const fondoDia = diaCubierto
                ? 'bg-emerald-50'
                : 'aviso-vivo bg-rose-50'

              return (
                <tr key={dia} className={fondoFila}>
                  <td
                    className={`${CELDA} sticky left-0 z-20 p-0 ${fondoDia}`}
                    style={{ width: ANCHO_DIA, minWidth: ANCHO_DIA }}
                  >
                    <button
                      type="button"
                      className={`flex h-full w-full items-center px-0.5 hover:ring-2 hover:ring-inset hover:ring-brand-500 ${
                        diaCubierto ? 'text-emerald-950' : 'text-rose-900'
                      }`}
                      title={`Reparto operativo · día ${dia}`}
                      onClick={() => setDiaReparto(dia)}
                    >
                      <span className="font-bold">{dia}</span>
                      <span
                        className={`ml-0.5 font-bold ${
                          especial ? 'text-rose-700' : 'opacity-70'
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
                    const turnoAsignable = esTurnoAsignable(turno)
                      ? turno
                      : null
                    const asignado = turnoAsignable
                      ? asignacionesDiarias[fecha]?.[turnoAsignable]?.[
                          agente.id
                        ]
                      : undefined
                    const abrevPuesto = asignado
                      ? esTurnoPermiso(turno)
                        ? abreviaturaDesdePermisos(tiposPermiso, asignado)
                        : esJornadaDisponible(asignado)
                          ? 'JD'
                          : abreviaturaPuesto(
                              asignacionesDiarias,
                              fecha,
                              agente.id,
                              turnoAsignable!,
                            )
                      : null
                    const operativo = esTurnoOperativo(turno)
                    const esP = esTurnoPermiso(turno)
                    const esJd = Boolean(
                      asignado && esJornadaDisponible(asignado),
                    )
                    const avisos = mensajesInfraccion(fila, dia - 1, {
                      anio,
                      mes,
                      colaMesAnterior: colaMesAnterior[agente.id],
                    })
                    const rota = avisos.length > 0
                    const atenuada =
                      filtroVistaTurno !== 'TODOS'
                        ? turno !== filtroVistaTurno
                        : filtroTurno !== 'TODOS' &&
                          turno !== filtroTurno &&
                          !esP
                    const fondoSuave =
                      especial && (turno === 'D' || turno === 'V')
                        ? '!bg-amber-50'
                        : esJd
                          ? '!bg-violet-50'
                          : ''
                    const interactiva =
                      !atenuada &&
                      (operativo ||
                        esP ||
                        (turno !== 'V' && Boolean(permisoSeleccionado)))
                    return (
                      <td
                        key={agente.id}
                        className={`${CELDA} text-center font-bold ${CLASE_TURNO[turno]} ${fondoSuave} ${
                          rota ? 'aviso-vivo border-red-600 !text-red-800' : ''
                        } ${atenuada ? 'opacity-30' : ''} ${
                          interactiva
                            ? 'cursor-pointer hover:z-10 hover:ring-2 hover:ring-blue-500 data-[over=true]:ring-2 data-[over=true]:ring-emerald-600'
                            : ''
                        }`}
                        title={
                          avisos.length > 0
                            ? avisos.join(' · ')
                            : interactiva
                              ? `${agente.numeroPlaca} · día ${dia} · ${turno}${abrevPuesto ? ` · ${abrevPuesto}` : ''} · clic o arrastrar puesto/permiso/JD`
                              : `${agente.numeroPlaca} · día ${dia} · ${turno}`
                        }
                        onDragOver={
                          turno !== 'V' && !atenuada
                            ? permitirSoltarPuesto
                            : undefined
                        }
                        onDragEnter={
                          turno !== 'V' && !atenuada
                            ? (event) => {
                                event.currentTarget.dataset.over = 'true'
                              }
                            : undefined
                        }
                        onDragLeave={
                          turno !== 'V' && !atenuada
                            ? (event) => {
                                event.currentTarget.dataset.over = 'false'
                              }
                            : undefined
                        }
                        onDrop={
                          turno !== 'V' && !atenuada
                            ? (event) => {
                                event.currentTarget.dataset.over = 'false'
                                soltarEnCelda(
                                  event,
                                  agente.id,
                                  dia,
                                  fecha,
                                  turno,
                                )
                              }
                            : undefined
                        }
                        onClick={
                          interactiva
                            ? (event) =>
                                clicCelda(
                                  event,
                                  agente.id,
                                  dia,
                                  turno,
                                  fecha,
                                )
                            : undefined
                        }
                      >
                        <span className="block truncate px-0.5 text-[10px] leading-none">
                          {abrevPuesto ? `${turno}·${abrevPuesto}` : turno}
                        </span>
                      </td>
                    )
                  })}
                  {TURNOS_OP.map((turno, indice) => {
                    const minimo = totalMinimosTurno(minimosDia, turno, puestosOperativos)
                    return (
                      <CeldaSumatorioMinimo
                        key={turno}
                        real={totales[turno]}
                        minimo={minimo}
                        turno={turno}
                        especial={especial}
                        className={`${CELDA} ${
                          indice === 0 ? 'border-l-2 border-l-slate-600' : ''
                        }`}
                        style={stickyDerecha(indice)}
                      />
                    )
                  })}
                </tr>
              )
            })}
          </tbody>
          <tfoot className="z-20">
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
                const findesDias = totalFindesTrabajados(fila, anio, mes)
                const findesMes = findesLaboradosEnMes(fila, anio, mes)
                const findesConsec = maxFindesConsecutivosLaborados(fila, anio, mes)
                const variables = contarVariablesCobroAgente(
                  fila,
                  anio,
                  mes,
                  eventosData,
                )
                const conciliaciones = totalConciliaciones(variables)
                const festivos = variables.festivo
                const sumatorioF = festivos + conciliaciones
                const turnoClave = turnoPlan ?? '—'
                const grupoF = sumatoriosFPorTurno.get(turnoClave) ?? [sumatorioF]
                const objetivoFila =
                  turnoPlan === 'V' || turnoPlan == null ? 0 : objetivo
                return (
                  <td
                    key={agente.id}
                    className={`${CELDA_PIE} bg-slate-200`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                    title={`Trabajados ${trabajados} / ${objetivoFila} · Findes ${findesMes}/${OBJETIVO_FINDES_MES} (máx. ${MAX_FINDES_MES}, prohibido 0 y 1) · ${findesDias} días finde · Máx. seguidos ${findesConsec} · F=${sumatorioF} (${festivos} fest. + ${conciliaciones} conc.)`}
                  >
                    <div
                      className="flex h-full items-center justify-center gap-0.5 leading-none"
                      title={`Trabajados ${trabajados} / ${objetivoFila} · Findes ${findesMes}/${OBJETIVO_FINDES_MES} · F=${sumatorioF}`}
                    >
                      <span
                        className={claseIndicador(trabajados === objetivoFila)}
                      >
                        {trabajados}d
                      </span>
                      <span className={claseFindesMes(findesMes)}>
                        {findesMes}nf
                      </span>
                      <span className={claseSumatorioF(sumatorioF, grupoF)}>
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
          </DashboardMainScroll>
        </DashboardMain>
        <DashboardSidebar className={soloLectura ? 'pointer-events-none opacity-60' : ''}>
          <CuadranteResumenPanel
            agentesVisibles={agentesVisibles.length}
            diaDesde={diaDesde}
            diaHasta={diaHasta}
            nDias={nDias}
            guardado={mesGuardadoEnFirestore}
          />
          <BolsaPuestosPanel
            filtroTurno={filtroTurno}
            onFiltroTurno={setFiltroTurno}
            ambito="OPERATIVO"
            puestoSeleccionado={
              puestoSeleccionado === NOMBRE_JORNADA_DISPONIBLE
                ? null
                : puestoSeleccionado
            }
            onSeleccionarPuesto={seleccionarPuesto}
          />
          <JornadaDisponibleChip
            seleccionado={puestoSeleccionado === NOMBRE_JORNADA_DISPONIBLE}
            onSeleccionar={seleccionarPuesto}
          />
          <BolsaPermisosPanel
            permisoSeleccionado={permisoSeleccionado}
            onSeleccionarPermiso={seleccionarPermiso}
          />
        </DashboardSidebar>
      </DashboardBody>

      {popoverCelda ? (
        <PopoverPuestosCelda
          rect={popoverCelda.rect}
          titulo={
            esTurnoPermiso(popoverCelda.turno)
              ? 'Asignar permiso'
              : 'Asignar puesto'
          }
          vacio={
            esTurnoPermiso(popoverCelda.turno)
              ? 'Sin tipos de permiso'
              : 'Sin puestos permitidos'
          }
          abreviaturaDe={
            esTurnoPermiso(popoverCelda.turno)
              ? (nombre) => abreviaturaDesdePermisos(tiposPermiso, nombre)
              : (nombre) =>
                  abreviaturaJornadaOPuesto(nombre, (puesto) =>
                    abreviaturaDesdePuestos(puestosOperativos, puesto),
                  )
          }
          puestos={
            esTurnoPermiso(popoverCelda.turno)
              ? nombresPermiso
              : agentesPorId.get(popoverCelda.agenteId)
                ? conJornadaDisponible(
                    puestosPermitidosParaAgente(
                      agentesPorId.get(popoverCelda.agenteId)!,
                      puestosOperativos,
                      'OPERATIVO',
                    ),
                  )
                : [NOMBRE_JORNADA_DISPONIBLE]
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
          agentes={agentesOperativos}
          cuadrante={cuadrante}
          minimos={minimosParaFecha(
            fechaReparto,
            eventosData,
            minimosSemana,
            puestosOperativos,
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
