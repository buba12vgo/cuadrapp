import { useEffect, useMemo, useState } from 'react'
import { ChipEventoCalendario, ETIQUETA_EVENTO } from '@/components/ChipEventoCalendario'
import { CalendarioResumenPanel } from '@/components/dashboard/CalendarioResumenPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
} from '@/components/ui/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { AvisoSoloLectura } from '@/components/AvisoSoloLectura'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { useAcceso } from '@/contexts/AccesoContext'
import {
  ALERT_ERROR,
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  CAMPO,
  CAMPO_NUM,
  PAGE_SECTION,
  TD,
  TH,
} from '@/lib/uiStyles'
import {
  TIPO_DIA_LABEL,
  minimosARecord,
  minimosDefectoParaFecha,
  minimosDesdeEvento,
  minimosIgualesDefecto,
  tipoEditorDesdeEvento,
  tipoEventoDesdeEditor,
  type MinimosDia,
  type MinimosSemana,
  type PuestoConfig,
  type TipoDiaEditor,
} from '@/lib/calendarioPuestos'
import { diasDelMes } from '@/lib/convenio'
import { deleteEvento, saveEvento } from '@/lib/db'
import { isDesignPreview } from '@/lib/designPreview'
import { eventosEnFecha, useEventosData } from '@/lib/eventosStore'
import { isFirebaseReady } from '@/lib/firebase'
import { useMinimosSemanaData, usePuestosData } from '@/lib/puestosStore'
import type { EventoOperativo } from '@/types'

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
const TURNOS = ['M', 'T', 'N'] as const

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function leerNumero(valor: string) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.min(99, Math.max(0, Math.round(n)))
}

function formatoFecha(fecha: string) {
  const [anio, mes, dia] = fecha.split('-').map(Number)
  return `${dia} ${MESES[(mes ?? 1) - 1]} ${anio}`
}

function celdasMes(anio: number, mes: number) {
  const nDias = diasDelMes(anio, mes)
  const offset = (new Date(anio, mes - 1, 1).getDay() + 6) % 7
  const celdas: (number | null)[] = Array.from({ length: offset }, () => null)
  for (let dia = 1; dia <= nDias; dia++) celdas.push(dia)
  while (celdas.length % 7 !== 0) celdas.push(null)
  return celdas
}

type FilaEvento = {
  id: string
  tipoDia: TipoDiaEditor
  descripcion: string
}

function filaNueva(fecha: string, tipoDia: TipoDiaEditor = 'CRUCERO'): FilaEvento {
  const sufijo =
    typeof crypto !== 'undefined' && 'randomUUID' in crypto
      ? crypto.randomUUID().slice(0, 8)
      : String(Date.now())
  return { id: `ev-${fecha}-${sufijo}`, tipoDia, descripcion: '' }
}

function filasDesdeEventos(fecha: string, eventos: EventoOperativo[]): FilaEvento[] {
  if (eventos.length === 0) return [filaNueva(fecha, 'FESTIVO')]
  return eventos.map((evento) => ({
    id: evento.id,
    tipoDia: tipoEditorDesdeEvento(evento),
    descripcion: evento.descripcion,
  }))
}

