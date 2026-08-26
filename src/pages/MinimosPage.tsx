import { useEffect, useRef, useState } from 'react'
import {
  DIAS_SEMANA_CONFIG,
  type DiaSemana,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import { saveMinimosSemana } from '@/lib/db'
import { isFirebaseReady } from '@/lib/firebase'
import {
  copiarMinimosDiaATodaLaSemana,
  useMinimosSemanaData,
  usePuestosData,
} from '@/lib/puestosStore'

const TURNOS: TurnoOperativo[] = ['M', 'T', 'N']
const INPUT_MIN =
  'h-7 w-11 border border-slate-300 bg-white p-0.5 text-center text-xs tabular-nums outline-none focus:border-slate-700'
const CELDA = 'border border-slate-300 px-1.5 py-1 text-xs'
const DEBOUNCE_MS = 700

function leerNumero(valor: string) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.min(99, Math.max(0, Math.round(n)))
}

export function MinimosPage() {
  const [puestos] = usePuestosData()
  const [minimos, setMinimos] = useMinimosSemanaData()
  const [diaActivo, setDiaActivo] = useState<DiaSemana>(1)
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
    puestoNombre: string,
    turno: TurnoOperativo,
    valor: number,
  ) {
    setMinimos((actual) => ({
      ...actual,
      [diaActivo]: {
        ...actual[diaActivo],
        [puestoNombre]: {
          ...(actual[diaActivo][puestoNombre] ?? { M: 0, T: 0, N: 0 }),
          [turno]: valor,
        },
      },
    }))
    programarGuardado()
  }

  function copiarSemana() {
    const ok = window.confirm(
      `¿Copiar los mínimos de ${diaInfo.label} a todos los días de la semana?`,
    )
    if (!ok) return
    copiarMinimosDiaATodaLaSemana(diaActivo)
    programarGuardado()
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-sm font-bold text-slate-900">
            Mínimos por día
          </h1>
          <p className="text-[11px] text-slate-500">
            Dotación mínima de cada puesto según el día de la semana. Se guarda
            automáticamente en Firestore.
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
            disabled={puestos.length === 0 || !firebaseOk}
            onClick={copiarSemana}
          >
            Copiar {diaInfo.label} → toda la semana
          </button>
        </div>
      </div>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      <div className="flex shrink-0 flex-wrap gap-1 px-1">
        {DIAS_SEMANA_CONFIG.map((item) => (
          <button
            key={item.dia}
            type="button"
            className={`h-8 min-w-16 px-2 text-xs font-semibold ${
              diaActivo === item.dia
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => setDiaActivo(item.dia)}
          >
            {item.label}
          </button>
        ))}
      </div>

      <div className="min-h-0 flex-1 overflow-auto border border-slate-300 bg-white">
        {puestos.length === 0 ? (
          <p className="px-4 py-8 text-center text-xs text-slate-500">
            Primero configura puestos en el panel Puestos.
          </p>
        ) : (
          <table className="w-full border-collapse text-xs">
            <thead>
              <tr className="bg-slate-50 text-slate-600">
                <th className={`${CELDA} text-left font-semibold`}>Puesto</th>
                {TURNOS.map((turno) => (
                  <th
                    key={turno}
                    className={`${CELDA} text-center font-semibold`}
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
                ))}
              </tr>
            </thead>
            <tbody>
              {puestos.map((puesto) => {
                const fila = minimos[diaActivo][puesto.nombre] ?? {
                  M: 0,
                  T: 0,
                  N: 0,
                }
                return (
                  <tr key={puesto.codigo} className="hover:bg-slate-50">
                    <td className={`${CELDA} font-medium text-slate-800`}>
                      <span className="font-mono text-slate-500">
                        {puesto.abreviatura}
                      </span>{' '}
                      {puesto.nombre}
                    </td>
                    {TURNOS.map((turno) => (
                      <td key={turno} className={`${CELDA} text-center`}>
                        <input
                          type="number"
                          min={0}
                          max={99}
                          className={INPUT_MIN}
                          value={fila[turno]}
                          disabled={!firebaseOk}
                          onChange={(event) =>
                            actualizar(
                              puesto.nombre,
                              turno,
                              leerNumero(event.target.value),
                            )
                          }
                        />
                      </td>
                    ))}
                  </tr>
                )
              })}
            </tbody>
          </table>
        )}
      </div>

      <p className="shrink-0 px-1 text-[10px] text-slate-500">
        Vista: {diaInfo.label}. El calendario puede sobrescribir un día
        concreto.
      </p>
    </section>
  )
}
