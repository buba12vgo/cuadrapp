import { useEffect, useMemo, useState, type CSSProperties } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Moon,
  PartyPopper,
  Printer,
  Shield,
  Table2,
  FileText,
} from 'lucide-react'
import {
  DashboardBody,
  DashboardMain,
  DashboardSidebar,
} from '@/components/ui/DashboardLayout'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader, ToolbarDivider, ToolbarSection } from '@/components/ui/PageHeader'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  FOCUS_RING,
  PAGE_SECTION,
  TITULO_BLOQUE,
} from '@/lib/uiStyles'
import { useAgentesData } from '@/lib/agentesStore'
import { etiquetaTurno } from '@/lib/asignacionPuestos'
import type { AsignacionesDiarias } from '@/lib/calendarioPuestos'
import {
  diasDelMes,
  esDiaTrabajado,
  esFinDeSemana,
  totalDiasTrabajadosJefes,
} from '@/lib/convenio'
import {
  cuadranteDesdeFirestore,
  cuadranteVacio,
} from '@/lib/cuadranteFirestore'
import { getAgentes, getCuadranteJefes } from '@/lib/db'
import {
  celdasMesCalendario,
  detalleDiaCalendarioJefe,
  exportarCalendarioJefesPdf,
} from '@/lib/exportarCalendarioJefesPdf'
import { esFestivo } from '@/lib/festivos'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { useTiposPermiso } from '@/lib/permisosStore'
import { usePuestosData } from '@/lib/puestosStore'
import { agentesCuadranteJefes, ROL_LABEL } from '@/lib/rolesCuadrante'
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

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const
const ANIO_ACTUAL = 2026

const LEYENDA: Array<{ turno: Turno; label: string }> = [
  { turno: 'M', label: 'Mañana' },
  { turno: 'T', label: 'Tarde' },
  { turno: 'N', label: 'Noche' },
  { turno: 'MT', label: 'M-T finde' },
  { turno: 'P', label: 'Permiso' },
  { turno: 'D', label: 'Descanso' },
  { turno: 'V', label: 'Vacaciones' },
]

/** Píldoras compactas por turno (celdas y leyenda). */
const PILDORA_TURNO: Record<Turno, string> = {
  M: 'bg-blue-100 text-blue-800 ring-1 ring-inset ring-blue-200/80',
  T: 'bg-orange-100 text-orange-800 ring-1 ring-inset ring-orange-200/80',
  N: 'bg-violet-100 text-violet-800 ring-1 ring-inset ring-violet-200/80',
  MT: 'bg-teal-100 text-teal-800 ring-1 ring-inset ring-teal-200/80',
  L: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200/80',
  P: 'bg-rose-100 text-rose-800 ring-1 ring-inset ring-rose-200/80',
  D: 'bg-slate-100 text-slate-500 ring-1 ring-inset ring-slate-200/80',
  V: 'bg-emerald-100 text-emerald-800 ring-1 ring-inset ring-emerald-200/80',
}

const BARRA_TURNO: Record<'M' | 'T' | 'N' | 'MT' | 'finde', string> = {
  M: 'bg-blue-500',
  T: 'bg-orange-500',
  N: 'bg-violet-500',
  MT: 'bg-teal-500',
  finde: 'bg-amber-500',
}

const TRAMA_DESCANSO =
  'bg-slate-50 bg-[radial-gradient(circle,_#cbd5e1_0.65px,_transparent_0.7px)] bg-[length:7px_7px]'

/** Select compacto alineado con la toolbar (evita el look raro de CAMPO h-9). */
const SELECT_TOOLBAR =
  `h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-ink shadow-none ${FOCUS_RING} focus:border-brand-400`

type FiltroLeyenda = Turno | 'TODOS'

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function mesAnterior(anio: number, mes: number) {
  if (mes <= 1) return { anio: anio - 1, mes: 12 }
  return { anio, mes: mes - 1 }
}

function mesSiguiente(anio: number, mes: number) {
  if (mes >= 12) return { anio: anio + 1, mes: 1 }
  return { anio, mes: mes + 1 }
}

