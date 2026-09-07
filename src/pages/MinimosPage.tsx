import { useEffect, useRef, useState } from 'react'
import {
  DIAS_SEMANA_CONFIG,
  type DiaSemana,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import { saveMinimosSemana } from '@/lib/db'
import { isFirebaseReady } from '@/lib/firebase'
import {
  copiarMinimosDiaADias,
  useMinimosSemanaData,
  usePuestosData,
} from '@/lib/puestosStore'

const TURNOS: TurnoOperativo[] = ['M', 'T', 'N']
const INPUT_MIN =
  'h-6 w-7 border border-slate-300 bg-white p-0 text-center text-[11px] tabular-nums outline-none focus:border-slate-700 focus:ring-1 focus:ring-slate-400'
const CELDA = 'border border-slate-200 px-0.5 py-0.5 align-middle'
const DEBOUNCE_MS = 700

function leerNumero(valor: string) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.min(99, Math.max(0, Math.round(n)))
}

function etiquetasDias(dias: DiaSemana[]) {
  return dias
    .map(
      (dia) =>
        DIAS_SEMANA_CONFIG.find((item) => item.dia === dia)?.label ?? String(dia),
    )
    .join(', ')
}

function esFinde(dia: DiaSemana) {
  return dia === 6 || dia === 7
}

