import { useEffect, useMemo, useState } from 'react'
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
import { useEventosData } from '@/lib/eventosStore'
import { isFirebaseReady } from '@/lib/firebase'
import { useMinimosSemanaData, usePuestosData } from '@/lib/puestosStore'
import type { EventoOperativo, TipoEvento } from '@/types'

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
const ANIO_INICIAL = 2026

const CAMPO =
  'h-7 border border-slate-300 bg-white px-2 text-xs text-slate-900 outline-none focus:border-slate-700'
const INPUT_MIN =
  'h-7 w-12 border border-slate-300 bg-white p-1 text-center text-xs tabular-nums outline-none focus:border-slate-700'
const CELDA_TABLA = 'border border-slate-300 px-2 py-1 text-xs'

const ETIQUETA_EVENTO: Partial<
  Record<TipoEvento, { emoji: string; clase: string; texto: string }>
> = {
  FESTIVO: {
    emoji: '🔴',
    clase: 'bg-red-100 text-red-900',
    texto: 'Festivo',
  },
  CRUCERO: {
    emoji: '🚢',
    clase: 'bg-blue-100 text-blue-900',
    texto: 'Crucero',
  },
  CONCIERTO: {
    emoji: '🎵',
    clase: 'bg-yellow-100 text-yellow-900',
    texto: 'Concierto',
  },
}

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

