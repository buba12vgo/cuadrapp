import { useEffect, useMemo, useRef, useState } from 'react'
import {
  AlertCircle,
  CheckCircle2,
  Clock,
  Edit3,
  Layers,
  Plus,
  Trash2,
} from 'lucide-react'
import semillaJson from '@/data/roadmap.json' with { type: 'json' }
import { Modal } from '@/components/ui/Modal'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { BTN_GHOST, BTN_PRIMARY, CAMPO, FOCUS_RING } from '@/lib/uiStyles'

const CLAVE = 'cuadrapp.roadmap'

export const ESTADOS = ['Pendiente', 'En Progreso', 'Completado'] as const
export const PRIORIDADES = ['Alta', 'Media', 'Baja'] as const
export const FILTROS = ['Todas', 'Pendientes', 'En Progreso', 'Completadas'] as const

export type EstadoTarea = (typeof ESTADOS)[number]
export type PrioridadTarea = (typeof PRIORIDADES)[number]
export type FiltroEstado = (typeof FILTROS)[number]

export type TareaRoadmap = {
  id: string
  fase: string
  titulo: string
  descripcion: string
  prioridad: PrioridadTarea
  estado: EstadoTarea
}

type Borrador = {
  id: string | null
  fase: string
  titulo: string
  descripcion: string
  prioridad: PrioridadTarea
  estado: EstadoTarea
}

const SEMILLA = semillaJson as TareaRoadmap[]

const ESTILO_ESTADO: Record<EstadoTarea, string> = {
  Pendiente: 'bg-orange-50 text-orange-800 ring-orange-200',
  'En Progreso': 'bg-blue-50 text-blue-800 ring-blue-200',
  Completado: 'bg-emerald-50 text-emerald-800 ring-emerald-200',
}

const ESTILO_PRIORIDAD: Record<PrioridadTarea, string> = {
  Alta: 'bg-rose-50 text-rose-800 ring-rose-200',
  Media: 'bg-amber-50 text-amber-900 ring-amber-200',
  Baja: 'bg-slate-100 text-slate-600 ring-slate-200',
}

const ICONO_ESTADO = {
  Pendiente: AlertCircle,
  'En Progreso': Clock,
  Completado: CheckCircle2,
} as const

function esEstado(valor: unknown): valor is EstadoTarea {
  return ESTADOS.includes(valor as EstadoTarea)
}

function esPrioridad(valor: unknown): valor is PrioridadTarea {
  return PRIORIDADES.includes(valor as PrioridadTarea)
}

function esTarea(valor: unknown): valor is TareaRoadmap {
  if (!valor || typeof valor !== 'object') return false
  const tarea = valor as Partial<TareaRoadmap>
  return (
    typeof tarea.id === 'string' &&
    typeof tarea.fase === 'string' &&
    typeof tarea.titulo === 'string' &&
    typeof tarea.descripcion === 'string' &&
    esPrioridad(tarea.prioridad) &&
    esEstado(tarea.estado)
  )
}

function leerTareas(): TareaRoadmap[] {
  try {
    const raw = localStorage.getItem(CLAVE)
    if (!raw) return SEMILLA.map((tarea) => ({ ...tarea }))
    const parsed: unknown = JSON.parse(raw)
    if (!Array.isArray(parsed)) return SEMILLA.map((tarea) => ({ ...tarea }))
    const validas = parsed.filter(esTarea)
    return validas
  } catch {
    return SEMILLA.map((tarea) => ({ ...tarea }))
  }
}

function guardarTareas(tareas: TareaRoadmap[]) {
  try {
    localStorage.setItem(CLAVE, JSON.stringify(tareas))
  } catch {
    /* modo privado o cuota llena */
  }
}

function borradorNuevo(fase: string): Borrador {
  return {
    id: null,
    fase,
    titulo: '',
    descripcion: '',
    prioridad: 'Media',
    estado: 'Pendiente',
  }
}

function estadoDelFiltro(filtro: FiltroEstado): EstadoTarea | null {
  if (filtro === 'Pendientes') return 'Pendiente'
  if (filtro === 'Completadas') return 'Completado'
  if (filtro === 'En Progreso') return 'En Progreso'
  return null
}

