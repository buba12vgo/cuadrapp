import { useEffect, useRef, useState } from 'react'
import { agenteNuevo, deleteAgente, getAgentes, saveAgente, saveAgentes } from '@/lib/db'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import {
  fetchFirebaseStatus,
  formatFirebaseStatus,
} from '@/lib/firebaseStatus'
import { useAgentesData } from '@/lib/agentesStore'
import {
  descargarPlantillaAgentes,
  fichasDesdeImportacion,
  parsearExcelAgentes,
} from '@/lib/importarAgentes'
import {
  puestoExcluidoParaAgente,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import { usePuestosData } from '@/lib/puestosStore'
import {
  ETIQUETA_PREFERENCIA,
  esSinPreferencia,
  inferirModoDesdeObjetivos,
  modoEfectivo,
  objetivosDesdeModo,
  PATRONES_FIJOS,
} from '@/lib/preferenciasAnuales'
import type {
  FichaPolicia,
  Limitaciones,
  ModoPreferenciaAnual,
  PreferenciaAnual,
  RolPolicia,
} from '@/types'

const ROL_LABEL: Record<RolPolicia, string> = {
  RESPONSABLE: 'Responsable',
  JEFE_SERVICIO: 'Jefe de servicio',
  JEFE_EQUIPO: 'Jefe de equipo',
  POLICIA: 'Policía',
  POLICIA_BOLSA: 'Policía Bolsa',
}

const MES_LABEL: Record<FichaPolicia['mesAnclaVacaciones'], string> = {
  JUNIO: 'Junio',
  JULIO: 'Julio',
  AGOSTO: 'Agosto',
  SEPTIEMBRE: 'Septiembre',
}

const ROLES: RolPolicia[] = [
  'RESPONSABLE',
  'JEFE_SERVICIO',
  'JEFE_EQUIPO',
  'POLICIA',
  'POLICIA_BOLSA',
]

const TURNO_LIMITACION_LABEL: Record<'M' | 'T' | 'N', string> = {
  M: 'Mañana',
  T: 'Tarde',
  N: 'Noche',
}

const TURNOS_LIMITACION: Array<'M' | 'T' | 'N'> = ['M', 'T', 'N']

function esPreferenciaPersonalizada(pref: PreferenciaAnual) {
  return !pref.modo && inferirModoDesdeObjetivos(pref) == null
}

const OPCIONES_PREFERENCIA: ModoPreferenciaAnual[] = [
  ...PATRONES_FIJOS,
  'SIN_PREFERENCIA',
]

const MESES_VACACIONES: FichaPolicia['mesAnclaVacaciones'][] = [
  'JUNIO',
  'JULIO',
  'SEPTIEMBRE',
  'AGOSTO',
]

const CAMPO =
  'h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-700'
const CAMPO_NUM =
  'h-8 w-14 border border-slate-300 bg-white px-1 text-center text-sm tabular-nums text-slate-900 outline-none focus:border-slate-700'
const BLOQUE = 'border border-slate-200 bg-white p-3'
const TITULO_BLOQUE =
  'mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase'

function leerMeses(valor: string) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.min(12, Math.max(0, Math.round(n)))
}

type FormularioFicha = {
  numeroPlaca: string
  nombre: string
  apellidos: string
  rolBase: RolPolicia
  mesAnclaVacaciones: FichaPolicia['mesAnclaVacaciones']
  limitaciones: Limitaciones
  preferenciaAnual: PreferenciaAnual
  puestosExcluidos: string[]
}

function normalizarExclusiones(
  exclusiones: string[],
  puestos: PuestoConfig[],
): string[] {
  const codigosValidos = new Set(puestos.map((puesto) => puesto.codigo))
  const nombresACodigo = new Map(
    puestos.map((puesto) => [puesto.nombre, puesto.codigo]),
  )
  const resultado = new Set<string>()

  for (const valor of exclusiones) {
    if (!valor) continue
    if (codigosValidos.has(valor)) {
      resultado.add(valor)
      continue
    }
    const codigo = nombresACodigo.get(valor)
    if (codigo) {
      resultado.add(codigo)
      continue
    }
    // Conservar códigos aún no hidratados / puestos eliminados del catálogo local.
    resultado.add(valor)
  }

  return [...resultado].sort((a, b) => a.localeCompare(b, 'es'))
}