function EditorDiaDrawer({
  fecha,
  evento,
  puestos,
  semana,
  guardando,
  onGuardar,
  onBorrar,
  onCerrar,
}: {
  fecha: string
  evento: EventoOperativo | undefined
  puestos: PuestoConfig[]
  semana: MinimosSemana
  guardando?: boolean
  onGuardar: (evento: EventoOperativo | null) => void | Promise<void>
  onBorrar: () => void | Promise<void>
  onCerrar: () => void
}) {
  const baseDia = () => minimosDefectoParaFecha(fecha, semana, puestos)
  const [tipoDia, setTipoDia] = useState<TipoDiaEditor>(() =>
    tipoEditorDesdeEvento(evento),
  )
  const [descripcion, setDescripcion] = useState(evento?.descripcion ?? '')
  const [minimos, setMinimos] = useState<MinimosDia>(() =>
    evento
      ? minimosDesdeEvento(evento, puestos, baseDia())
      : baseDia(),
  )

  useEffect(() => {
    const base = minimosDefectoParaFecha(fecha, semana, puestos)
    setTipoDia(tipoEditorDesdeEvento(evento))
    setDescripcion(evento?.descripcion ?? '')
    setMinimos(
      evento ? minimosDesdeEvento(evento, puestos, base) : base,
    )
  }, [fecha, evento, puestos, semana])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCerrar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCerrar])

  async function guardar() {
    const defecto = minimosDefectoParaFecha(fecha, semana, puestos)
    if (tipoDia === 'NORMAL' && minimosIgualesDefecto(minimos, defecto, puestos)) {
      await onGuardar(null)
      return
    }

    await onGuardar({
      id: evento?.id ?? `ev-${fecha}`,
      fecha,
      tipo: tipoEventoDesdeEditor(tipoDia),
      descripcion:
        descripcion.trim() ||
        (tipoDia === 'NORMAL'
          ? 'Mínimos personalizados'
          : TIPO_DIA_LABEL[tipoDia]),
      modificadoresMinimos: minimosARecord(minimos, puestos),
    })
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
          <p className="text-xs text-slate-500">{formatoFecha(fecha)}</p>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">
              Tipo de día
            </span>
            <select
              className={CAMPO}
              value={tipoDia}
              onChange={(event) =>
                setTipoDia(event.target.value as TipoDiaEditor)
              }
            >
              {(Object.keys(TIPO_DIA_LABEL) as TipoDiaEditor[]).map((tipo) => (
                <option key={tipo} value={tipo}>
                  {TIPO_DIA_LABEL[tipo]}
                </option>
              ))}
            </select>
          </label>

          <label className="flex flex-col gap-1">
            <span className="text-[11px] font-semibold text-slate-600">
              Descripción
            </span>
            <input
              className={CAMPO}
              value={descripcion}
              placeholder="Notas operativas del día"
              onChange={(event) => setDescripcion(event.target.value)}
            />
          </label>

          <div>
            <p className="mb-1 text-[11px] font-semibold text-slate-600">
              Mínimos operativos por puesto
            </p>
            <table className="w-full border-collapse text-xs">
              <thead>
                <tr className="bg-slate-50 text-slate-600">
                  <th className={`${CELDA_TABLA} text-left font-semibold`}>
                    Puesto
                  </th>
                  {TURNOS.map((turno) => (
                    <th
                      key={turno}
                      className={`${CELDA_TABLA} text-center font-semibold`}
                    >
                      {turno}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {puestos.map((puesto) => (
                  <tr key={puesto.codigo}>
                    <td className={`${CELDA_TABLA} font-medium text-slate-800`}>
                      {puesto.nombre}
                    </td>
                    {TURNOS.map((turno) => (
                      <td key={turno} className={`${CELDA_TABLA} text-center`}>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          className={INPUT_MIN}
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
            <p className="mt-1 text-[10px] text-slate-500">
              Tab entre celdas. Normal + valores base no crea evento.
            </p>
          </div>
        </div>

        <footer className="flex flex-wrap justify-between gap-2 border-t border-slate-200 px-4 py-3">
          <button
            type="button"
            className="h-8 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:opacity-40"
            disabled={!evento || guardando}
            onClick={() => void onBorrar()}
          >
            Borrar evento
          </button>
          <div className="flex gap-2">
            <button
              type="button"
              className="h-8 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              disabled={guardando}
              onClick={onCerrar}
            >
              Cancelar
            </button>
            <button
              type="button"
              className="h-8 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={guardando}
              onClick={() => void guardar()}
            >
              {guardando ? 'Guardando…' : 'Guardar configuración del día'}
            </button>
          </div>
        </footer>
      </aside>
    </>
  )
}

export function CalendarioPage() {
  const [eventosData, setEventosData] = useEventosData()
  const [puestos] = usePuestosData()
  const [semana] = useMinimosSemanaData()
  const [anio, setAnio] = useState(ANIO_INICIAL)
  const [mes, setMes] = useState(8)
  const [fechaSeleccionada, setFechaSeleccionada] = useState<string | null>(
    null,
  )
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firebaseOk = isFirebaseReady()

  const eventosPorFecha = useMemo(() => {
    const mapa = new Map<string, EventoOperativo>()
    for (const evento of eventosData) mapa.set(evento.fecha, evento)
    return mapa
  }, [eventosData])

  const celdas = useMemo(() => celdasMes(anio, mes), [anio, mes])
  const eventoEditando = fechaSeleccionada
    ? eventosPorFecha.get(fechaSeleccionada)
    : undefined

  async function guardarDia(evento: EventoOperativo | null) {
    if (!fechaSeleccionada) return
    if (!firebaseOk) {
      window.alert('Firebase no está configurado; no se puede guardar.')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      const existente = eventosPorFecha.get(fechaSeleccionada)
      if (evento) {
        const guardado = await saveEvento(evento)
        setEventosData((actual) => {
          const resto = actual.filter(
            (item) => item.fecha !== fechaSeleccionada,
          )
          return [...resto, guardado]
        })
      } else {
        if (existente) await deleteEvento(existente.id)
        setEventosData((actual) =>
          actual.filter((item) => item.fecha !== fechaSeleccionada),
        )
      }
      setFechaSeleccionada(null)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el evento en Firestore'
      setError(mensaje)
      window.alert(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  async function borrarDia() {
    if (!fechaSeleccionada) return
    if (!firebaseOk) {
      window.alert('Firebase no está configurado; no se puede borrar.')
      return
    }

    const existente = eventosPorFecha.get(fechaSeleccionada)
    setGuardando(true)
    setError(null)
    try {
      if (existente) await deleteEvento(existente.id)
      setEventosData((actual) =>
        actual.filter((item) => item.fecha !== fechaSeleccionada),
      )
      setFechaSeleccionada(null)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo borrar el evento en Firestore'
      setError(mensaje)
      window.alert(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-sm font-bold text-slate-900">
            Calendario operativo
          </h1>
          <p className="text-[11px] text-slate-500">
            Eventos y mínimos por puesto · {eventosData.length} días
            configurados · Firestore
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Mes</span>
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
            <span className="text-xs font-semibold text-slate-600">Año</span>
            <input
              type="number"
              min={2020}
              max={2040}
              className={`${CAMPO} w-16`}
              value={anio}
              onChange={(event) =>
                setAnio(Number(event.target.value) || anio)
              }
            />
          </label>
        </div>
      </div>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto border border-slate-300 bg-white p-2">
        <div className="grid grid-cols-7 gap-1">
          {DIAS_SEMANA.map((dia) => (
            <div
              key={dia}
              className="py-1 text-center text-[11px] font-bold text-slate-500"
            >
              {dia}
            </div>
          ))}
          {celdas.map((dia, indice) => {
            if (dia == null) {
              return (
                <div
                  key={`hueco-${indice}`}
                  className="h-24 border border-transparent bg-slate-50/50"
                />
              )
            }

            const fecha = isoFecha(anio, mes, dia)
            const evento = eventosPorFecha.get(fecha)
            const etiqueta =
              evento && ETIQUETA_EVENTO[evento.tipo]
                ? ETIQUETA_EVENTO[evento.tipo]
                : null

            return (
              <button
                key={fecha}
                type="button"
                className={`flex h-24 flex-col border border-slate-300 p-1.5 text-left hover:border-slate-500 hover:ring-2 hover:ring-blue-400 ${
                  fechaSeleccionada === fecha ? 'ring-2 ring-blue-500' : 'bg-white'
                }`}
                onClick={() => setFechaSeleccionada(fecha)}
              >
                <span className="text-xs font-bold text-slate-800">{dia}</span>
                {etiqueta ? (
                  <span
                    className={`mt-1 inline-flex items-center gap-0.5 rounded px-1 py-0.5 text-[10px] font-semibold ${etiqueta.clase}`}
                  >
                    {etiqueta.emoji} {etiqueta.texto}
                  </span>
                ) : null}
                {evento && !etiqueta ? (
                  <span className="mt-1 rounded bg-slate-100 px-1 py-0.5 text-[10px] font-medium text-slate-700">
                    Override
                  </span>
                ) : null}
                {evento?.descripcion ? (
                  <span className="mt-auto line-clamp-2 text-[10px] text-slate-500">
                    {evento.descripcion}
                  </span>
                ) : null}
              </button>
            )
          })}
        </div>
      </div>

      {fechaSeleccionada ? (
        <EditorDiaDrawer
          key={fechaSeleccionada}
          fecha={fechaSeleccionada}
          evento={eventoEditando}
          puestos={puestos}
          semana={semana}
          guardando={guardando}
          onGuardar={guardarDia}
          onBorrar={borrarDia}
          onCerrar={() => setFechaSeleccionada(null)}
        />
      ) : null}
    </section>
  )
}
