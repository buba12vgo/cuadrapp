import { useEffect, useState } from 'react'
import { agenteNuevo, getAgentes, saveAgente } from '@/lib/db'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import {
  fetchFirebaseStatus,
  formatFirebaseStatus,
} from '@/lib/firebaseStatus'
import { useAgentesData } from '@/lib/agentesStore'
import type {
  FichaPolicia,
  Limitaciones,
  PreferenciaAnual,
  RolPolicia,
} from '@/types'

const ROL_LABEL: Record<RolPolicia, string> = {
  RESPONSABLE: 'Responsable',
  JEFE_SERVICIO: 'Jefe de servicio',
  JEFE_EQUIPO: 'Jefe de equipo',
  POLICIA: 'Policía',
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
]

const MESES_VACACIONES: FichaPolicia['mesAnclaVacaciones'][] = [
  'JUNIO',
  'JULIO',
  'AGOSTO',
  'SEPTIEMBRE',
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
  }
}

function FichaAgenteModal({
  agente,
  esNuevo,
  guardando,
  onGuardar,
  onCancelar,
}: {
  agente: FichaPolicia
  esNuevo?: boolean
  guardando?: boolean
  onGuardar: (ficha: FichaPolicia) => void | Promise<void>
  onCancelar: () => void
}) {
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
                  Mes de vacaciones
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
              </label>
            </div>
          </section>

          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Limitaciones</h3>
            <ul className="flex flex-col gap-2">
              <li>
                <label className="flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.limitaciones.soloManana}
                    onChange={(event) =>
                      setForm((actual) => ({
                        ...actual,
                        limitaciones: {
                          ...actual.limitaciones,
                          soloManana: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>
                    <span className="font-medium">Conciliación (solo mañanas)</span>
                    <span className="block text-xs text-slate-500">
                      El patrón anual ignora tardes y noches.
                    </span>
                  </span>
                </label>
              </li>
              <li>
                <label className="flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.limitaciones.soloMananaNoche}
                    onChange={(event) =>
                      setForm((actual) => ({
                        ...actual,
                        limitaciones: {
                          ...actual.limitaciones,
                          soloMananaNoche: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>
                    <span className="font-medium">Solo mañanas y noches</span>
                    <span className="block text-xs text-slate-500">
                      Exento de tardes.
                    </span>
                  </span>
                </label>
              </li>
              <li>
                <label className="flex items-start gap-2 text-sm text-slate-800">
                  <input
                    type="checkbox"
                    className="mt-0.5"
                    checked={form.limitaciones.exentoNoches}
                    onChange={(event) =>
                      setForm((actual) => ({
                        ...actual,
                        limitaciones: {
                          ...actual.limitaciones,
                          exentoNoches: event.target.checked,
                        },
                      }))
                    }
                  />
                  <span>
                    <span className="font-medium">Exento de noches</span>
                    <span className="block text-xs text-slate-500">
                      Motivos médicos o de edad.
                    </span>
                  </span>
                </label>
              </li>
            </ul>
          </section>

          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Preferencia anual</h3>
            <div className="flex flex-wrap gap-3">
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
            <p className="mt-1.5 text-[11px] text-slate-500">
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
            </p>
          </section>
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
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
  const [error, setError] = useState<string | null>(null)
  const [firebaseOk, setFirebaseOk] = useState(isFirebaseReady())

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
              : `${agentesData.length} fichas. Las limitaciones y el patrón alimentan el plan anual.`}
          </p>
        </div>
        <button
          type="button"
          disabled={loading || !firebaseOk}
          className="h-8 border border-slate-300 bg-white px-3 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
          onClick={() => {
            setEsNuevo(true)
            setAgenteModal(agenteNuevo())
          }}
        >
          Nuevo agente
        </button>
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
                    No hay agentes en Firestore. Pulsa «Nuevo agente» para dar
                    de alta la plantilla.
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
                        className="border border-slate-200 px-2.5 py-1 text-xs font-medium text-slate-700 hover:bg-slate-100"
                        onClick={() => {
                          setEsNuevo(false)
                          setAgenteModal(agente)
                        }}
                      >
                        Editar
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
        />
      ) : null}
    </section>
  )
}
