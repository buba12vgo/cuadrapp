import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Briefcase,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  FileDown,
  Moon,
  PartyPopper,
  Printer,
  Shield,
  Table2,
} from 'lucide-react'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
  DashboardSidebar,
} from '@/components/ui/DashboardLayout'
import { KpiBarRow, KpiSection } from '@/components/ui/DashboardKpi'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader, ToolbarDivider, ToolbarSection } from '@/components/ui/PageHeader'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BLOQUE,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CAMPO,
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
      className={`inline-flex items-center justify-center rounded-full px-2 py-0.5 text-[11px] font-extrabold leading-none tracking-tight ${PILDORA_TURNO[turno]} ${className}`}
    >
      {etiquetaTurno(turno)}
    </span>
  )
}

function KpiBadge({
  icon: Icon,
  label,
  value,
  tone,
}: {
  icon: typeof Briefcase
  label: string
  value: number | string
  tone: 'sky' | 'violet' | 'amber' | 'rose' | 'slate'
}) {
  const tones = {
    sky: 'border-sky-200 bg-sky-50 text-sky-900',
    violet: 'border-violet-200 bg-violet-50 text-violet-900',
    amber: 'border-amber-200 bg-amber-50 text-amber-950',
    rose: 'border-rose-200 bg-rose-50 text-rose-900',
    slate: 'border-slate-200 bg-white text-slate-800',
  } as const
  const iconTone = {
    sky: 'text-sky-600',
    violet: 'text-violet-600',
    amber: 'text-amber-600',
    rose: 'text-rose-600',
    slate: 'text-slate-500',
  } as const
  return (
    <div
      className={`flex min-w-[7.5rem] flex-1 items-center gap-2 rounded-xl border px-2.5 py-2 shadow-sm ${tones[tone]}`}
    >
      <span
        className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg bg-white/70 ${iconTone[tone]}`}
      >
        <Icon className="h-4 w-4" />
      </span>
      <div className="min-w-0">
        <p className="text-[10px] font-bold uppercase tracking-wider opacity-70">
          {label}
        </p>
        <p className="font-display text-lg font-bold tabular-nums leading-none">
          {value}
        </p>
      </div>
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
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Calendario jefes"
        subtitle={`Vista mensual operativa · cuadrante de jefes${loading ? ' · Cargando…' : ''}`}
        actions={
          <div className="flex flex-wrap items-center gap-1.5">
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={!agenteSeleccionado || loading}
              onClick={exportarPdf}
            >
              <FileDown className="h-4 w-4" />
              Exportar PDF
            </button>
          </div>
        }
        toolbar={
          <>
            <ToolbarSection label="Periodo">
              <button
                type="button"
                className={`${BTN_GHOST} h-9 w-9 shrink-0 px-0`}
                aria-label="Mes anterior"
                onClick={() => {
                  const prev = mesAnterior(anio, mes)
                  aplicarMes(prev.anio, prev.mes)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                className={`${CAMPO} min-w-[8.5rem]`}
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
                className={`${CAMPO} min-w-[5.5rem]`}
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
                className={`${BTN_GHOST} h-9 w-9 shrink-0 px-0`}
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
                className={`${CAMPO} min-w-[16rem] max-w-[24rem]`}
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

      <DashboardBody>
        <DashboardMain>
          <DashboardMainScroll className="p-3 sm:p-4">
            {agenteSeleccionado ? (
              <div className="mb-3 flex flex-col gap-3">
                <div className="flex flex-wrap items-center gap-2">
                  <span className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-slate-50 px-2 py-1 font-mono text-sm font-extrabold text-ink">
                    <Shield className="h-3.5 w-3.5 text-slate-500" />
                    {agenteSeleccionado.numeroPlaca}
                  </span>
                  <div className="min-w-0">
                    <p className="truncate text-sm font-bold text-ink">
                      {agenteSeleccionado.nombre}{' '}
                      {agenteSeleccionado.apellidos}
                    </p>
                    <p className="text-xs text-slate-500">
                      {ROL_LABEL[agenteSeleccionado.rolBase]} · {MESES[mes - 1]}{' '}
                      {anio}
                    </p>
                  </div>
                </div>

                <div className="flex flex-wrap gap-2">
                  <KpiBadge
                    icon={Briefcase}
                    label="Trabajados"
                    value={`${totalTrabajados}d`}
                    tone="sky"
                  />
                  <KpiBadge
                    icon={Moon}
                    label="Noches"
                    value={desglose.noches}
                    tone="violet"
                  />
                  <KpiBadge
                    icon={PartyPopper}
                    label="Festivos"
                    value={desglose.festivosTrabajados}
                    tone="amber"
                  />
                  <KpiBadge
                    icon={CalendarDays}
                    label="Permisos"
                    value={desglose.P}
                    tone="rose"
                  />
                </div>
              </div>
            ) : null}

            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="grid grid-cols-7 border-b border-slate-200 bg-slate-50/90">
                {DIAS_SEMANA.map((dia, indice) => {
                  const finde = indice >= 5
                  return (
                    <div
                      key={dia}
                      className={`py-2 text-center text-[11px] font-bold uppercase tracking-wider ${
                        finde ? 'text-red-600' : 'text-slate-500'
                      }`}
                    >
                      {dia}
                    </div>
                  )
                })}
              </div>

              <div className="grid grid-cols-7 gap-px bg-slate-200">
                {celdas.map((dia, indice) => {
                  if (dia == null) {
                    return (
                      <div
                        key={`hueco-${indice}`}
                        className="min-h-[6.25rem] bg-slate-50/80"
                      />
                    )
                  }

                  const turno = (fila[dia - 1] ?? 'D') as Turno
                  const fecha = isoFecha(anio, mes, dia)
                  const { etiqueta, abrev } = agenteSeleccionado
                    ? detalleDiaCalendarioJefe(
                        turno,
                        fecha,
                        agenteSeleccionado.id,
                        asignacionesDiarias,
                        puestos,
                        tiposPermiso,
                      )
                    : { etiqueta: etiquetaTurno(turno), abrev: null }
                  const asignado =
                    agenteSeleccionado &&
                    (turno === 'M' ||
                      turno === 'T' ||
                      turno === 'N' ||
                      turno === 'MT' ||
                      turno === 'P')
                      ? (asignacionesDiarias[fecha]?.[turno]?.[
                          agenteSeleccionado.id
                        ] ?? null)
                      : null
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
                      className={`group flex min-h-[6.25rem] flex-col gap-1.5 p-2 transition-opacity ${FOCUS_RING} ${
                        esDescansoCelda
                          ? TRAMA_DESCANSO
                          : especial && (turno === 'V' || turno === 'P')
                            ? 'bg-amber-50/70'
                            : 'bg-white'
                      } ${atenuada ? 'opacity-30' : 'opacity-100'} ${
                        esServicio
                          ? 'hover:bg-slate-50/90'
                          : 'hover:bg-slate-100/60'
                      }`}
                      title={`${dia}/${mes}/${anio} · ${etiqueta}${asignado ? ` · ${asignado}` : abrev ? ` · ${abrev}` : ''}`}
                    >
                      <div className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-extrabold tabular-nums ${
                            especial ? 'text-red-600' : 'text-slate-700'
                          }`}
                        >
                          {dia}
                        </span>
                        {especial ? (
                          <span
                            className="h-1.5 w-1.5 shrink-0 rounded-full bg-red-500"
                            title={
                              festivo
                                ? 'Festivo'
                                : finde
                                  ? 'Fin de semana'
                                  : undefined
                            }
                          />
                        ) : null}
                      </div>

                      <div className="mt-auto flex flex-col items-start gap-1">
                        <PillTurno turno={turno} />
                        {abrev ? (
                          <span
                            className="max-w-full truncate rounded-md border border-slate-200 bg-white/90 px-1.5 py-0.5 font-mono text-[10px] font-bold tracking-tight text-slate-700 shadow-sm"
                            title={asignado ?? abrev}
                          >
                            {abrev}
                          </span>
                        ) : esServicio ? (
                          <span className="rounded-md border border-dashed border-slate-200 px-1.5 py-0.5 text-[10px] font-medium text-slate-400">
                            Sin puesto
                          </span>
                        ) : null}
                      </div>
                    </div>
                  )
                })}
              </div>
            </div>
          </DashboardMainScroll>
        </DashboardMain>

        <DashboardSidebar className="xl:w-64 2xl:w-72">
          <div className={BLOQUE}>
            <p className={TITULO_BLOQUE}>Leyenda</p>
            <p className="mb-2 text-[11px] leading-snug text-slate-500">
              Pulsa un turno para filtrar el mes.
            </p>
            <ul className="flex flex-col gap-1">
              {LEYENDA.map(({ turno, label }) => {
                const activo =
                  filtroLeyenda === 'TODOS' || filtroLeyenda === turno
                return (
                  <li key={turno}>
                    <button
                      type="button"
                      className={`flex w-full items-center gap-2 rounded-lg px-1.5 py-1 text-left text-xs transition-colors ${FOCUS_RING} ${
                        filtroLeyenda === turno
                          ? 'bg-brand-50 ring-1 ring-brand-200'
                          : 'hover:bg-slate-50'
                      } ${activo ? '' : 'opacity-40'}`}
                      onClick={() => alternarFiltro(turno)}
                      aria-pressed={filtroLeyenda === turno}
                    >
                      <PillTurno turno={turno} className="min-w-[2.5rem]" />
                      <span className="font-medium text-slate-700">{label}</span>
                    </button>
                  </li>
                )
              })}
            </ul>
            {filtroLeyenda !== 'TODOS' ? (
              <button
                type="button"
                className="mt-2 text-[11px] font-semibold text-brand-700 hover:underline"
                onClick={() => setFiltroLeyenda('TODOS')}
              >
                Quitar filtro
              </button>
            ) : null}
          </div>

          <KpiSection icon={Briefcase} title="Carga del mes">
            <div className="space-y-2.5">
              <KpiBarRow
                label="Mañanas"
                value={desglose.M}
                max={maxBarra}
                color={BARRA_TURNO.M}
              />
              <KpiBarRow
                label="Tardes"
                value={desglose.T}
                max={maxBarra}
                color={BARRA_TURNO.T}
              />
              <KpiBarRow
                label="Noches"
                value={desglose.N}
                max={maxBarra}
                color={BARRA_TURNO.N}
              />
              <KpiBarRow
                label="M-T finde"
                value={desglose.MT}
                max={maxBarra}
                color={BARRA_TURNO.MT}
              />
              <KpiBarRow
                label="Finde en servicio"
                value={desglose.findeTrabajados}
                max={maxBarra}
                color={BARRA_TURNO.finde}
              />
            </div>
            <p className="mt-3 text-[11px] leading-snug text-slate-500">
              Σ ponderada: <strong className="text-ink">{totalTrabajados}d</strong>{' '}
              (M-T = 2) · Vacaciones {desglose.V} · Descansos {desglose.D}
            </p>
          </KpiSection>

          <div className={BLOQUE}>
            <p className={TITULO_BLOQUE}>Acciones</p>
            <div className="flex flex-col gap-1.5">
              <button
                type="button"
                className={`${BTN_PRIMARY} w-full justify-center`}
                disabled={!agenteSeleccionado || loading}
                onClick={exportarPdf}
              >
                <FileDown className="h-4 w-4" />
                Exportar PDF
              </button>
              <button
                type="button"
                className={`${BTN_SECONDARY} w-full justify-center`}
                disabled={!agenteSeleccionado || loading}
                onClick={exportarPdf}
              >
                <Printer className="h-4 w-4" />
                Imprimir calendario
              </button>
              <Link
                to="/admin/cuadrante-jefes"
                className={`${BTN_GHOST} w-full justify-center`}
              >
                <Table2 className="h-4 w-4" />
                Ver cuadrante completo
              </Link>
            </div>
          </div>
        </DashboardSidebar>
      </DashboardBody>
    </section>
  )
}