function desgloseMes(
  fila: Turno[],
  anio: number,
  mes: number,
  nDias: number,
) {
  const c = {
    M: 0,
    T: 0,
    N: 0,
    MT: 0,
    P: 0,
    V: 0,
    D: 0,
    noches: 0,
    festivosTrabajados: 0,
    findeTrabajados: 0,
  }
  for (let dia = 1; dia <= nDias; dia++) {
    const turno = (fila[dia - 1] ?? 'D') as Turno
    if (turno === 'M' || turno === 'T' || turno === 'N' || turno === 'MT') {
      c[turno] += 1
    } else if (turno === 'P' || turno === 'V' || turno === 'D') {
      c[turno] += 1
    } else if (turno === 'L') {
      c.P += 1
    }
    if (turno === 'N') c.noches += 1
    const finde = esFinDeSemana(anio, mes, dia)
    const festivo = esFestivo(anio, mes, dia)
    if (esDiaTrabajado(turno) && festivo) c.festivosTrabajados += 1
    if (esDiaTrabajado(turno) && finde) c.findeTrabajados += 1
  }
  return c
}

function PillTurno({
  turno,
  className = '',
}: {
  turno: Turno
  className?: string
}) {
  return (
    <span
      className={`inline-flex items-center justify-center rounded-full px-1.5 py-0.5 text-[10px] font-extrabold leading-none tracking-tight ${PILDORA_TURNO[turno]} ${className}`}
    >
      {etiquetaTurno(turno)}
    </span>
  )
}

function KpiChip({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Briefcase
  label: string
  value: number | string
  tone: 'sky' | 'violet' | 'amber' | 'rose'
}) {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
  } as const
  return (
    <div
      className={`inline-flex h-7 items-center gap-1 rounded-md border px-1.5 ${tones[tone]}`}
      title={label}
    >
      <Icon className="h-3 w-3 shrink-0 opacity-70" />
      <span className="text-[10px] font-bold uppercase tracking-wide opacity-70">
        {label}
      </span>
      <span className="text-xs font-extrabold tabular-nums">{value}</span>
    </div>
  )
}

function BarraCompacta({
  label,
  value,
  max,
  color,
}: {
  label: string
  value: number
  max: number
  color: string
}) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div className="flex items-center gap-1.5">
      <span className="w-14 shrink-0 truncate text-[10px] font-medium text-slate-600">
        {label}
      </span>
      <div className="h-1 min-w-0 flex-1 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
      <span className="w-4 shrink-0 text-right text-[10px] font-bold tabular-nums text-ink">
        {value}
      </span>
    </div>
  )
}