function formularioDesde(agente: FichaPolicia): FormularioFicha {
  return {
    numeroPlaca: agente.numeroPlaca,
    nombre: agente.nombre,
    apellidos: agente.apellidos,
    rolBase: agente.rolBase,
    mesAnclaVacaciones: agente.mesAnclaVacaciones,
    limitaciones: { ...agente.limitaciones },
    preferenciaAnual: { ...agente.preferenciaAnual },
    puestosExcluidos: [...agente.puestosExcluidos],
  }
}

function FichaAgenteModal({
  agente,
  esNuevo,
  guardando,
  onGuardar,
  onEliminar,
  onCancelar,
}: {
  agente: FichaPolicia
  esNuevo?: boolean
  guardando?: boolean
  onGuardar: (ficha: FichaPolicia) => void | Promise<void>
  onEliminar?: () => void | Promise<void>
  onCancelar: () => void
}) {
  const [puestos] = usePuestosData()
  const [form, setForm] = useState(() => formularioDesde(agente))

  useEffect(() => {
    setForm(formularioDesde(agente))
  }, [agente])

  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCancelar()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onCancelar])

  function alternarPuesto(puesto: PuestoConfig, habilitado: boolean) {
    setForm((actual) => {
      const sinPuesto = actual.puestosExcluidos.filter(
        (codigo) => codigo !== puesto.codigo && codigo !== puesto.nombre,
      )
      return {
        ...actual,
        puestosExcluidos: habilitado
          ? sinPuesto
          : [...sinPuesto, puesto.codigo].sort((a, b) =>
              a.localeCompare(b, 'es'),
            ),
      }
    })
  }

  function alternarTurno(turno: 'M' | 'T' | 'N', habilitado: boolean) {
    setForm((actual) => {
      const siguiente = { ...actual.limitaciones, [turno]: habilitado }
      if (!siguiente.M && !siguiente.T && !siguiente.N) return actual
      return { ...actual, limitaciones: siguiente }
    })
  }

  const puestosActivos = puestos.filter(
    (puesto) =>
      !puestoExcluidoParaAgente(form.puestosExcluidos, puesto.nombre, puestos),
  ).length

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onCancelar}
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-labelledby="ficha-agente-titulo"
        className="flex max-h-[90vh] w-full max-w-lg flex-col border border-slate-300 bg-slate-50 shadow-xl"
        onClick={(event) => event.stopPropagation()}
        onSubmit={async (event) => {
          event.preventDefault()
          await onGuardar({
            ...agente,
            numeroPlaca: form.numeroPlaca.trim(),
            nombre: form.nombre.trim(),
            apellidos: form.apellidos.trim(),
            rolBase: form.rolBase,
            mesAnclaVacaciones: form.mesAnclaVacaciones,
            limitaciones: form.limitaciones,
            preferenciaAnual: form.preferenciaAnual,
            puestosExcluidos: normalizarExclusiones(
              form.puestosExcluidos,
              puestos,
            ),
          })
        }}
      >
        <header className="flex items-start justify-between gap-3 border-b border-slate-200 bg-white px-4 py-3">
          <div>
            <h2
              id="ficha-agente-titulo"
              className="text-sm font-bold text-slate-900"
            >
              {esNuevo ? 'Nuevo agente' : 'Ficha del agente'}
            </h2>
            <p className="text-xs text-slate-500">
              {esNuevo
                ? 'Alta en plantilla · Firestore'
                : `${agente.numeroPlaca} · ${agente.nombre} ${agente.apellidos}`}
            </p>
          </div>
        </header>

        <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-auto p-4">
          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Datos base</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Placa
                </span>
                <input
                  className={CAMPO}
                  value={form.numeroPlaca}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      numeroPlaca: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Rol
                </span>
                <select
                  className={CAMPO}
                  value={form.rolBase}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      rolBase: event.target.value as RolPolicia,
                    }))
                  }
                >
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {ROL_LABEL[rol]}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Nombre
                </span>
                <input
                  className={CAMPO}
                  value={form.nombre}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      nombre: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Apellidos
                </span>
                <input
                  className={CAMPO}
                  value={form.apellidos}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      apellidos: event.target.value,
                    }))
                  }
                />
              </label>
              <label className="col-span-2 flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Mes de vacaciones (ciclo)
                </span>
                <select
                  className={CAMPO}
                  value={form.mesAnclaVacaciones}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      mesAnclaVacaciones: event.target
                        .value as FichaPolicia['mesAnclaVacaciones'],
                    }))
                  }
                >
                  {MESES_VACACIONES.map((mes) => (
                    <option key={mes} value={mes}>
                      {MES_LABEL[mes]}
                    </option>
                  ))}
                </select>
                <span className="text-[10px] text-slate-500">
                  Referencia del ciclo Jun–Jul–Sep–Ago. Rota automáticamente cada año
                  en el plan anual.
                </span>
              </label>
            </div>
          </section>

          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Limitaciones</h3>
            <ul className="flex flex-col gap-1.5">
              {TURNOS_LIMITACION.map((turno) => (
                <li key={turno}>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="checkbox"
                      checked={form.limitaciones[turno]}
                      onChange={(event) =>
                        alternarTurno(turno, event.target.checked)
                      }
                    />
                    <span className="font-medium">
                      {TURNO_LIMITACION_LABEL[turno]} ({turno})
                    </span>
                  </label>
                </li>
              ))}
            </ul>
            <p className="mt-2 text-[11px] text-slate-500">
              Los turnos marcados son los que puede hacer. Por defecto están
              activos los tres.
            </p>
          </section>

          <section className={BLOQUE}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className={`${TITULO_BLOQUE} mb-0`}>Puestos que puede hacer</h3>
              <span className="text-[11px] tabular-nums text-slate-500">
                {puestosActivos}/{puestos.length} activos
              </span>
            </div>
            {puestos.length === 0 ? (
              <p className="text-xs text-slate-500">
                No hay puestos configurados. Créalos en Administración →
                Puestos; al crearlos se activan para toda la plantilla.
              </p>
            ) : (
              <ul className="flex flex-col gap-1.5">
                {puestos.map((puesto) => {
                  const habilitado = !puestoExcluidoParaAgente(
                    form.puestosExcluidos,
                    puesto.nombre,
                    puestos,
                  )
                  return (
                    <li key={puesto.codigo}>
                      <label className="flex items-center gap-2 text-sm text-slate-800">
                        <input
                          type="checkbox"
                          checked={habilitado}
                          onChange={(event) =>
                            alternarPuesto(puesto, event.target.checked)
                          }
                        />
                        <span className="min-w-0 flex-1">
                          <span className="font-medium">{puesto.nombre}</span>
                          <span className="ml-1.5 font-mono text-[11px] text-slate-500">
                            {puesto.abreviatura}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-2 text-[11px] text-slate-500">
              Desmarca un puesto para que no se pueda asignar a este agente. Un
              puesto nuevo queda activo por defecto en toda la plantilla.
            </p>
          </section>

          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Preferencia anual</h3>
            <ul className="flex flex-col gap-1.5">
              {OPCIONES_PREFERENCIA.map((modo) => (
                <li key={modo}>
                  <label className="flex items-center gap-2 text-sm text-slate-800">
                    <input
                      type="radio"
                      name="preferenciaAnual"
                      checked={modoEfectivo(form.preferenciaAnual) === modo}
                      onChange={() =>
                        setForm((actual) => ({
                          ...actual,
                          preferenciaAnual: objetivosDesdeModo(modo),
                        }))
                      }
                    />
                    <span className="font-medium">{ETIQUETA_PREFERENCIA[modo]}</span>
                    {modo !== 'SIN_PREFERENCIA' ? (
                      <span className="text-[11px] text-slate-500">
                        ({objetivosDesdeModo(modo).objetivoM}M ·{' '}
                        {objetivosDesdeModo(modo).objetivoT}T ·{' '}
                        {objetivosDesdeModo(modo).objetivoN}N)
                      </span>
                    ) : (
                      <span className="text-[11px] text-slate-500">
                        (cualquiera de los tres patrones, según limitaciones)
                      </span>
                    )}
                  </label>
                </li>
              ))}
            </ul>
            {esPreferenciaPersonalizada(form.preferenciaAnual) ? (
              <div className="mt-3 flex flex-wrap gap-3 border-t border-slate-200 pt-3">
                {(['objetivoM', 'objetivoT', 'objetivoN'] as const).map(
                  (clave) => {
                    const turno = clave.replace('objetivo', '') as 'M' | 'T' | 'N'
                    return (
                      <label key={clave} className="flex items-center gap-1.5">
                        <span className="text-[11px] font-semibold text-slate-600">
                          Objetivo {turno}
                        </span>
                        <input
                          type="number"
                          min={0}
                          max={12}
                          className={CAMPO_NUM}
                          value={form.preferenciaAnual[clave]}
                          onChange={(event) =>
                            setForm((actual) => ({
                              ...actual,
                              preferenciaAnual: {
                                ...actual.preferenciaAnual,
                                [clave]: leerMeses(event.target.value),
                              },
                            }))
                          }
                        />
                      </label>
                    )
                  },
                )}
              </div>
            ) : null}
            <p className="mt-1.5 text-[11px] text-slate-500">
              {esSinPreferencia(form.preferenciaAnual) ? (
                <>11 meses operativos · 1 mes de vacaciones (V).</>
              ) : (
                <>
                  Suma{' '}
                  {form.preferenciaAnual.objetivoM +
                    form.preferenciaAnual.objetivoT +
                    form.preferenciaAnual.objetivoN}{' '}
                  meses operativos · V{' '}
                  {12 -
                    form.preferenciaAnual.objetivoM -
                    form.preferenciaAnual.objetivoT -
                    form.preferenciaAnual.objetivoN}
                  .
                </>
              )}
            </p>
          </section>
        </div>

        <footer className="flex items-center justify-between gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <div>
            {!esNuevo && onEliminar ? (
              <button
                type="button"
                className="h-8 px-3 text-xs font-semibold text-red-700 hover:bg-red-50 disabled:cursor-wait disabled:opacity-50"
                disabled={guardando}
                onClick={() => void onEliminar()}
              >
                Eliminar agente
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button
              type="button"
              className="h-8 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
              onClick={onCancelar}
            >
              Cancelar
            </button>
            <button
              type="submit"
              disabled={guardando}
              className="h-8 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-wait disabled:opacity-60"
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </footer>
      </form>
    </div>
  )
}

export function AgentesPage() {
  const [agentesData, setAgentesData] = useAgentesData()
  const [agenteModal, setAgenteModal] = useState<FichaPolicia | null>(null)
  const [esNuevo, setEsNuevo] = useState(false)
  const [loading, setLoading] = useState(true)
  const [guardando, setGuardando] = useState(false)
  const [importando, setImportando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())
  const inputExcel = useRef<HTMLInputElement>(null)

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setLoading(true)
      setError(null)

      const ready = await ensureFirebase()
      if (cancelado) return
      setFirebaseOk(ready)

      if (!ready) {
        const status = await fetchFirebaseStatus()
        if (cancelado) return
        setError(
          status
            ? `Firebase no configurado. ${formatFirebaseStatus(status)}`
            : 'Firebase no configurado. Define VITE_FIREBASE_* en Vercel (valores no vacíos) y redespliega sin build cache, o usa .env.local en desarrollo.',
        )
        setLoading(false)
        return
      }

      try {
        const lista = await getAgentes()
        if (!cancelado) setAgentesData(lista)
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar la plantilla desde Firestore',
          )
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [setAgentesData])

  async function guardarFicha(ficha: FichaPolicia) {
    if (!ficha.numeroPlaca.trim()) {
      window.alert('Indica un número de placa')
      return
    }
    if (!ficha.nombre.trim()) {
      window.alert('Indica el nombre del agente')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      const guardado = await saveAgente(ficha)
      setAgentesData((actual) => {
        const existe = actual.some((agente) => agente.id === guardado.id)
        const lista = existe
          ? actual.map((agente) =>
              agente.id === guardado.id ? guardado : agente,
            )
          : [...actual, guardado]
        return [...lista].sort((a, b) =>
          a.numeroPlaca.localeCompare(b.numeroPlaca, 'es', { numeric: true }),
        )
      })
      setAgenteModal(null)
      setEsNuevo(false)
      void getAgentes().then(setAgentesData).catch(() => undefined)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el agente en Firestore'
      setError(mensaje)
      window.alert(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarAgente(agente: FichaPolicia) {
    const etiqueta = `${agente.numeroPlaca} · ${agente.nombre} ${agente.apellidos}`.trim()
    const ok = window.confirm(
      `¿Eliminar al agente «${etiqueta}»? Se quitará de la plantilla en Firestore.`,
    )
    if (!ok) return
    if (!firebaseOk) {
      window.alert('Firebase no está configurado; no se puede eliminar.')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      await deleteAgente(agente.id)
      setAgentesData((actual) =>
        actual.filter((item) => item.id !== agente.id),
      )
      setAgenteModal(null)
      setEsNuevo(false)
      void getAgentes().then(setAgentesData).catch(() => undefined)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el agente en Firestore'
      setError(mensaje)
      window.alert(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  async function importarDesdeExcel(archivo: File) {
    setImportando(true)
    setError(null)
    try {
      const { filas, avisos } = await parsearExcelAgentes(archivo)
      const fichas = fichasDesdeImportacion(filas, agentesData)
      const guardados = await saveAgentes(fichas)
      setAgentesData((actual) => {
        const porId = new Map(actual.map((agente) => [agente.id, agente]))
        for (const guardado of guardados) porId.set(guardado.id, guardado)
        return [...porId.values()].sort((a, b) =>
          a.numeroPlaca.localeCompare(b.numeroPlaca, 'es', { numeric: true }),
        )
      })
      const resumen = `Se han creado o actualizado ${guardados.length} fichas.`
      const extra =
        avisos.length > 0
          ? `\n\nAvisos:\n${avisos.slice(0, 12).join('\n')}`
          : ''
      window.alert(resumen + extra)
      void getAgentes().then(setAgentesData).catch(() => undefined)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo importar el Excel de agentes'
      setError(mensaje)
      window.alert(mensaje)
    } finally {
      setImportando(false)
      if (inputExcel.current) inputExcel.current.value = ''
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">
            Gestión de agentes
          </h1>
          <p className="text-sm text-slate-500">
            {loading
              ? 'Cargando plantilla desde Firestore…'
              : `${agentesData.length} fichas. Importa un Excel con número, nombre, apellidos y rol.`}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <input
            ref={inputExcel}
            type="file"
            accept=".xlsx,.xls,.csv"
            className="hidden"
            onChange={(event) => {
              const archivo = event.target.files?.[0]
              if (archivo) void importarDesdeExcel(archivo)
            }}
          />
          <button
            type="button"
            className="h-8 px-2 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            onClick={() => descargarPlantillaAgentes()}
          >
            Plantilla Excel
          </button>
          <button
            type="button"
            disabled={loading || importando || !firebaseOk}
            className="h-8 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => inputExcel.current?.click()}
          >
            {importando ? 'Importando…' : 'Importar Excel'}
          </button>
          <button
            type="button"
            disabled={loading || importando || !firebaseOk}
            className="h-8 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            onClick={() => {
              setEsNuevo(true)
              setAgenteModal(agenteNuevo())
            }}
          >
            Nuevo agente
          </button>
        </div>
      </header>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
          {error}
        </p>
      ) : null}

      {loading ? (
        <div className="flex items-center gap-2 border border-slate-200 bg-white px-4 py-8 text-sm text-slate-600">
          <span
            className="inline-block size-4 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
            aria-hidden
          />
          Cargando agentes…
        </div>
      ) : (
        <div className="overflow-x-auto border border-slate-200 bg-white">
          <table className="min-w-full text-left text-sm">
            <thead className="border-b border-slate-200 bg-slate-50 text-xs font-medium text-slate-500">
              <tr>
                <th className="px-3 py-2">Placa</th>
                <th className="px-3 py-2">Nombre</th>
                <th className="px-3 py-2">Rol base</th>
                <th className="px-3 py-2">Mes de vacaciones</th>
                <th className="px-3 py-2 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {agentesData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className="px-3 py-6 text-center text-sm text-slate-500"
                  >
                    No hay agentes en Firestore. Importa un Excel o pulsa
                    «Nuevo agente».
                  </td>
                </tr>
              ) : (
                agentesData.map((agente) => (
                  <tr key={agente.id} className="hover:bg-slate-50">
                    <td className="px-3 py-2 font-mono tabular-nums text-slate-700">
                      {agente.numeroPlaca}
                    </td>
                    <td className="px-3 py-2 font-medium text-slate-900">
                      {agente.nombre} {agente.apellidos}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {ROL_LABEL[agente.rolBase]}
                    </td>
                    <td className="px-3 py-2 text-slate-600">
                      {MES_LABEL[agente.mesAnclaVacaciones]}
                    </td>
                    <td className="px-3 py-2 text-right">
                      <button
                        type="button"
                        className="mr-2 border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          setEsNuevo(false)
                          setAgenteModal(agente)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={guardando || !firebaseOk}
                        className="text-xs font-semibold text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
                        onClick={() => void eliminarAgente(agente)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {agenteModal ? (
        <FichaAgenteModal
          key={esNuevo ? 'nuevo' : agenteModal.id}
          agente={agenteModal}
          esNuevo={esNuevo}
          guardando={guardando}
          onCancelar={() => {
            setAgenteModal(null)
            setEsNuevo(false)
          }}
          onGuardar={guardarFicha}
          onEliminar={
            esNuevo ? undefined : () => eliminarAgente(agenteModal)
          }
        />
      ) : null}
    </section>
  )
}
