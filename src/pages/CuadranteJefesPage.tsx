import { useEffect, useMemo, useRef, useState } from 'react'
import { BolsaPuestosPanel, filtroTurnoInicial } from '@/components/BolsaPuestosPanel'
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
  BTN_SECONDARY,
  BTN_SUCCESS,
  CLASE_TURNO_CELDA,
  FOCUS_RING,
  PAGE_SECTION,
} from '@/lib/uiStyles'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader, ToolbarSection } from '@/components/ui/PageHeader'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { PopoverPuestosCelda } from '@/components/PopoverPuestosCelda'
import { useAgentesData } from '@/lib/agentesStore'
import {
  abreviaturaPuesto,
  asignarPuestoEnCelda,
  asignarPuestoMesAgente,
  esTurnoAsignable,
  etiquetaTurno,
  fechasOperativasAgenteMes,
  leerPuestoArrastrado,
  permitirSoltarPuesto,
  puestosPermitidosParaAgente,
  turnoCoincideFiltro,
} from '@/lib/asignacionPuestos'
import type { AsignacionesDiarias, PuestoBase, TurnoAsignable } from '@/lib/calendarioPuestos'
import {
  cuadranteDesdeFirestore,
  cuadranteParaFirestore,
  cuadranteVacio,
} from '@/lib/cuadranteFirestore'
import {
  diasDelMes,
  esFinDeSemana,
  pesoJornadaJefes,
  totalDiasTrabajadosJefes,
} from '@/lib/convenio'
import { getAgentes, getCuadranteJefes, saveCuadranteJefes } from '@/lib/db'
import { esFestivo } from '@/lib/festivos'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import type { FiltroTurnoBolsa } from '@/lib/bolsaPuestosPreferencias'
import { usePuestosData } from '@/lib/puestosStore'
import { agentesCuadranteJefes, ROL_LABEL } from '@/lib/rolesCuadrante'
import { exportarCuadranteJefesPdf } from '@/lib/exportarCuadranteJefesPdf'
import type { Turno } from '@/types'

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
const ANIO_ACTUAL = 2026
const ANCHO_DIA = 28
const ANCHO_AGENTE = 168
const ANCHO_SUMA = 40

const CELDA =
  'h-[26px] max-h-[26px] overflow-hidden border border-line px-0 py-0 text-[10px] leading-none'
const CELDA_DIA =
  'h-[32px] max-h-[32px] overflow-hidden border border-line px-0 py-0 text-[10px] leading-none'
const CELDA_PIE =
  'h-[26px] max-h-[26px] overflow-hidden border border-line border-t-2 border-t-slate-300 bg-slate-100 px-0 py-0 text-[10px] leading-none font-bold'
const CAMPO_TOOLBAR =
  'h-7 rounded-md border border-line bg-white px-1.5 text-xs text-ink outline-none focus:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500/40'

const CLASE_TURNO: Record<Turno, string> = {
  M: CLASE_TURNO_CELDA.M,
  T: CLASE_TURNO_CELDA.T,
  N: CLASE_TURNO_CELDA.N,
  MT: CLASE_TURNO_CELDA.MT,
  L: 'bg-emerald-50 text-emerald-900',
  D: 'bg-white text-slate-500',
  V: CLASE_TURNO_CELDA.V,
}

/** Laboral: D → M → T → N → L → V. Finde: incluye M-T (Mañana Tarde). */
const CICLO_SEMANA: Turno[] = ['D', 'M', 'T', 'N', 'L', 'V']
const CICLO_FINDE: Turno[] = ['D', 'M', 'T', 'N', 'MT', 'L', 'V']

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

function desgloseTurnosJefes(fila: Turno[], dias: readonly number[]) {
  const c = { M: 0, T: 0, N: 0, MT: 0, L: 0 }
  for (const dia of dias) {
    const turno = fila[dia - 1]
    if (turno === 'M' || turno === 'T' || turno === 'N' || turno === 'MT' || turno === 'L') {
      c[turno] += 1
    }
  }
  return c
}

function tituloSumatorioJefe(fila: Turno[], dias: readonly number[]) {
  const d = desgloseTurnosJefes(fila, dias)
  const total = totalDiasTrabajadosJefes(fila, dias)
  return `Trabajados ${total}d (M-T vale 2) · M ${d.M} · T ${d.T} · N ${d.N} · M-T ${d.MT} · L ${d.L}`
}