export function RoadmapTimeline() {
  const { confirm } = useAppDialog()
  const [tareas, setTareas] = useState<TareaRoadmap[]>(leerTareas)
  const [filtro, setFiltro] = useState<FiltroEstado>('Todas')
  const [borrador, setBorrador] = useState<Borrador | null>(null)
  const [errorForm, setErrorForm] = useState<string | null>(null)
  const persistir = useRef(false)

  useEffect(() => {
    if (!persistir.current) {
      persistir.current = true
      return
    }
    guardarTareas(tareas)
  }, [tareas])

  const total = tareas.length
  const completadas = tareas.filter((tarea) => tarea.estado === 'Completado').length
  const enProgreso = tareas.filter((tarea) => tarea.estado === 'En Progreso').length
  const pendientes = tareas.filter((tarea) => tarea.estado === 'Pendiente').length
  const porcentaje = total === 0 ? 0 : Math.round((completadas / total) * 100)

  const estadoFiltro = estadoDelFiltro(filtro)
  const visibles = useMemo(
    () =>
      estadoFiltro
        ? tareas.filter((tarea) => tarea.estado === estadoFiltro)
        : tareas,
    [tareas, estadoFiltro],
  )

  const fases = useMemo(() => {
    const orden: string[] = []
    for (const tarea of visibles) {
      if (!orden.includes(tarea.fase)) orden.push(tarea.fase)
    }
    return orden
  }, [visibles])

  const fasesConocidas = useMemo(() => {
    const orden: string[] = []
    for (const tarea of tareas) {
      if (!orden.includes(tarea.fase)) orden.push(tarea.fase)
    }
    for (const tarea of SEMILLA) {
      if (!orden.includes(tarea.fase)) orden.push(tarea.fase)
    }
    return orden
  }, [tareas])

  function actualizar(id: string, parcial: Partial<TareaRoadmap>) {
    setTareas((actual) =>
      actual.map((tarea) => (tarea.id === id ? { ...tarea, ...parcial } : tarea)),
    )
  }

  async function eliminar(tarea: TareaRoadmap) {
    const ok = await confirm(
      `¿Quitar «${tarea.titulo}» del roadmap?`,
      'Eliminar tarea',
      true,
    )
    if (!ok) return
    setTareas((actual) => actual.filter((item) => item.id !== tarea.id))
  }

  function abrirNueva() {
    setErrorForm(null)
    setBorrador(borradorNuevo(fasesConocidas[0] ?? 'Fase 1'))
  }

  function abrirEdicion(tarea: TareaRoadmap) {
    setErrorForm(null)
    setBorrador({ ...tarea })
  }

  function guardarBorrador() {
    if (!borrador) return
    const titulo = borrador.titulo.trim()
    const fase = borrador.fase.trim()
    const descripcion = borrador.descripcion.trim()
    if (!fase) {
      setErrorForm('Indica la fase.')
      return
    }
    if (!titulo) {
      setErrorForm('El título es obligatorio.')
      return
    }
    const tarea: TareaRoadmap = {
      id: borrador.id ?? crypto.randomUUID(),
      fase,
      titulo,
      descripcion,
      prioridad: borrador.prioridad,
      estado: borrador.estado,
    }
    setTareas((actual) => {
      if (!borrador.id) return [...actual, tarea]
      return actual.map((item) => (item.id === tarea.id ? tarea : item))
    })
    setBorrador(null)
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-4 overflow-y-auto pr-1">
      <header className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <p className="text-[11px] font-bold uppercase tracking-[0.16em] text-slate-400">
              Desarrollo
            </p>
            <h1 className="font-display text-xl font-bold tracking-tight text-slate-950">
              Roadmap
            </h1>
            <p className="mt-1 max-w-xl text-sm text-slate-500">
              Seguimiento de lo que queda por hacer. Los cambios se guardan en
              este navegador; la base inicial está en el archivo de datos.
            </p>
          </div>
          <button type="button" className={BTN_PRIMARY} onClick={abrirNueva}>
            <Plus className="h-4 w-4" aria-hidden />
            Nueva tarea
          </button>
        </div>

        <div className="mt-4">
          <div className="mb-1.5 flex items-center justify-between text-xs font-semibold text-slate-500">
            <span>Progreso global</span>
            <span className="tabular-nums text-slate-800">{porcentaje}%</span>
          </div>
          <div
            className="h-2 overflow-hidden rounded-full bg-slate-100"
            role="progressbar"
            aria-valuenow={porcentaje}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-label="Porcentaje de tareas completadas"
          >
            <div
              className="h-full rounded-full bg-emerald-500 transition-[width]"
              style={{ width: `${porcentaje}%` }}
            />
          </div>
        </div>

        <div className="mt-3 flex flex-wrap gap-2">
          <span className="inline-flex items-center gap-1.5 rounded-full bg-orange-50 px-2.5 py-1 text-xs font-bold text-orange-800 ring-1 ring-orange-200">
            <AlertCircle className="h-3.5 w-3.5" aria-hidden />
            Pendientes {pendientes}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-blue-50 px-2.5 py-1 text-xs font-bold text-blue-800 ring-1 ring-blue-200">
            <Clock className="h-3.5 w-3.5" aria-hidden />
            En progreso {enProgreso}
          </span>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-xs font-bold text-emerald-800 ring-1 ring-emerald-200">
            <CheckCircle2 className="h-3.5 w-3.5" aria-hidden />
            Completadas {completadas}
          </span>
        </div>
      </header>

      <div className="flex flex-wrap gap-2" role="tablist" aria-label="Filtrar por estado">
        {FILTROS.map((opcion) => {
          const activo = filtro === opcion
          return (
            <button
              key={opcion}
              type="button"
              role="tab"
              aria-selected={activo}
              className={`rounded-full px-3 py-1.5 text-sm font-semibold ${FOCUS_RING} ${
                activo
                  ? 'bg-slate-950 text-white'
                  : 'bg-white text-slate-600 ring-1 ring-slate-200 hover:bg-slate-50'
              }`}
              onClick={() => setFiltro(opcion)}
            >
              {opcion}
            </button>
          )
        })}
      </div>

      {visibles.length === 0 ? (
        <p className="rounded-xl border border-dashed border-slate-200 bg-white px-4 py-8 text-center text-sm text-slate-500">
          No hay tareas en este filtro.
        </p>
      ) : (
        <div className="flex flex-col gap-6 pb-4">
          {fases.map((fase) => {
            const grupo = visibles.filter((tarea) => tarea.fase === fase)
            return (
              <section key={fase}>
                <h2 className="mb-2 flex items-center gap-2 text-sm font-extrabold text-slate-800">
                  <Layers className="h-4 w-4 text-slate-400" aria-hidden />
                  {fase}
                  <span className="font-semibold text-slate-400">{grupo.length}</span>
                </h2>
                <ul className="flex flex-col gap-2">
                  {grupo.map((tarea) => {
                    const Icono = ICONO_ESTADO[tarea.estado]
                    return (
                      <li
                        key={tarea.id}
                        className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
                      >
                        <div className="flex flex-wrap items-start justify-between gap-3">
                          <div className="min-w-0 flex-1">
                            <div className="flex flex-wrap items-center gap-2">
                              <Icono
                                className={`h-4 w-4 shrink-0 ${
                                  tarea.estado === 'Completado'
                                    ? 'text-emerald-600'
                                    : tarea.estado === 'En Progreso'
                                      ? 'text-blue-600'
                                      : 'text-orange-500'
                                }`}
                                aria-hidden
                              />
                              <h3
                                className={`text-sm font-bold text-slate-950 ${
                                  tarea.estado === 'Completado' ? 'line-through decoration-slate-300' : ''
                                }`}
                              >
                                {tarea.titulo}
                              </h3>
                              <span
                                className={`rounded-full px-2 py-0.5 text-[11px] font-bold ring-1 ${ESTILO_PRIORIDAD[tarea.prioridad]}`}
                              >
                                {tarea.prioridad}
                              </span>
                            </div>
                            <p className="mt-1.5 text-sm leading-relaxed text-slate-600">
                              {tarea.descripcion}
                            </p>
                          </div>
                          <div className="flex shrink-0 items-center gap-1.5">
                            <label className="sr-only" htmlFor={`estado-${tarea.id}`}>
                              Estado de {tarea.titulo}
                            </label>
                            <select
                              id={`estado-${tarea.id}`}
                              className={`h-8 rounded-lg px-2 text-xs font-bold ring-1 ${ESTILO_ESTADO[tarea.estado]} ${FOCUS_RING}`}
                              value={tarea.estado}
                              onChange={(event) =>
                                actualizar(tarea.id, {
                                  estado: event.target.value as EstadoTarea,
                                })
                              }
                            >
                              {ESTADOS.map((estado) => (
                                <option key={estado} value={estado}>
                                  {estado}
                                </option>
                              ))}
                            </select>
                            <button
                              type="button"
                              className={`rounded-lg p-2 text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
                              aria-label={`Editar ${tarea.titulo}`}
                              onClick={() => abrirEdicion(tarea)}
                            >
                              <Edit3 className="h-4 w-4" aria-hidden />
                            </button>
                            <button
                              type="button"
                              className={`rounded-lg p-2 text-slate-500 hover:bg-rose-50 hover:text-rose-700 ${FOCUS_RING}`}
                              aria-label={`Eliminar ${tarea.titulo}`}
                              onClick={() => void eliminar(tarea)}
                            >
                              <Trash2 className="h-4 w-4" aria-hidden />
                            </button>
                          </div>
                        </div>
                      </li>
                    )
                  })}
                </ul>
              </section>
            )
          })}
        </div>
      )}

      {borrador ? (
        <Modal
          title={borrador.id ? 'Editar tarea' : 'Nueva tarea'}
          onClose={() => setBorrador(null)}
          footer={
            <>
              <button type="button" className={BTN_GHOST} onClick={() => setBorrador(null)}>
                Cancelar
              </button>
              <button type="button" className={BTN_PRIMARY} onClick={guardarBorrador}>
                Guardar
              </button>
            </>
          }
        >
          <form
            className="flex flex-col gap-3"
            onSubmit={(event) => {
              event.preventDefault()
              guardarBorrador()
            }}
          >
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
              Fase
              <input
                className={CAMPO}
                list="roadmap-fases"
                value={borrador.fase}
                onChange={(event) =>
                  setBorrador((actual) =>
                    actual ? { ...actual, fase: event.target.value } : actual,
                  )
                }
              />
              <datalist id="roadmap-fases">
                {fasesConocidas.map((fase) => (
                  <option key={fase} value={fase} />
                ))}
              </datalist>
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
              Título
              <input
                className={CAMPO}
                value={borrador.titulo}
                autoFocus
                onChange={(event) =>
                  setBorrador((actual) =>
                    actual ? { ...actual, titulo: event.target.value } : actual,
                  )
                }
              />
            </label>
            <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
              Descripción
              <textarea
                className={`${CAMPO} min-h-24 py-2`}
                value={borrador.descripcion}
                onChange={(event) =>
                  setBorrador((actual) =>
                    actual ? { ...actual, descripcion: event.target.value } : actual,
                  )
                }
              />
            </label>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
                Prioridad
                <select
                  className={CAMPO}
                  value={borrador.prioridad}
                  onChange={(event) =>
                    setBorrador((actual) =>
                      actual
                        ? { ...actual, prioridad: event.target.value as PrioridadTarea }
                        : actual,
                    )
                  }
                >
                  {PRIORIDADES.map((prioridad) => (
                    <option key={prioridad} value={prioridad}>
                      {prioridad}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-1 text-sm font-semibold text-slate-600">
                Estado
                <select
                  className={CAMPO}
                  value={borrador.estado}
                  onChange={(event) =>
                    setBorrador((actual) =>
                      actual
                        ? { ...actual, estado: event.target.value as EstadoTarea }
                        : actual,
                    )
                  }
                >
                  {ESTADOS.map((estado) => (
                    <option key={estado} value={estado}>
                      {estado}
                    </option>
                  ))}
                </select>
              </label>
            </div>
            {errorForm ? (
              <p className="rounded-lg border border-rose-200 bg-rose-50 px-2 py-1.5 text-sm text-rose-800">
                {errorForm}
              </p>
            ) : null}
          </form>
        </Modal>
      ) : null}
    </section>
  )
}
