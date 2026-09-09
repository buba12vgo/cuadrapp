import { useEffect, useMemo, useRef, useState } from 'react'
import {
  Copy,
  Download,
  LayoutTemplate,
  RotateCcw,
  Sigma,
  Sparkles,
} from 'lucide-react'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
} from '@/components/ui/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { SaveStatus } from '@/components/ui/SaveStatus'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import {
  ALERT_ERROR,
  BTN_PRIMARY,
  BTN_SECONDARY,
  PAGE_SECTION,
} from '@/lib/uiStyles'
import { MinimoCelda } from '@/components/minimos/MinimoCelda'
import { MinimosResumenPanel } from '@/components/minimos/MinimosResumenPanel'
import { useAgentesData } from '@/lib/agentesStore'
import {
  DIAS_SEMANA_CONFIG,
  crearMinimosSemana,
  type DiaSemana,
  type PuestoConfig,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import { saveMinimosSemana } from '@/lib/db'
import { exportarMinimosExcel } from '@/lib/exportarMinimosExcel'
import { isFirebaseReady } from '@/lib/firebase'
import {
  agruparPuestosPorCategoria,
  sumatoriosDia,
} from '@/lib/minimosEstadisticas'
import {
  copiarMinimosDiaADias,
  copiarMinimosDiaATodaLaSemana,
  useMinimosSemanaData,
  usePuestosData,
} from '@/lib/puestosStore'

const TURNOS: TurnoOperativo[] = ['M', 'T', 'N']
const DEBOUNCE_MS = 700

const CELDA = 'border-b border-slate-100 px-0 py-0 align-middle'
const COL_PUESTO =
  'sticky left-0 z-10 w-[5.25rem] min-w-[5.25rem] max-w-[5.25rem] bg-white px-0.5'

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
  const { confirm: askConfirm } = useAppDialog()
  const [agentes] = useAgentesData()
  const [puestos] = usePuestosData()
  const [minimos, setMinimos] = useMinimosSemanaData()
  const [diaActivo, setDiaActivo] = useState<DiaSemana>(1)
  const [diasDestino, setDiasDestino] = useState<DiaSemana[]>([])
  const [panelCopiaAbierto, setPanelCopiaAbierto] = useState(false)
  const [menuPlantillasAbierto, setMenuPlantillasAbierto] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [guardadoOk, setGuardadoOk] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [pendiente, setPendiente] = useState(false)
  const firebaseOk = isFirebaseReady()
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null)
  const minimosRef = useRef(minimos)
  const puestosRef = useRef(puestos)
  const menuPlantillasRef = useRef<HTMLDivElement>(null)

  const diaInfo =
    DIAS_SEMANA_CONFIG.find((item) => item.dia === diaActivo) ??
    DIAS_SEMANA_CONFIG[0]
  const diasDisponibles = DIAS_SEMANA_CONFIG.filter(
    (item) => item.dia !== diaActivo,
  )
  const gruposPuestos = useMemo(
    () => agruparPuestosPorCategoria(puestos),
    [puestos],
  )
  const plantillaOperativa = agentes.length

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

  useEffect(() => {
    if (!menuPlantillasAbierto) return
    const cerrar = (event: MouseEvent) => {
      if (
        menuPlantillasRef.current &&
        !menuPlantillasRef.current.contains(event.target as Node)
      ) {
        setMenuPlantillasAbierto(false)
      }
    }
    document.addEventListener('mousedown', cerrar)
    return () => document.removeEventListener('mousedown', cerrar)
  }, [menuPlantillasAbierto])

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

  async function copiarADiasSeleccionados() {
    if (diasDestino.length === 0) return
    const ok = await askConfirm(
      `¿Copiar los mínimos de ${diaInfo.label} a ${etiquetasDias(diasDestino)}?`,
      'Copiar mínimos',
    )
    if (!ok) return
    copiarMinimosDiaADias(diaActivo, diasDestino)
    programarGuardado()
    setPanelCopiaAbierto(false)
  }

  async function restablecerDefecto() {
    const ok = await askConfirm(
      '¿Restablecer todos los días a los mínimos por defecto de cada puesto?',
      'Restablecer mínimos',
      true,
    )
    if (!ok) return
    setMinimos(crearMinimosSemana(puestos))
    programarGuardado()
    setMenuPlantillasAbierto(false)
  }

  function aplicarPlantillaLaborables() {
    copiarMinimosDiaADias(diaActivo, [2, 3, 4, 5])
    programarGuardado()
    setMenuPlantillasAbierto(false)
  }

  function aplicarPlantillaSemanaCompleta() {
    copiarMinimosDiaATodaLaSemana(diaActivo)
    programarGuardado()
    setMenuPlantillasAbierto(false)
  }

  function renderFilaPuesto(puesto: PuestoConfig) {
    return (
      <tr key={puesto.codigo} className="group/row hover:bg-slate-50/70">
        <td
          className={`${CELDA} ${COL_PUESTO} border-r border-slate-200 group-hover/row:bg-slate-50`}
          title={`${puesto.abreviatura} · ${puesto.nombre}`}
        >
          <div className="truncate text-sm leading-none text-slate-800">
            <span className="font-mono text-sm font-bold text-slate-400">
              {puesto.abreviatura}
            </span>
            <span className="ml-0.5 font-medium">{puesto.nombre}</span>
          </div>
        </td>
        {DIAS_SEMANA_CONFIG.map((item) => {
          const fila = minimos[item.dia][puesto.nombre] ?? { M: 0, T: 0, N: 0 }
          const columnaActiva = diaActivo === item.dia
          return TURNOS.map((turno, indiceTurno) => (
            <td
              key={`${puesto.codigo}-${item.dia}-${turno}`}
              className={`${CELDA} ${
                indiceTurno === 0 ? 'border-l border-slate-200' : ''
              } ${esFinde(item.dia) ? 'bg-slate-50/50' : ''} ${
                columnaActiva ? 'bg-amber-50/40' : ''
              }`}
            >
              <MinimoCelda
                valor={fila[turno]}
                etiqueta={`${puesto.nombre}, ${item.label}, ${turno}`}
                onCambiar={(valor) =>
                  actualizar(item.dia, puesto.nombre, turno, valor)
                }
              />
            </td>
          ))
        })}
      </tr>
    )
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Mínimos semanales"
        subtitle="Dotación por puesto y día · guardado automático"
        status={
          <SaveStatus
            guardando={guardando}
            guardadoOk={guardadoOk}
            pendiente={pendiente}
          />
        }
        toolbar={
          <>
            <button
              type="button"
              className={BTN_PRIMARY}
              disabled={puestos.length === 0}
              onClick={() => setPanelCopiaAbierto((abierto) => !abierto)}
              aria-expanded={panelCopiaAbierto}
            >
              <Copy className="h-3 w-3" />
              Copiar {diaInfo.clave}
            </button>
            <div className="relative" ref={menuPlantillasRef}>
              <button
                type="button"
                className={BTN_SECONDARY}
                onClick={() => setMenuPlantillasAbierto((v) => !v)}
                aria-expanded={menuPlantillasAbierto}
              >
                <LayoutTemplate className="h-3 w-3" />
                Plantillas
              </button>
              {menuPlantillasAbierto ? (
                <div className="absolute left-0 z-30 mt-1 min-w-[12rem] rounded-lg border border-slate-200 bg-white py-1 shadow-lg">
                  <button
                    type="button"
                    className="block w-full px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={aplicarPlantillaLaborables}
                  >
                    {diaInfo.clave} → laborables (M–V)
                  </button>
                  <button
                    type="button"
                    className="block w-full px-2.5 py-1.5 text-left text-sm text-slate-700 hover:bg-slate-50"
                    onClick={aplicarPlantillaSemanaCompleta}
                  >
                    {diaInfo.clave} → toda la semana
                  </button>
                  <button
                    type="button"
                    className="block w-full border-t border-slate-100 px-2.5 py-1.5 text-left text-sm text-red-700 hover:bg-red-50"
                    onClick={() => void restablecerDefecto()}
                  >
                    Restablecer valores por defecto
                  </button>
                </div>
              ) : null}
            </div>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={puestos.length === 0}
              onClick={() => void restablecerDefecto()}
            >
              <RotateCcw className="h-3 w-3" />
              Restablecer
            </button>
            <button
              type="button"
              className={BTN_SECONDARY}
              disabled={puestos.length === 0}
              onClick={() => exportarMinimosExcel(puestos, minimos)}
            >
              <Download className="h-3 w-3" />
              Exportar
            </button>
          </>
        }
      />

      {panelCopiaAbierto ? (
        <div className="shrink-0 rounded-lg border border-amber-200 bg-amber-50/50 px-2.5 py-2">
          <p className="mb-1.5 text-sm text-slate-700">
            Origen: <strong>{diaInfo.label}</strong>. Elige días destino:
          </p>
          <div className="mb-2 flex flex-wrap gap-1.5">
            {diasDisponibles.map((item) => {
              const seleccionado = diasDestino.includes(item.dia)
              return (
                <button
                  key={item.dia}
                  type="button"
                  className={`h-7 min-w-9 rounded-lg px-2 text-sm font-semibold transition ${
                    seleccionado
                      ? 'bg-brand-600 text-white shadow-sm'
                      : 'border border-line bg-white text-slate-700 hover:border-brand-200 hover:bg-brand-50'
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
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700"
              onClick={seleccionarLaborables}
            >
              Laborables
            </button>
            <button
              type="button"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700"
              onClick={seleccionarTodos}
            >
              Todos
            </button>
            <button
              type="button"
              className="h-8 rounded-lg border border-slate-200 bg-white px-2.5 text-sm font-semibold text-slate-700"
              onClick={() => setDiasDestino([])}
            >
              Ninguno
            </button>
            <button
              type="button"
              className="ml-auto h-8 rounded-lg bg-brand-600 px-3 text-sm font-semibold text-white hover:bg-brand-700 disabled:opacity-50"
              disabled={diasDestino.length === 0}
              onClick={() => void copiarADiasSeleccionados()}
            >
              Copiar a {diasDestino.length || '…'} día
              {diasDestino.length === 1 ? '' : 's'}
            </button>
          </div>
        </div>
      ) : null}

      {error ? <p className={ALERT_ERROR}>{error}</p> : null}

      <DashboardBody>
        <DashboardMain>
          {puestos.length === 0 ? (
            <p className="px-4 py-8 text-center text-sm text-slate-500">
              Primero configura puestos en el panel Puestos.
            </p>
          ) : (
            <DashboardMainScroll>
              <table className="w-full min-w-0 border-collapse text-sm">
                <colgroup>
                  <col className="w-[5.25rem]" />
                  {DIAS_SEMANA_CONFIG.flatMap((item) =>
                    TURNOS.map((turno) => (
                      <col
                        key={`${item.dia}-${turno}`}
                        className="w-[1.35rem]"
                      />
                    )),
                  )}
                </colgroup>
                <thead className="sticky top-0 z-20 bg-slate-50/95 backdrop-blur-sm">
                  <tr>
                    <th
                      className={`${CELDA} ${COL_PUESTO} sticky left-0 z-30 border-b border-r border-slate-200 bg-slate-50 py-0.5 text-left text-sm font-semibold uppercase tracking-wide text-slate-500`}
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
                          className={`border-b border-slate-200 px-0 py-0.5 text-center text-sm font-bold ${
                            item.dia !== 1 ? 'border-l border-slate-200' : ''
                          } ${esFinde(item.dia) ? 'bg-slate-100' : ''} ${
                            activo
                              ? 'bg-amber-100 text-amber-950 ring-1 ring-inset ring-amber-300'
                              : 'text-slate-700'
                          }`}
                        >
                          <button
                            type="button"
                            className="w-full rounded px-0.5 py-0 hover:bg-white/60"
                            title={`${item.label} — origen al copiar`}
                            onClick={() => cambiarDiaActivo(item.dia)}
                          >
                            {item.clave}
                          </button>
                        </th>
                      )
                    })}
                  </tr>
                  <tr className="text-sm font-semibold uppercase text-slate-400">
                    {DIAS_SEMANA_CONFIG.map((item) =>
                      TURNOS.map((turno, indiceTurno) => (
                        <th
                          key={`${item.dia}-${turno}`}
                          className={`border-b border-slate-200 px-0 py-0.5 ${
                            indiceTurno === 0 ? 'border-l border-slate-200' : ''
                          } ${esFinde(item.dia) ? 'bg-slate-100/80' : 'bg-slate-50'} ${
                            diaActivo === item.dia ? 'bg-amber-50 text-amber-800' : ''
                          }`}
                        >
                          {turno}
                        </th>
                      )),
                    )}
                  </tr>
                </thead>
                <tbody>
                  {gruposPuestos.flatMap((grupo) => [
                    <tr key={`cat-${grupo.categoria}`} className="bg-slate-50/90">
                      <td
                        colSpan={1 + DIAS_SEMANA_CONFIG.length * 3}
                        className="sticky left-0 border-y border-slate-200 px-1 py-0.5 text-sm font-bold uppercase tracking-wider text-slate-500"
                      >
                        <span className="inline-flex items-center gap-1">
                          <Sparkles className="h-2.5 w-2.5" />
                          {grupo.categoria}
                        </span>
                      </td>
                    </tr>,
                    ...grupo.puestos.map((puesto) => renderFilaPuesto(puesto)),
                  ])}
                </tbody>
                <tfoot className="text-sm">
                  <tr className="bg-slate-800 text-white">
                    <td
                      className={`${CELDA} ${COL_PUESTO} border-r border-slate-600 bg-slate-800 py-0.5 font-semibold`}
                    >
                      <span className="inline-flex items-center gap-0.5">
                        <Sigma className="h-2.5 w-2.5" />
                        Σ
                      </span>
                    </td>
                    {DIAS_SEMANA_CONFIG.map((item) => {
                      const sums = sumatoriosDia(item.dia, puestos, minimos)
                      const columnaActiva = diaActivo === item.dia
                      return TURNOS.map((turno, indiceTurno) => (
                        <td
                          key={`sum-${item.dia}-${turno}`}
                          className={`${CELDA} py-0.5 text-center font-bold tabular-nums ${
                            indiceTurno === 0 ? 'border-l border-slate-600' : ''
                          } ${columnaActiva ? 'bg-slate-700' : 'bg-slate-800'}`}
                        >
                          {sums[turno]}
                        </td>
                      ))
                    })}
                  </tr>
                  <tr className="bg-brand-800 text-white">
                    <td
                      className={`${CELDA} ${COL_PUESTO} border-r border-brand-700 bg-brand-800 py-0.5 font-bold`}
                    >
                      Total
                    </td>
                    {DIAS_SEMANA_CONFIG.map((item) => {
                      const sums = sumatoriosDia(item.dia, puestos, minimos)
                      const columnaActiva = diaActivo === item.dia
                      return (
                        <td
                          key={`total-${item.dia}`}
                          colSpan={3}
                          className={`${CELDA} border-l border-brand-700 py-0.5 text-center text-sm font-bold tabular-nums ${
                            columnaActiva ? 'bg-brand-700' : 'bg-brand-800'
                          }`}
                        >
                          {sums.total}
                        </td>
                      )
                    })}
                  </tr>
                </tfoot>
              </table>
            </DashboardMainScroll>
          )}
        </DashboardMain>

        {puestos.length > 0 ? (
          <MinimosResumenPanel
            puestos={puestos}
            minimos={minimos}
            plantillaOperativa={plantillaOperativa}
          />
        ) : null}
      </DashboardBody>
    </section>
  )
}