export function MinimosPage() {
  const [puestos] = usePuestosData()
  const [minimos, setMinimos] = useMinimosSemanaData()
  const [diaActivo, setDiaActivo] = useState<DiaSemana>(1)
  const [diasDestino, setDiasDestino] = useState<DiaSemana[]>([])
  const [panelCopiaAbierto, setPanelCopiaAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState(false)
  const firebaseOk = isFirebaseReady()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minimosRef = useRef(minimos)
  const puestosRef = useRef(puestos)

  const diaInfo =
    DIAS_SEMANA_CONFIG.find((item) => item.dia === diaActivo) ??
    DIAS_SEMANA_CONFIG[0]
  const diasDisponibles = DIAS_SEMANA_CONFIG.filter(
    (item) => item.dia !== diaActivo,
  )

  useEffect(() => {
    minimosRef.current = minimos
  }, [minimos])

  useEffect(() => {
    puestosRef.current = puestos
  }, [puestos])

  useEffect(() => {
    return () => {
      if (timerRef.current) clearTimeout(timerRef.current)
    }
  }, [])

  function cambiarDiaActivo(dia: DiaSemana) {
    setDiaActivo(dia)
    setDiasDestino((actual) => actual.filter((item) => item !== dia))
  }

  async function persistir() {
    if (!firebaseOk) return
    setGuardando(true)
    setError(null)
    setGuardadoOk(false)
    try {
      await saveMinimosSemana(minimosRef.current, puestosRef.current)
      setPendiente(false)
      setGuardadoOk(true)
      window.setTimeout(() => setGuardadoOk(false), 1500)
    } catch (err) {
      setError(
        err instanceof Error
          ? err.message
          : 'No se pudieron guardar los mínimos en Firestore',
      )
    } finally {
      setGuardando(false)
    }
  }

  function programarGuardado() {
    setPendiente(true)
    setGuardadoOk(false)
    if (timerRef.current) clearTimeout(timerRef.current)
    timerRef.current = setTimeout(() => {
      void persistir()
    }, DEBOUNCE_MS)
  }

  function actualizar(
    dia: DiaSemana,
    puestoNombre: string,
    turno: TurnoOperativo,
    valor: number,
  ) {
    setMinimos((actual) => ({
      ...actual,
      [dia]: {
        ...actual[dia],
        [puestoNombre]: {
          ...(actual[dia][puestoNombre] ?? { M: 0, T: 0, N: 0 }),
          [turno]: valor,
        },
      },
    }))
    programarGuardado()
  }

  function alternarDiaDestino(dia: DiaSemana) {
    setDiasDestino((actual) =>
      actual.includes(dia)
        ? actual.filter((item) => item !== dia)
        : [...actual, dia].sort((a, b) => a - b),
    )
  }

  function seleccionarLaborables() {
    setDiasDestino(
      diasDisponibles
        .map((item) => item.dia)
        .filter((dia) => dia >= 1 && dia <= 5),
    )
  }

  function seleccionarTodos() {
    setDiasDestino(diasDisponibles.map((item) => item.dia))
  }

  function copiarADiasSeleccionados() {
    if (diasDestino.length === 0) return
    const ok = window.confirm(
      `¿Copiar los mínimos de ${diaInfo.label} a ${etiquetasDias(diasDestino)}?`,
    )
    if (!ok) return
    copiarMinimosDiaADias(diaActivo, diasDestino)
    programarGuardado()
    setPanelCopiaAbierto(false)
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-sm font-bold text-slate-900">Mínimos semanales</h1>
          <p className="text-[11px] text-slate-500">
            Dotación mínima por puesto y día. Clic en un día para copiarlo a
            otros. Guardado automático.
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {guardando ? (
            <span className="text-[11px] text-slate-500">Guardando…</span>
          ) : null}
          {guardadoOk ? (
            <span className="text-[11px] font-semibold text-green-700">
              Guardado
            </span>
          ) : null}
          {pendiente && !guardando ? (
            <span className="text-[11px] text-amber-700">Cambios pendientes</span>
          ) : null}
          <button
            type="button"
            className="h-8 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
            disabled={puestos.length === 0}
            onClick={() => setPanelCopiaAbierto((abierto) => !abierto)}
            aria-expanded={panelCopiaAbierto}
          >
            Copiar {diaInfo.clave} → otros días
          </button>
        </div>
      </div>

      {panelCopiaAbierto ? (
        <div className="shrink-0 border border-slate-300 bg-slate-50 px-3 py-2">
          <p className="mb-2 text-[11px] text-slate-600">
            Origen: <strong>{diaInfo.label}</strong> (clic en la cabecera de un
            día de la tabla para cambiar el origen). Elige destinos:
          </p>
          <div className="mb-2 flex flex-wrap gap-1">
            {diasDisponibles.map((item) => {
              const seleccionado = diasDestino.includes(item.dia)
              return (
                <button
                  key={item.dia}
                  type="button"
                  className={`h-7 min-w-9 px-2 text-xs font-semibold ${
                    seleccionado
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-300 bg-white text-slate-700 hover:bg-white'
                  }`}
                  aria-pressed={seleccionado}
                  onClick={() => alternarDiaDestino(item.dia)}
                >
                  {item.clave}
                </button>
              )
            })}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              className="h-7 border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-white"
              onClick={seleccionarLaborables}
            >
              Laborables
            </button>
            <button
              type="button"
              className="h-7 border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-white"
              onClick={seleccionarTodos}
            >
              Todos
            </button>
            <button
              type="button"
              className="h-7 border border-slate-300 bg-white px-2 text-[11px] font-semibold text-slate-700 hover:bg-white"
              onClick={() => setDiasDestino([])}
            >
              Ninguno
            </button>
            <button
              type="button"
              className="ml-auto h-7 bg-slate-900 px-3 text-[11px] font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
              disabled={diasDestino.length === 0}
              onClick={copiarADiasSeleccionados}
            >
              Copiar a {diasDestino.length || '…'} día
              {diasDestino.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? (
        <p className="border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto border border-slate-300 bg-white">
        {puestos.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">
            Primero configura puestos en el panel Puestos.
          </p>
        ) : (
          <table className="w-max min-w-full border-collapse text-[11px]">
            <thead className="sticky top-0 z-20 bg-slate-100">
              <tr className="text-slate-600">
                <th
                  className={`${CELDA} sticky left-0 z-30 min-w-[52px] bg-slate-100 px-1.5 text-left font-semibold`}
                  rowSpan={2}
                >
                  Puesto
                </th>
                {DIAS_SEMANA_CONFIG.map((item) => {
                  const activo = diaActivo === item.dia
                  return (
                    <th
                      key={item.dia}
                      colSpan={3}
                      className={`${CELDA} border-b-0 px-0.5 text-center font-semibold ${
                        esFinde(item.dia) ? 'bg-slate-200/80' : ''
                      } ${
                        activo
                          ? 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-400'
                          : ''
                      }`}
                    >
                      <button
                        type="button"
                        className="w-full px-1 py-0.5 hover:underline"
                        title={`${item.label} — clic para usar como origen al copiar`}
                        onClick={() => cambiarDiaActivo(item.dia)}
                      >
                        {item.clave}
                      </button>
                    </th>
                  )
                })}
              </tr>
              <tr className="text-[10px] text-slate-500">
                {DIAS_SEMANA_CONFIG.map((item) =>
                  TURNOS.map((turno) => (
                    <th
                      key={`${item.dia}-${turno}`}
                      className={`${CELDA} w-8 px-0 text-center font-medium ${
                        esFinde(item.dia) ? 'bg-slate-50' : 'bg-slate-100'
                      } ${
                        diaActivo === item.dia
                          ? 'bg-amber-50 text-amber-900'
                          : ''
                      }`}
                      title={
                        turno === 'M'
                          ? 'Mañana'
                          : turno === 'T'
                            ? 'Tarde'
                            : 'Noche'
                      }
                    >
                      {turno}
                    </th>
                  )),
                )}
              </tr>
            </thead>
            <tbody>
              {puestos.map((puesto) => (
                <tr key={puesto.codigo} className="hover:bg-slate-50/80">
                  <td
                    className={`${CELDA} sticky left-0 z-10 bg-white px-1.5 font-mono font-semibold text-slate-700`}
                    title={puesto.nombre}
                  >
                    {puesto.abreviatura}
                  </td>
                  {DIAS_SEMANA_CONFIG.map((item) => {
                    const fila = minimos[item.dia][puesto.nombre] ?? {
                      M: 0,
                      T: 0,
                      N: 0,
                    }
                    const columnaActiva = diaActivo === item.dia
                    return TURNOS.map((turno) => (
                      <td
                        key={`${puesto.codigo}-${item.dia}-${turno}`}
                        className={`${CELDA} text-center ${
                          esFinde(item.dia) ? 'bg-slate-50/60' : ''
                        } ${columnaActiva ? 'bg-amber-50/50' : ''}`}
                      >
                        <input
                          type="number"
                          min={0}
                          max={99}
                          className={INPUT_MIN}
                          aria-label={`${puesto.nombre}, ${item.label}, ${turno}`}
                          value={fila[turno]}
                          onChange={(event) =>
                            actualizar(
                              item.dia,
                              puesto.nombre,
                              turno,
                              leerNumero(event.target.value),
                            )
                          }
                        />
                      </td>
                    ))
                  })}
                </tr>
              ))}
            </tbody>
            <tfoot className="sticky bottom-0 z-10 bg-slate-100 text-[10px] text-slate-600">
              <tr>
                <td
                  className={`${CELDA} sticky left-0 z-20 bg-slate-100 px-1.5 font-semibold`}
                >
                  Σ día
                </td>
                {DIAS_SEMANA_CONFIG.map((item) => {
                  let total = 0
                  for (const puesto of puestos) {
                    const fila = minimos[item.dia][puesto.nombre]
                    if (!fila) continue
                    total += fila.M + fila.T + fila.N
                  }
                  return (
                    <td
                      key={`total-${item.dia}`}
                      colSpan={3}
                      className={`${CELDA} text-center font-semibold tabular-nums ${
                        esFinde(item.dia) ? 'bg-slate-200/60' : ''
                      } ${diaActivo === item.dia ? 'bg-amber-100/80' : ''}`}
                    >
                      {total}
                    </td>
                  )
                })}
              </tr>
            </tfoot>
          </table>
        )}
      </div>

      <p className="shrink-0 px-1 text-[10px] text-slate-500">
        Vista semanal compacta. Columna resaltada ({diaInfo.clave}): origen al
        copiar. El calendario puede sobrescribir un día concreto.
      </p>
    </section>
  )
}
