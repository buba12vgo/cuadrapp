import { useEffect, useMemo, useState } from 'react'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
  DashboardSidebar,
} from '@/components/ui/DashboardLayout'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { PageHeader, ToolbarSection } from '@/components/ui/PageHeader'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BTN_SECONDARY,
  CLASE_TURNO_CELDA,
  FOCUS_RING,
  PAGE_SECTION,
} from '@/lib/uiStyles'
import { useAgentesData } from '@/lib/agentesStore'
import { etiquetaTurno } from '@/lib/asignacionPuestos'
import type { AsignacionesDiarias } from '@/lib/calendarioPuestos'
import {
  diasDelMes,
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

const CAMPO_TOOLBAR =
  'h-7 rounded-md border border-line bg-white px-1.5 text-xs text-ink outline-none focus:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500/40'

const CLASE_TURNO: Record<Turno, string> = {
  M: CLASE_TURNO_CELDA.M,
  T: CLASE_TURNO_CELDA.T,
  N: CLASE_TURNO_CELDA.N,
  MT: CLASE_TURNO_CELDA.MT,
  L: 'rounded-md bg-rose-50 font-semibold text-rose-800',
  P: 'rounded-md bg-rose-50 font-semibold text-rose-800',
  D: 'rounded-md bg-white font-semibold text-slate-500',
  V: CLASE_TURNO_CELDA.V,
}

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
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
  const fila = agenteSeleccionado
    ? (cuadrante[agenteSeleccionado.id] ?? [])
    : []
  const totalTrabajados = agenteSeleccionado
    ? totalDiasTrabajadosJefes(
        fila,
        Array.from({ length: nDias }, (_, i) => i + 1),
      )
    : 0

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

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Calendario jefes"
        subtitle={`Vista mensual por jefe · datos del cuadrante de jefes${loading ? ' · Cargando…' : ''}`}
        toolbar={
          <>
            <ToolbarSection label="Periodo">
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Mes</span>
                <select
                  className={CAMPO_TOOLBAR}
                  value={mes}
                  onChange={(event) => setMes(Number(event.target.value))}
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
                    setAnio(Number(event.target.value) || anio)
                  }
                >
                  {Array.from({ length: 21 }, (_, i) => 2020 + i).map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </label>
            </ToolbarSection>
            <ToolbarSection label="Agente">
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Jefe</span>
                <select
                  className={`${CAMPO_TOOLBAR} min-w-[16rem] max-w-[22rem]`}
                  value={agenteId}
                  disabled={jefes.length === 0}
                  onChange={(event) => setAgenteId(event.target.value)}
                >
                  {jefes.map((agente) => (
                    <option key={agente.id} value={agente.id}>
                      {agente.numeroPlaca} · {agente.nombre}{' '}
                      {agente.apellidos}
                    </option>
                  ))}
                </select>
              </label>
            </ToolbarSection>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={!agenteSeleccionado || loading}
              onClick={exportarPdf}
            >
              Exportar PDF
            </button>
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
          <DashboardMainScroll className="p-2">
            {agenteSeleccionado ? (
              <div className="mb-2 flex flex-wrap items-baseline gap-x-3 gap-y-1 text-sm text-slate-600">
                <span className="font-mono text-base font-extrabold text-ink">
                  {agenteSeleccionado.numeroPlaca}
                </span>
                <span className="font-semibold text-ink">
                  {agenteSeleccionado.nombre} {agenteSeleccionado.apellidos}
                </span>
                <span>{ROL_LABEL[agenteSeleccionado.rolBase]}</span>
                <span className="tabular-nums">
                  {totalTrabajados}d trabajados
                </span>
              </div>
            ) : null}

            <div className="grid grid-cols-7 gap-1">
              {DIAS_SEMANA.map((dia) => (
                <div
                  key={dia}
                  className="py-1 text-center text-xs font-bold uppercase tracking-wide text-slate-500"
                >
                  {dia}
                </div>
              ))}
              {celdas.map((dia, indice) => {
                if (dia == null) {
                  return (
                    <div
                      key={`hueco-${indice}`}
                      className="min-h-[5.5rem] rounded-md border border-transparent bg-slate-50/60"
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
                const especial =
                  esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
                return (
                  <div
                    key={dia}
                    className={`min-h-[5.5rem] rounded-md border border-line p-1.5 ${CLASE_TURNO[turno]} ${
                      especial && (turno === 'D' || turno === 'V')
                        ? '!bg-amber-50'
                        : ''
                    } ${FOCUS_RING}`}
                    title={`${dia}/${mes}/${anio} · ${etiqueta}${abrev ? ` · ${abrev}` : ''}`}
                  >
                    <div
                      className={`text-xs font-extrabold ${
                        especial ? 'text-red-600' : 'text-ink'
                      }`}
                    >
                      {dia}
                    </div>
                    <div className="mt-1 text-lg font-extrabold leading-none">
                      {etiqueta}
                    </div>
                    {abrev ? (
                      <div className="mt-1 font-mono text-sm font-extrabold leading-none tracking-tight">
                        {abrev}
                      </div>
                    ) : null}
                  </div>
                )
              })}
            </div>
          </DashboardMainScroll>
        </DashboardMain>
        <DashboardSidebar>
          <div className="rounded-xl border border-line bg-white p-2 text-sm text-slate-600 shadow-card">
            <p className="mb-1 text-[10px] font-bold uppercase tracking-wide text-slate-500">
              Leyenda
            </p>
            <ul className="space-y-1 text-xs">
              {(
                [
                  ['M', 'Mañana'],
                  ['T', 'Tarde'],
                  ['N', 'Noche'],
                  ['MT', 'M-T finde'],
                  ['P', 'Permiso'],
                  ['D', 'Descanso'],
                  ['V', 'Vacaciones'],
                ] as const
              ).map(([turno, label]) => (
                <li key={turno} className="flex items-center gap-2">
                  <span
                    className={`inline-flex h-6 min-w-8 items-center justify-center px-1 text-[11px] ${CLASE_TURNO[turno]}`}
                  >
                    {etiquetaTurno(turno)}
                  </span>
                  <span>{label}</span>
                </li>
              ))}
            </ul>
            <p className="mt-3 text-xs text-slate-500">
              Los datos salen del cuadrante de jefes. Usa «Exportar PDF» para
              imprimir el mes del agente filtrado.
            </p>
          </div>
        </DashboardSidebar>
      </DashboardBody>
    </section>
  )
}