function siguienteTurno(actual: Turno, finde: boolean): Turno {
  const ciclo = finde ? CICLO_FINDE : CICLO_SEMANA
  const indice = ciclo.indexOf(actual)
  if (indice >= 0) return ciclo[(indice + 1) % ciclo.length]!
  if (actual === 'MT') return 'L'
  return 'D'
}

function quitarAsignacionCelda(
  asignaciones: AsignacionesDiarias,
  agenteId: string,
  fecha: string,
  turno: TurnoAsignable,
): AsignacionesDiarias {
  const porTurno = asignaciones[fecha]
  if (!porTurno?.[turno]?.[agenteId]) return asignaciones
  const copia: AsignacionesDiarias = { ...asignaciones, [fecha]: { ...porTurno } }
  const agentesTurno = { ...porTurno[turno] }
  delete agentesTurno[agenteId]
  if (Object.keys(agentesTurno).length === 0) {
    const rest = { ...copia[fecha] }
    delete rest[turno]
    if (Object.keys(rest).length === 0) {
      const sinFecha = { ...asignaciones }
      delete sinFecha[fecha]
      return sinFecha
    }
    copia[fecha] = rest
  } else {
    copia[fecha] = { ...copia[fecha], [turno]: agentesTurno }
  }
  return copia
}