function EditorDiaDrawer({
  fecha,
  eventos,
  puestos,
  semana,
  guardando,
  onGuardar,
  onCerrar,
}: {
  fecha: string
  eventos: EventoOperativo[]
  puestos: PuestoConfig[]
  semana: MinimosSemana
  guardando?: boolean
  onGuardar: (eventos: EventoOperativo[]) => void | Promise<void>
  onCerrar: () => void
}) {
  const baseDia = () => minimosDefectoParaFecha(fecha, semana, puestos)
  const [filas, setFilas] = useState<FilaEvento[]>(() =>
    filasDesdeEventos(fecha, eventos),
  )
  const [minimos, setMinimos] = useState<MinimosDia>(() => {
    const base = baseDia()
    const conMinimos =
      [...eventos]
        .reverse()
        .find((evento) => Object.keys(evento.modificadoresMinimos).length > 0) ??
      eventos[0]
    return conMinimos ? minimosDesdeEvento(conMinimos, puestos, base) : base
  })

  useEffect(() => {
    const base = minimosDefectoParaFecha(fecha, semana, puestos)
    setFilas(filasDesdeEventos(fecha, eventos))
    const conMinimos =
      [...eventos]
        .reverse()
        .find((evento) => Object.keys(evento.modificadoresMinimos).length > 0) ??
      eventos[0]
    setMinimos(conMinimos ? minimosDesdeEvento(conMinimos, puestos, base) : base)
  }, [fecha, eventos, puestos, semana])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  async function guardar() {
    const defecto = minimosDefectoParaFecha(fecha, semana, puestos)
    const minimosIguales = minimosIgualesDefecto(minimos, defecto, puestos)
    const utiles = filas.filter(
      (fila) => fila.descripcion.trim() || fila.tipoDia !== 'NORMAL' || !minimosIguales,
    )
    if (utiles.length === 0) {
      await onGuardar([])
      return
    }
    const record = minimosARecord(minimos, puestos)
    await onGuardar(
      utiles.map((fila) => ({
        id: fila.id,
        fecha,
        tipo: tipoEventoDesdeEditor(fila.tipoDia),
        descripcion:
          fila.descripcion.trim() ||
          (fila.tipoDia === 'NORMAL'
            ? 'Mínimos personalizados'
            : TIPO_DIA_LABEL[fila.tipoDia]),
        modificadoresMinimos: record,
      })),
    )
  }

  function quitarFila(id: string) {
    setFilas((actual) =>
      actual.length === 1 ? [filaNueva(fecha)] : actual.filter((fila) => fila.id !== id),
    )
  }

  return (
    <>
      <button
        type="button"
        className="fixed inset-0 z-40 bg-slate-900/30"
        aria-label="Cerrar editor"
        onClick={onCerrar}
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-labelledby="editor-dia-titulo"
        className="fixed top-0 right-0 z-50 flex h-full w-full max-w-md flex-col border-l border-slate-300 bg-white shadow-xl"
      >
        <header className="border-b border-slate-200 px-4 py-3">
          <h2 id="editor-dia-titulo" className="text-sm font-bold text-slate-900">
            Configuración del día
          </h2>
          <p className="text-sm text-slate-500">{formatoFecha(fecha)}</p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <div className="flex flex-col gap-2">
            <div className="flex items-center justify-between gap-2">
              <span className="text-sm font-semibold text-slate-600">
                Eventos del día
              </span>
              <button
                type="button"
                className={BTN_GHOST}
                onClick={() =>
                  setFilas((actual) => [...actual, filaNueva(fecha)])
                }
              >
                Añadir evento
              </button>
            </div>
            {filas.map((fila, indice) => {
              const etiqueta = ETIQUETA_EVENTO[tipoEventoDesdeEditor(fila.tipoDia)]
              return (
                <div
                  key={fila.id}
                  className="flex flex-col gap-1 rounded-md border border-slate-200 p-2"
                >
                  <div className="flex items-center justify-between gap-2">
                    <span className="text-xs font-bold text-slate-500">
                      Evento {indice + 1}
                      {etiqueta ? ` · ${etiqueta.emoji}` : ''}
                    </span>
                    <button
                      type="button"
                      className="text-xs font-semibold text-rose-700"
                      onClick={() => quitarFila(fila.id)}
                    >
                      Quitar
                    </button>
                  </div>
                  <select
                    className={CAMPO}
                    aria-label={`Tipo del evento ${indice + 1}`}
                    value={fila.tipoDia}
                    onChange={(event) => {
                      const tipoDia = event.target.value as TipoDiaEditor
                      setFilas((actual) =>
                        actual.map((item) =>
                          item.id === fila.id ? { ...item, tipoDia } : item,
                        ),
                      )
                    }}
                  >
                    {(Object.keys(TIPO_DIA_LABEL) as TipoDiaEditor[]).map((tipo) => (
                      <option key={tipo} value={tipo}>
                        {TIPO_DIA_LABEL[tipo]}
                      </option>
                    ))}
                  </select>
                  <input
                    className={CAMPO}
                    aria-label={`Nombre del evento ${indice + 1}`}
                    value={fila.descripcion}
                    placeholder="Nombre que verán los jefes"
                    onChange={(event) => {
                      const descripcion = event.target.value
                      setFilas((actual) =>
                        actual.map((item) =>
                          item.id === fila.id ? { ...item, descripcion } : item,
                        ),
                      )
                    }}
                  />
                </div>
              )
            })}
          </div>

          <div>
            <p className="mb-1 text-sm font-semibold text-slate-600">
              Mínimos operativos por puesto
            </p>
            <table className="w-full border-collapse text-sm">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className={`${TH} text-left`}>Puesto</th>
                  {TURNOS.map((turno) => (
                    <th key={turno} className={`${TH} text-center`}>
                      {turno}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {puestos.map((puesto) => (
                  <tr key={puesto.codigo}>
                    <td className={`${TD} font-medium`}>{puesto.nombre}</td>
                    {TURNOS.map((turno) => (
                      <td key={turno} className={`${TD} text-center`}>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          className={CAMPO_NUM}
                          value={minimos[puesto.nombre]?.[turno] ?? 0}
                          onChange={(event) =>
                            setMinimos((actual) => ({
                              ...actual,
                              [puesto.nombre]: {
                                ...(actual[puesto.nombre] ?? {
                                  M: 0,
                                  T: 0,
                                  N: 0,
                                }),
                                [turno]: leerNumero(event.target.value),
                              },
                            }))
                          }
                        />
                      </td>
                    ))}
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-1 text-sm text-slate-500">
              Tab entre celdas. Normal + valores base no crea evento.
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap justify-between gap-1 border-t border-slate-200 px-3 py-2">
          <button
            type="button"
            className={BTN_DANGER}
            disabled={eventos.length === 0 || guardando}
            onClick={() => void onGuardar([])}
          >
            Borrar día
          </button>
          <div className="flex gap-1">
            <button
              type="button"
              className={BTN_GHOST}
              disabled={guardando}
              onClick={onCerrar}
            >
              Cancelar
            </button>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={guardando}
              onClick={() => void guardar()}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </footer>
      </aside>
    </>
  )
}

export function CalendarioPage() {
  const { alert: showAlert } = useAppDialog()
  const { puedeEscribir } = useAcceso()
  const soloLectura = !puedeEscribir('calendario')
  const [eventosData, setEventosData] = useEventosData()
  const [puestosTodos] = usePuestosData()
  const puestos = useMemo(
    () => puestosTodos.filter((puesto) => puesto.ambito === 'OPERATIVO'),
    [puestosTodos],
  )
  const [semana] = useMinimosSemanaData()
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [mes, setMes] = useState(() => new Date().getMonth() + 1)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(
    null,
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firebaseOk = isFirebaseReady()

  const eventosPorFecha = useMemo(() => {
    const mapa = new Map<string, EventoOperativo[]>()
    for (const evento of eventosData) {
      const lista = mapa.get(evento.fecha) ?? []
      lista.push(evento)
      mapa.set(evento.fecha, lista)
    }
    return mapa
  }, [eventosData])

  const celdas = useMemo(() => celdasMes(anio, mes), [anio, mes])
  const eventosEditando = fechaSeleccionada
    ? (eventosPorFecha.get(fechaSeleccionada) ?? [])
    : []

  async function guardarDia(eventos: EventoOperativo[]) {
    if (soloLectura) return
    if (!fechaSeleccionada) return
    if (!firebaseOk && !isDesignPreview) {
      await showAlert('Firebase no está configurado; no se puede guardar.', 'Firebase')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      const previos = eventosEnFecha(eventosData, fechaSeleccionada)
      const ids = new Set(eventos.map((evento) => evento.id))
      if (firebaseOk) {
        for (const previo of previos) {
          if (!ids.has(previo.id)) await deleteEvento(previo.id)
        }
        for (const evento of eventos) await saveEvento(evento)
      }
      setEventosData((actual) => [
        ...actual.filter((item) => item.fecha !== fechaSeleccionada),
        ...eventos,
      ])
      setFechaSeleccionada(null)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el evento en Firestore'
      setError(mensaje)
      await showAlert(mensaje, 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Calendario operativo"
        subtitle={`${eventosData.length} eventos · varios por día · Firestore`}
        actions={
          <>
            <label className="flex items-center gap-1">
              <span className="text-sm font-semibold text-slate-600">Mes</span>
              <select
                className={CAMPO}
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
              <span className="text-sm font-semibold text-slate-600">Año</span>
              <input
                type="number"
                min={2020}
                max={2040}
                className={`${CAMPO} w-14`}
                value={anio}
                onChange={(event) =>
                  setAnio(Number(event.target.value) || anio)
                }
              />
            </label>
          </>
        }
      />

      {soloLectura ? <AvisoSoloLectura /> : null}
      {error ? <p className={ALERT_ERROR}>{error}</p> : null}

      <DashboardBody>
        <DashboardMain>
          <DashboardMainScroll className="p-1.5">
            <div className="grid grid-cols-7 gap-0.5">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="py-0.5 text-center text-sm font-bold text-slate-500"
            >
              {dia}
            </div>
          ))}
          {celdas.map((dia, indice) => {
            if (dia == null) {
              return (
                <div
                  key={`hueco-${indice}`}
                  className="h-[4.5rem] rounded-sm border border-transparent bg-slate-50/50"
                />
              )
            }

            const fecha = isoFecha(anio, mes, dia)
            const eventosDia = eventosPorFecha.get(fecha) ?? []

            return (
              <button
                key={fecha}
                type="button"
                className={`flex min-h-[5.5rem] flex-col rounded-sm border border-slate-200 p-1 text-left hover:border-slate-400 hover:ring-1 hover:ring-blue-300 ${
                  fechaSeleccionada === fecha
                    ? 'ring-2 ring-blue-500'
                    : 'bg-white'
                }`}
                onClick={() => {
                  if (!soloLectura) setFechaSeleccionada(fecha)
                }}
              >
                <span className="text-sm font-bold text-slate-800">{dia}</span>
                {eventosDia.map((item) => (
                  <ChipEventoCalendario key={item.id} evento={item} />
                ))}
              </button>
            )
          })}
            </div>
          </DashboardMainScroll>
        </DashboardMain>
        <CalendarioResumenPanel eventos={eventosData} anio={anio} mes={mes} />
      </DashboardBody>

      {fechaSeleccionada ? (
        <EditorDiaDrawer
          key={fechaSeleccionada}
          fecha={fechaSeleccionada}
          eventos={eventosEditando}
          puestos={puestos}
          semana={semana}
          guardando={guardando}
          onGuardar={guardarDia}
          onCerrar={() => setFechaSeleccionada(null)}
        />
      ) : null}
    </section>
  )
}