export function CalendarioJefesPage() {
  const { alert } = useAppDialog()
  const [agentesData, setAgentesData] = useAgentesData()
  const [puestos] = usePuestosData()
  const [tiposPermiso] = useTiposPermiso()
  const [anio, setAnio] = useState(ANIO_ACTUAL)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [agenteId, setAgenteId] = useState<string>('')
  const [cuadrante, setCuadrante] = useState<CuadranteMensual>({})
  const [asignacionesDiarias, setAsignacionesDiarias] =
    useState<AsignacionesDiarias>({})
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [agentesCargados, setAgentesCargados] = useState(false)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())
  const [filtroLeyenda, setFiltroLeyenda] = useState<FiltroLeyenda>('TODOS')

  const jefes = useMemo(() => agentesCuadranteJefes(agentesData), [agentesData])
  const jefesIdsKey = useMemo(
    () => jefes.map((agente) => agente.id).join('\0'),
    [jefes],
  )
  const agenteSeleccionado = useMemo(
    () => jefes.find((agente) => agente.id === agenteId) ?? null,
    [jefes, agenteId],
  )

  const nDias = diasDelMes(anio, mes)
  const celdas = useMemo(() => celdasMesCalendario(anio, mes), [anio, mes])
  const diasMes = useMemo(
    () => Array.from({ length: nDias }, (_, i) => i + 1),
    [nDias],
  )
  const fila = useMemo(() => {
    if (!agenteSeleccionado) return [] as Turno[]
    return cuadrante[agenteSeleccionado.id] ?? []
  }, [agenteSeleccionado, cuadrante])

  const totalTrabajados = agenteSeleccionado
    ? totalDiasTrabajadosJefes(fila, diasMes)
    : 0
  const desglose = useMemo(
    () => desgloseMes(fila, anio, mes, nDias),
    [fila, anio, mes, nDias],
  )
  const maxBarra = Math.max(
    1,
    desglose.M,
    desglose.T,
    desglose.N,
    desglose.MT,
    desglose.findeTrabajados,
  )

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
        // Se muestra al pintar.
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
    if (jefes.length === 0) {
      setAgenteId('')
      return
    }
    if (!jefes.some((agente) => agente.id === agenteId)) {
      setAgenteId(jefes[0]!.id)
    }
  }, [agentesCargados, jefes, jefesIdsKey, agenteId])

  useEffect(() => {
    if (!agentesCargados) return
    let cancelado = false

    async function cargar() {
      setLoading(true)
      setError(null)
      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)
      if (!ready) {
        setCuadrante(cuadranteVacio(jefes, nDias))
        setAsignacionesDiarias({})
        setLoading(false)
        return
      }
      try {
        const datos = await getCuadranteJefes(mes, anio)
        if (cancelado) return
        if (datos && jefes.length > 0) {
          const { cuadrante: cargado, asignaciones } = cuadranteDesdeFirestore(
            datos,
            jefes,
            anio,
            mes,
            nDias,
            {
              puestos,
              permisos: tiposPermiso,
              migrarLibranzaAPermiso: true,
            },
          )
          setCuadrante(cargado)
          setAsignacionesDiarias(asignaciones)
        } else {
          setCuadrante(cuadranteVacio(jefes, nDias))
          setAsignacionesDiarias({})
        }
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el cuadrante de jefes',
          )
          setCuadrante(cuadranteVacio(jefes, nDias))
          setAsignacionesDiarias({})
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [
    anio,
    mes,
    nDias,
    jefesIdsKey,
    agentesCargados,
    jefes,
    puestos,
    tiposPermiso,
  ])

  function aplicarMes(siguienteAnio: number, siguienteMes: number) {
    setAnio(siguienteAnio)
    setMes(siguienteMes)
  }

  function exportarPdf() {
    if (!agenteSeleccionado) {
      void alert('Selecciona un jefe de servicio.', 'Sin agente')
      return
    }
    try {
      exportarCalendarioJefesPdf({
        anio,
        mes,
        agente: agenteSeleccionado,
        cuadrante,
        asignacionesDiarias,
        puestos,
        permisos: tiposPermiso,
      })
    } catch (err) {
      void alert(
        err instanceof Error ? err.message : 'No se pudo exportar el PDF',
        'Exportar PDF',
      )
    }
  }

  function alternarFiltro(turno: Turno) {
    setFiltroLeyenda((actual) => (actual === turno ? 'TODOS' : turno))
  }

  return (
    <section className={`${PAGE_SECTION} gap-1.5 overflow-hidden`}>
      <PageHeader
        title="Calendario jefes"
        subtitle={`Vista mensual · cuadrante de jefes${loading ? ' · Cargando…' : ''}`}
        actions={
          <button
            type="button"
            className={`${BTN_SECONDARY} h-8 px-2.5 text-xs`}
            disabled={!agenteSeleccionado || loading}
            onClick={exportarPdf}
          >
            <FileDown className="h-3.5 w-3.5" />
            PDF
          </button>
        }
        toolbar={
          <>
            <ToolbarSection label="Periodo">
              <button
                type="button"
                className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
                aria-label="Mes anterior"
                onClick={() => {
                  const prev = mesAnterior(anio, mes)
                  aplicarMes(prev.anio, prev.mes)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                className={`${SELECT_TOOLBAR} w-[8.25rem]`}
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
              <select
                className={`${SELECT_TOOLBAR} w-[4.75rem]`}
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
              <button
                type="button"
                className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
                aria-label="Mes siguiente"
                onClick={() => {
                  const next = mesSiguiente(anio, mes)
                  aplicarMes(next.anio, next.mes)
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </ToolbarSection>
            <ToolbarDivider />
            <ToolbarSection label="Agente">
              <select
                className={`${SELECT_TOOLBAR} w-[15.5rem] max-w-[40vw]`}
                value={agenteId}
                disabled={jefes.length === 0}
                onChange={(event) => setAgenteId(event.target.value)}
              >
                {jefes.map((agente) => (
                  <option key={agente.id} value={agente.id}>
                    {agente.numeroPlaca} · {agente.nombre} {agente.apellidos}
                  </option>
                ))}
              </select>
            </ToolbarSection>
          </>
        }
      />

      {error ? <p className={ALERT_ERROR}>{error}</p> : null}
      {!firebaseOk ? (
        <p className={ALERT_INFO}>
          Firebase no está configurado; se muestra un mes vacío.
        </p>
      ) : null}
      {jefes.length === 0 && !loading ? (
        <p className={ALERT_INFO}>
          No hay jefes de servicio ni responsables en la plantilla.
        </p>
      ) : null}

      <DashboardBody className="gap-2">
        <DashboardMain className="overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
            {agenteSeleccionado ? (
              <div className="flex shrink-0 flex-wrap items-center gap-x-2 gap-y-1">
                <span className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-slate-50 px-1.5 py-0.5 font-mono text-xs font-extrabold text-ink">
                  <Shield className="h-3 w-3 text-slate-500" />
                  {agenteSeleccionado.numeroPlaca}
                </span>
                <p className="min-w-0 truncate text-xs font-bold text-ink">
                  {agenteSeleccionado.nombre} {agenteSeleccionado.apellidos}
                  <span className="ml-1.5 font-medium text-slate-500">
                    {ROL_LABEL[agenteSeleccionado.rolBase]}
                  </span>
                </p>
                <div className="flex flex-wrap items-center gap-1">
                  <KpiChip
                    icon={Briefcase}
                    label="Trab."
                    value={`${totalTrabajados}d`}
                    tone="sky"
                  />
                  <KpiChip
                    icon={Moon}
                    label="Noches"
                    value={desglose.noches}
                    tone="violet"
                  />
                  <KpiChip
                    icon={PartyPopper}
                    label="Fest."
                    value={desglose.festivosTrabajados}
                    tone="amber"
                  />
                  <KpiChip
                    icon={FileText}
                    label="Perm."
                    value={desglose.P}
                    tone="rose"
                  />
                </div>
              </div>
            ) : null}

            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-slate-50/90">
                {DIAS_SEMANA.map((dia, indice) => {
                  const finde = indice >= 5
                  return (
                    <div
                      key={dia}
                      className={`py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                        finde ? 'text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {dia}
                    </div>
                  )
                })}
              </div>

              <div
                className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-slate-200 [grid-template-rows:repeat(var(--semanas),minmax(0,1fr))]"
                style={
                  {
                    '--semanas': Math.max(1, Math.ceil(celdas.length / 7)),
                  } as CSSProperties
                }
              >
                {celdas.map((dia, indice) => {
                  if (dia == null) {
                    return (
                      <div
                        key={`hueco-${indice}`}
                        className="min-h-0 bg-slate-50/80"
                      />
                    )
                  }

                  const turno = (fila[dia - 1] ?? 'D') as Turno
                  const fecha = isoFecha(anio, mes, dia)
                  const { etiqueta, detalle } = agenteSeleccionado
                    ? detalleDiaCalendarioJefe(
                        turno,
                        fecha,
                        agenteSeleccionado.id,
                        asignacionesDiarias,
                        puestos,
                        tiposPermiso,
                      )
                    : { etiqueta: etiquetaTurno(turno), detalle: null }
                  const finde = esFinDeSemana(anio, mes, dia)
                  const festivo = esFestivo(anio, mes, dia)
                  const especial = finde || festivo
                  const atenuada =
                    filtroLeyenda !== 'TODOS' && filtroLeyenda !== turno
                  const esDescansoCelda = turno === 'D'
                  const esServicio = esDiaTrabajado(turno)

                  return (
                    <div
                      key={dia}
                      className={`group flex min-h-0 flex-col gap-0.5 overflow-hidden p-1 transition-opacity ${FOCUS_RING} ${
                        esDescansoCelda
                          ? TRAMA_DESCANSO
                          : especial && (turno === 'V' || turno === 'P')
                            ? 'bg-amber-50/70'
                            : 'bg-white'
                      } ${atenuada ? 'opacity-30' : 'opacity-100'}`}
                      title={`${dia}/${mes}/${anio} · ${etiqueta}${detalle ? ` · ${detalle}` : ''}`}
                    >
                      <div className="flex shrink-0 items-center justify-between gap-0.5">
                        <span
                          className={`text-[10px] font-extrabold tabular-nums leading-none ${
                            especial ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {dia}
                        </span>
                        {especial ? (
                          <span className="h-1 w-1 shrink-0 rounded-full bg-red-500" />
                        ) : null}
                      </div>

                      <div className="mt-auto flex min-h-0 flex-col items-start gap-0.5 overflow-hidden">
                        <PillTurno turno={turno} />
                        {detalle ? (
                          <span
                            className="line-clamp-2 max-w-full text-[9px] font-semibold leading-tight text-slate-700"
                            title={detalle}
                          >
                            {detalle}
                          </span>
                        ) : esServicio ? (
                          <span className="text-[9px] font-medium text-slate-400">
                            Sin puesto
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </div>
        </DashboardMain>

        <DashboardSidebar className="!overflow-hidden gap-1.5 xl:w-52 2xl:w-56">
          <div className="shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <p className={`${TITULO_BLOQUE} mb-1`}>Leyenda</p>
            <div className="flex flex-wrap gap-1">
              {LEYENDA.map(({ turno, label }) => {
                const activo =
                  filtroLeyenda === 'TODOS' || filtroLeyenda === turno
                return (
                  <button
                    key={turno}
                    type="button"
                    className={`inline-flex items-center gap-1 rounded-md px-1 py-0.5 transition-colors ${FOCUS_RING} ${
                      filtroLeyenda === turno
                        ? 'bg-brand-50 ring-1 ring-brand-200'
                        : 'hover:bg-slate-50'
                    } ${activo ? '' : 'opacity-35'}`}
                    title={label}
                    onClick={() => alternarFiltro(turno)}
                    aria-pressed={filtroLeyenda === turno}
                  >
                    <PillTurno turno={turno} />
                  </button>
                )
              })}
            </div>
            {filtroLeyenda !== 'TODOS' ? (
              <button
                type="button"
                className="mt-1 text-[10px] font-semibold text-brand-700 hover:underline"
                onClick={() => setFiltroLeyenda('TODOS')}
              >
                Quitar filtro
              </button>
            ) : null}
          </div>

          <div className="min-h-0 shrink rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <p className={`${TITULO_BLOQUE} mb-1.5`}>Carga del mes</p>
            <div className="space-y-1">
              <BarraCompacta
                label="Mañanas"
                value={desglose.M}
                max={maxBarra}
                color={BARRA_TURNO.M}
              />
              <BarraCompacta
                label="Tardes"
                value={desglose.T}
                max={maxBarra}
                color={BARRA_TURNO.T}
              />
              <BarraCompacta
                label="Noches"
                value={desglose.N}
                max={maxBarra}
                color={BARRA_TURNO.N}
              />
              <BarraCompacta
                label="M-T"
                value={desglose.MT}
                max={maxBarra}
                color={BARRA_TURNO.MT}
              />
              <BarraCompacta
                label="Finde"
                value={desglose.findeTrabajados}
                max={maxBarra}
                color={BARRA_TURNO.finde}
              />
            </div>
            <p className="mt-1.5 text-[10px] leading-snug text-slate-500">
              Σ <strong className="text-ink">{totalTrabajados}d</strong> · V{' '}
              {desglose.V} · D {desglose.D}
            </p>
          </div>

          <div className="mt-auto shrink-0 rounded-xl border border-slate-200 bg-white p-2 shadow-sm">
            <p className={`${TITULO_BLOQUE} mb-1.5`}>Acciones</p>
            <div className="flex flex-col gap-1">
              <button
                type="button"
                className={`${BTN_PRIMARY} h-8 w-full justify-center px-2 text-xs`}
                disabled={!agenteSeleccionado || loading}
                onClick={exportarPdf}
              >
                <FileDown className="h-3.5 w-3.5" />
                Exportar PDF
              </button>
              <button
                type="button"
                className={`${BTN_SECONDARY} h-8 w-full justify-center px-2 text-xs`}
                disabled={!agenteSeleccionado || loading}
                onClick={exportarPdf}
              >
                <Printer className="h-3.5 w-3.5" />
                Imprimir
              </button>
              <Link
                to="/admin/cuadrante-jefes"
                className={`${BTN_GHOST} h-8 w-full justify-center px-2 text-xs`}
              >
                <Table2 className="h-3.5 w-3.5" />
                Cuadrante
              </Link>
            </div>
          </div>
        </DashboardSidebar>
      </DashboardBody>
    </section>
  )
}