export function CuadranteJefesPage() {
  const { alert } = useAppDialog()
  const [agentesData, setAgentesData] = useAgentesData()
  const [puestos] = usePuestosData()
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [diaDesde, setDiaDesde] = useState(1)
  const [diaHasta, setDiaHasta] = useState(() =>
    diasDelMes(ANIO_ACTUAL, new Date().getMonth() + 1),
  )
  const [cuadrante, setCuadrante] = useState<CuadranteMensual>({})
  const [asignacionesDiarias, setAsignacionesDiarias] =
    useState<AsignacionesDiarias>({})
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
  const [puestoSeleccionado, setPuestoSeleccionado] = useState<string | null>(
    null,
  )
  const [popoverCelda, setPopoverCelda] = useState<{
    agenteId: string
    fecha: string
    turno: TurnoAsignable
    rect: DOMRect
  } | null>(null)

  const jefes = useMemo(() => agentesCuadranteJefes(agentesData), [agentesData])
  const jefesIdsKey = useMemo(
    () => jefes.map((agente) => agente.id).join('\0'),
    [jefes],
  )
  const puestosJefes = useMemo(
    () => puestos.filter((puesto) => puesto.ambito === 'JEFE_SERVICIO'),
    [puestos],
  )
  const agentesPorId = useMemo(
    () => new Map(jefes.map((agente) => [agente.id, agente])),
    [jefes],
  )

  const nDias = diasDelMes(anio, mes)
  const tieneCuadranteLocal = Object.keys(cuadrante).length > 0
  const cuadranteListo =
    !loadingCuadrante && (!cuadranteCargaFallida || tieneCuadranteLocal)
  const cargaCuadranteRef = useRef(0)
  const cuadranteEditadoLocalRef = useRef(false)

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
        // Se gestiona al pintar.
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

    async function cargar() {
      setLoadingCuadrante(true)
      setErrorCuadrante(null)
      setGuardadoOk(false)
      setCuadranteCargaFallida(false)

      const ready = await ensureFirebase()
      if (cancelado || cargaId !== cargaCuadranteRef.current) return
      setFirebaseOk(ready)

      if (!ready) {
        if (cargaId === cargaCuadranteRef.current) setLoadingCuadrante(false)
        return
      }

      try {
        const datos = await getCuadranteJefes(mes, anio)
        if (cancelado || cargaId !== cargaCuadranteRef.current) return

        if (datos && jefes.length > 0) {
          setMesGuardadoEnFirestore(true)
          if (!cuadranteEditadoLocalRef.current) {
            const { cuadrante: cargado, asignaciones } = cuadranteDesdeFirestore(
              datos,
              jefes,
              anio,
              mes,
              nDias,
              puestos,
            )
            setCuadrante(cargado)
            setAsignacionesDiarias(asignaciones)
          }
        } else if (jefes.length > 0) {
          setMesGuardadoEnFirestore(false)
          if (!cuadranteEditadoLocalRef.current) {
            setCuadrante(cuadranteVacio(jefes, nDias))
            setAsignacionesDiarias({})
          }
        } else {
          setCuadrante({})
          setAsignacionesDiarias({})
        }
      } catch (err) {
        if (!cancelado && cargaId === cargaCuadranteRef.current) {
          setCuadranteCargaFallida(true)
          setErrorCuadrante(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el cuadrante de jefes',
          )
        }
      } finally {
        if (!cancelado && cargaId === cargaCuadranteRef.current) {
          setLoadingCuadrante(false)
        }
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [mes, anio, nDias, jefesIdsKey, agentesCargados, jefes, puestos])

  function aplicarMes(siguienteAnio: number, siguienteMes: number) {
    const dias = diasDelMes(siguienteAnio, siguienteMes)
    setAnio(siguienteAnio)
    setMes(siguienteMes)
    setDiaDesde(1)
    setDiaHasta(dias)
  }

  function marcarEditado() {
    cuadranteEditadoLocalRef.current = true
  }

  function ciclarTurnoCelda(agenteId: string, dia: number) {
    const indice = dia - 1
    const filaActual =
      cuadrante[agenteId] ?? Array.from({ length: nDias }, () => 'D' as Turno)
    const anterior = filaActual[indice] ?? 'D'
    const siguiente = siguienteTurno(anterior, esFinDeSemana(anio, mes, dia))
    const fecha = isoFecha(anio, mes, dia)

    setCuadrante((actual) => {
      const fila = [...(actual[agenteId] ?? Array.from({ length: nDias }, () => 'D' as Turno))]
      fila[indice] = siguiente
      return { ...actual, [agenteId]: fila }
    })
    if (esTurnoAsignable(anterior)) {
      setAsignacionesDiarias((actual) =>
        quitarAsignacionCelda(actual, agenteId, fecha, anterior),
      )
    }
    marcarEditado()
  }

  function aplicarAsignacionCelda(
    agenteId: string,
    fecha: string,
    turno: TurnoAsignable,
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
      puestosJefes,
    )
    if (!resultado.ok) {
      void alert('Puesto excluido para este agente', 'Puesto no disponible')
      return
    }
    setAsignacionesDiarias(resultado.asignaciones)
    marcarEditado()
  }

  function soltarEnCelda(
    event: React.DragEvent,
    agenteId: string,
    fecha: string,
    turno: TurnoAsignable,
  ) {
    event.preventDefault()
    event.stopPropagation()
    const puesto = leerPuestoArrastrado(event.dataTransfer, puestosJefes)
    if (!puesto) return
    if (!turnoCoincideFiltro(turno, filtroTurno)) return
    aplicarAsignacionCelda(agenteId, fecha, turno, puesto)
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
      .filter(({ turno }) => turnoCoincideFiltro(turno, filtroTurno))
      .map(({ fecha, turno }) => ({ fecha, turno }))
    if (fechasTurno.length === 0) {
      void alert(
        filtroTurno === 'TODOS'
          ? 'Este jefe no tiene días con turno este mes.'
          : `Este jefe no tiene días de ${etiquetaTurno(filtroTurno)} este mes.`,
        'Sin días con turno',
      )
      return
    }
    const resultado = asignarPuestoMesAgente(
      asignacionesDiarias,
      agente,
      puesto,
      fechasTurno,
      puestosJefes,
    )
    if (!resultado.ok) {
      void alert('Puesto excluido para este agente', 'Puesto no disponible')
      return
    }
    setAsignacionesDiarias(resultado.asignaciones)
    marcarEditado()
  }

  function soltarEnCabeceraJefe(event: React.DragEvent, agenteId: string) {
    event.preventDefault()
    const puesto = leerPuestoArrastrado(event.dataTransfer, puestosJefes)
    if (!puesto) return
    aplicarAsignacionMesAgente(agenteId, puesto)
  }

  function clicCelda(
    event: React.MouseEvent<HTMLTableCellElement>,
    agenteId: string,
    dia: number,
    turno: Turno,
    fecha: string,
  ) {
    event.stopPropagation()
    const operativo = esTurnoAsignable(turno)

    if (puestoSeleccionado && operativo) {
      aplicarAsignacionCelda(agenteId, fecha, turno, puestoSeleccionado)
      return
    }

    if (event.shiftKey && operativo) {
      setPopoverCelda({
        agenteId,
        fecha,
        turno,
        rect: event.currentTarget.getBoundingClientRect(),
      })
      return
    }

    ciclarTurnoCelda(agenteId, dia)
  }

  async function guardarCuadranteEnFirestore() {
    if (cuadranteCargaFallida && !tieneCuadranteLocal) {
      await alert(
        'No se puede guardar: el cuadrante no se cargó correctamente.',
        'No se puede guardar',
      )
      return
    }
    const ready = await ensureFirebase()
    setFirebaseOk(ready)
    if (!ready) {
      await alert(
        'Firebase no configurado. Define VITE_FIREBASE_* y redespliega.',
        'Firebase no configurado',
      )
      return
    }
    if (jefes.length === 0) {
      await alert(
        'No hay jefes de servicio ni responsables en la plantilla.',
        'Sin plantilla',
      )
      return
    }

    setGuardandoCuadrante(true)
    setErrorCuadrante(null)
    setGuardadoOk(false)
    try {
      const payload = cuadranteParaFirestore(
        cuadrante,
        asignacionesDiarias,
        jefes,
        anio,
        mes,
        nDias,
        puestos,
      )
      await saveCuadranteJefes(mes, anio, payload)
      cuadranteEditadoLocalRef.current = false
      setMesGuardadoEnFirestore(true)
      setCuadranteCargaFallida(false)
      setGuardadoOk(true)
      window.setTimeout(() => setGuardadoOk(false), 3000)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el cuadrante de jefes'
      setErrorCuadrante(mensaje)
      await alert(mensaje, 'Error al guardar')
    } finally {
      setGuardandoCuadrante(false)
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Cuadrante jefes de servicio"
        subtitle={`Jefes y responsables · mensual · clic cicla turno · finde incluye M-T · Shift+clic o arrastre asigna puesto · arrastre al nombre = todos los días con turno${loadingCuadrante ? ' · Cargando…' : ''}${mesGuardadoEnFirestore ? '' : ' · Sin guardar'}`}
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
                    <option key={nombre} value={indice + 1}>
                      {nombre}
                    </option>
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
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={!cuadranteListo || jefes.length === 0}
              onClick={() => {
                try {
                  exportarCuadranteJefesPdf({
                    anio,
                    mes,
                    agentes: jefes,
                    cuadrante,
                    asignacionesDiarias,
                    puestos,
                    diasVisibles,
                  })
                } catch (err) {
                  void alert(
                    err instanceof Error
                      ? err.message
                      : 'No se pudo exportar el PDF',
                    'Exportar PDF',
                  )
                }
              }}
            >
              Exportar PDF
            </button>
            <button
              type="button"
              className={BTN_SUCCESS}
              disabled={
                !cuadranteListo ||
                guardandoCuadrante ||
                !firebaseOk ||
                jefes.length === 0
              }
              onClick={() => void guardarCuadranteEnFirestore()}
            >
              {guardandoCuadrante ? 'Guardando…' : 'Guardar'}
            </button>
          </>
        }
      />

      {cuadranteCargaFallida && !tieneCuadranteLocal ? (
        <p className={ALERT_ERROR}>
          No se pudo cargar este mes. Recarga la página o prueba otro periodo.
        </p>
      ) : cuadranteCargaFallida ? (
        <p className={ALERT_WARN}>
          No se pudo sincronizar con Firestore; se muestra el borrador local.
        </p>
      ) : null}
      {errorCuadrante ? <p className={ALERT_ERROR}>{errorCuadrante}</p> : null}
      {jefes.length === 0 && !loadingCuadrante ? (
        <p className={ALERT_INFO}>
          No hay jefes de servicio ni responsables en la plantilla. Añádelos en
          Agentes.
        </p>
      ) : null}
      {puestoSeleccionado ? (
        <p className={ALERT_INFO}>
          Puesto seleccionado: <strong>{puestoSeleccionado}</strong>. Pulsa una
          celda con turno (M/T/N/M-T) para asignarlo (o cicla el turno con clic).
        </p>
      ) : null}

      <DashboardBody>
        <DashboardMain>
          <DashboardMainScroll>
            <table className="w-max border-separate border-spacing-0 text-[11px] leading-none">
              <thead>
                <tr>
                  <th
                    className={`${CELDA_DIA} sticky top-0 left-0 z-40 bg-white px-1.5 text-left font-bold`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                  >
                    Agente
                  </th>
                  {diasVisibles.map((dia) => {
                    const weekday = new Date(anio, mes - 1, dia).getDay()
                    const especial =
                      esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
                    return (
                      <th
                        key={dia}
                        className={`${CELDA_DIA} sticky top-0 z-20 text-center ${
                          especial ? 'bg-amber-50' : 'bg-white'
                        }`}
                        style={{ width: ANCHO_DIA, minWidth: ANCHO_DIA }}
                      >
                        <span
                          className={`block font-bold ${especial ? 'text-red-600' : ''}`}
                        >
                          {dia}
                        </span>
                        <span
                          className={`block text-[9px] font-bold ${
                            especial ? 'text-red-600' : 'text-slate-500'
                          }`}
                        >
                          {DIA_SEMANA[weekday]}
                        </span>
                      </th>
                    )
                  })}
                  <th
                    className={`${CELDA_DIA} sticky top-0 right-0 z-30 border-l-2 border-l-slate-600 bg-slate-100 text-center font-bold`}
                    style={{ width: ANCHO_SUMA, minWidth: ANCHO_SUMA }}
                    title="Días trabajados · M-T cuenta como 2"
                  >
                    Σ
                  </th>
                </tr>
              </thead>
              <tbody>
                {jefes.map((agente) => {
                  const nombre = `${agente.nombre} ${agente.apellidos}`
                  const rol = ROL_LABEL[agente.rolBase]
                  const fila = cuadrante[agente.id] ?? []
                  const totalAgente = totalDiasTrabajadosJefes(fila, diasVisibles)
                  return (
                    <tr key={agente.id}>
                      <th
                        className={`${CELDA} sticky left-0 z-30 bg-white px-1.5 text-left font-sans font-semibold hover:bg-blue-50 data-[over=true]:bg-blue-100 data-[over=true]:ring-2 data-[over=true]:ring-inset data-[over=true]:ring-blue-500`}
                        style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                        title={`${nombre} · ${rol} · soltar puesto = todos los días con turno`}
                        onDragOver={permitirSoltarPuesto}
                        onDragEnter={(event) => {
                          event.currentTarget.dataset.over = 'true'
                        }}
                        onDragLeave={(event) => {
                          event.currentTarget.dataset.over = 'false'
                        }}
                        onDrop={(event) => {
                          event.currentTarget.dataset.over = 'false'
                          soltarEnCabeceraJefe(event, agente.id)
                        }}
                      >
                        <span className="flex min-w-0 items-center gap-1.5">
                          <span className="shrink-0 font-mono font-bold">
                            {agente.numeroPlaca}
                          </span>
                          <span className="min-w-0 truncate font-sans font-medium text-ink">
                            {nombre}
                          </span>
                        </span>
                      </th>
                      {diasVisibles.map((dia) => {
                        const turno = fila[dia - 1] ?? 'D'
                        const fecha = isoFecha(anio, mes, dia)
                        const operativo = esTurnoAsignable(turno)
                        const abrevPuesto = operativo
                          ? abreviaturaPuesto(
                              asignacionesDiarias,
                              fecha,
                              agente.id,
                              turno,
                              puestos,
                            )
                          : null
                        const atenuada = !turnoCoincideFiltro(turno, filtroTurno)
                        const especial =
                          esFinDeSemana(anio, mes, dia) ||
                          esFestivo(anio, mes, dia)
                        const fondoSuave =
                          especial && (turno === 'D' || turno === 'V')
                            ? '!bg-amber-50'
                            : ''
                        return (
                          <td
                            key={dia}
                            className={`${CELDA} cursor-pointer text-center font-bold ${CLASE_TURNO[turno]} ${fondoSuave} ${
                              atenuada ? 'opacity-30' : ''
                            } ${
                              !atenuada
                                ? `hover:z-10 hover:ring-2 hover:ring-blue-500 ${FOCUS_RING} data-[over=true]:ring-2 data-[over=true]:ring-emerald-600`
                                : ''
                            }`}
                            title={
                              operativo
                                ? `${agente.numeroPlaca} · día ${dia} · ${etiquetaTurno(turno)}${turno === 'MT' ? ' (Mañana Tarde)' : ''}${abrevPuesto ? ` · ${abrevPuesto}` : ''} · clic=ciclo · Shift+clic=puesto · arrastrar`
                                : `${agente.numeroPlaca} · día ${dia} · ${etiquetaTurno(turno)} · clic cicla turno`
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
                            onClick={(event) =>
                              atenuada
                                ? undefined
                                : clicCelda(
                                    event,
                                    agente.id,
                                    dia,
                                    turno,
                                    fecha,
                                  )
                            }
                          >
                            <span className="block truncate px-0.5 text-[10px] leading-none">
                              {abrevPuesto
                                ? `${etiquetaTurno(turno)}·${abrevPuesto}`
                                : etiquetaTurno(turno)}
                            </span>
                          </td>
                        )
                      })}
                      <td
                        className={`${CELDA} sticky right-0 z-20 border-l-2 border-l-slate-600 bg-slate-100 text-center font-bold tabular-nums`}
                        style={{
                          width: ANCHO_SUMA,
                          minWidth: ANCHO_SUMA,
                        }}
                        title={tituloSumatorioJefe(fila, diasVisibles)}
                      >
                        {totalAgente}d
                      </td>
                    </tr>
                  )
                })}
              </tbody>
              <tfoot>
                <tr>
                  <th
                    className={`${CELDA_PIE} sticky bottom-0 left-0 z-40 px-1.5 text-left`}
                    style={{ width: ANCHO_AGENTE, minWidth: ANCHO_AGENTE }}
                    title="Agentes de servicio ese día · M-T cuenta 1 persona y 2 jornadas en Σ"
                  >
                    Σ
                  </th>
                  {diasVisibles.map((dia) => {
                    const enServicio = jefes.filter((agente) =>
                      pesoJornadaJefes((cuadrante[agente.id] ?? [])[dia - 1]) >
                      0,
                    ).length
                    const especial =
                      esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
                    return (
                      <td
                        key={dia}
                        className={`${CELDA_PIE} sticky bottom-0 z-20 text-center tabular-nums ${
                          especial ? 'bg-amber-100' : ''
                        }`}
                        title={`${enServicio} agente${enServicio === 1 ? '' : 's'} de servicio`}
                      >
                        {enServicio}
                      </td>
                    )
                  })}
                  <td
                    className={`${CELDA_PIE} sticky bottom-0 right-0 z-40 border-l-2 border-l-slate-600 text-center tabular-nums`}
                    style={{ width: ANCHO_SUMA, minWidth: ANCHO_SUMA }}
                    title="Suma de días trabajados (M-T = 2)"
                  >
                    {jefes.reduce(
                      (n, agente) =>
                        n +
                        totalDiasTrabajadosJefes(
                          cuadrante[agente.id] ?? [],
                          diasVisibles,
                        ),
                      0,
                    )}
                    d
                  </td>
                </tr>
              </tfoot>
            </table>
          </DashboardMainScroll>
        </DashboardMain>
        <DashboardSidebar>
          <div className="rounded-xl border border-line bg-white p-2 text-sm text-slate-600 shadow-card">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Cómo usarlo
            </p>
            <ol className="list-decimal space-y-1 pl-4 text-xs leading-snug">
              <li>
                Clic en celda: cicla D → M → T → N → L → V. En fin de semana
                también M-T (Mañana Tarde).
              </li>
              <li>Con turno (M/T/N/M-T), arrastra un puesto desde la bolsa.</li>
              <li>
                Arrastra un puesto al número o nombre del jefe: lo pone en
                todos sus días con turno.
              </li>
              <li>O selecciona el puesto y pulsa la celda.</li>
              <li>Shift+clic en celda con turno: menú de puestos.</li>
              <li>
                Σ a la derecha: días trabajados del agente (M-T cuenta 2). Pie:
                agentes de servicio ese día.
              </li>
            </ol>
            <p className="mt-2 text-xs text-slate-500">
              {jefes.length} agente{jefes.length === 1 ? '' : 's'} (jefes y
              responsables) · {puestosJefes.length} puesto
              {puestosJefes.length === 1 ? '' : 's'} exclusivo
              {puestosJefes.length === 1 ? '' : 's'}
            </p>
          </div>
          <BolsaPuestosPanel
            filtroTurno={filtroTurno}
            onFiltroTurno={setFiltroTurno}
            ambito="JEFE_SERVICIO"
            puestoSeleccionado={puestoSeleccionado}
            onSeleccionarPuesto={setPuestoSeleccionado}
          />
        </DashboardSidebar>
      </DashboardBody>

      {popoverCelda ? (
        <PopoverPuestosCelda
          rect={popoverCelda.rect}
          puestos={
            agentesPorId.get(popoverCelda.agenteId)
              ? puestosPermitidosParaAgente(
                  agentesPorId.get(popoverCelda.agenteId)!,
                  puestosJefes,
                  'JEFE_SERVICIO',
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
    </section>
  )
}
