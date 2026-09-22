import { useEffect, useMemo, useRef, useState } from 'react'
import { AgentesResumenPanel } from '@/components/dashboard/AgentesResumenPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
} from '@/components/ui/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { AvisoSoloLectura } from '@/components/AvisoSoloLectura'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { useAcceso } from '@/contexts/AccesoContext'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BLOQUE,
  BTN_DANGER,
  BTN_GHOST,
  BTN_PRIMARY,
  BTN_SECONDARY,
  CAMPO,
  CAMPO_NUM,
  PAGE_SECTION,
  TABLE,
  TD,
  TH,
  TITULO_BLOQUE,
} from '@/lib/uiStyles'
import { agenteNuevo, deleteAgente, getAgentes, saveAgente, saveAgentes } from '@/lib/db'
import { ensureFirebase, isFirebaseReady } from '@/lib/firebase'
import { isDesignPreview } from '@/lib/designPreview'
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
import { useTiposPermiso } from '@/lib/permisosStore'
import {
  cargarResumenPermisosAgente,
  diasLibreDisponibilidad,
  resumenPermisosVacio,
  saldoLibreDisponibilidad,
  asegurarRolloverDaa,
  type ResumenPermisosAgente,
} from '@/lib/conteoPermisos'
import {
  diasAnualesCatalogo,
  esDiasAnoAnterior,
  leerCuposPermisoAgente,
  normalizarDiasAnuales,
  saldosPermisoAgente,
} from '@/lib/cuposPermiso'
import { NOMBRE_JORNADA_DISPONIBLE } from '@/lib/jornadaDisponible'
import {
  ETIQUETA_PREFERENCIA,
  esSinPreferencia,
  inferirModoDesdeObjetivos,
  modoEfectivo,
  objetivosDesdeModo,
  PATRONES_FIJOS,
} from '@/lib/preferenciasAnuales'
import {
  ANIO_REFERENCIA_VACACIONES_DEFECTO,
  ETIQUETA_MES_VACACIONES,
  mesSiguienteCicloVacaciones,
} from '@/lib/vacaciones'
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

const CAMPO_FULL = `${CAMPO} w-full`

function FichaPermisosBloque({
  agente,
  esNuevo,
  cuposPermiso,
  onCuposPermiso,
  onAgenteActualizado,
}: {
  agente: FichaPolicia
  esNuevo?: boolean
  cuposPermiso: Record<string, number>
  onCuposPermiso: (codigo: string, dias: number) => void
  onAgenteActualizado?: (ficha: FichaPolicia) => void
}) {
  const [permisos] = useTiposPermiso()
  const [anio, setAnio] = useState(2026)
  const [resumen, setResumen] = useState<ResumenPermisosAgente>(() =>
    resumenPermisosVacio(),
  )
  const [agenteAnio, setAgenteAnio] = useState(agente)
  const [loading, setLoading] = useState(!esNuevo)
  const onAgenteActualizadoRef = useRef(onAgenteActualizado)

  useEffect(() => {
    onAgenteActualizadoRef.current = onAgenteActualizado
  })

  useEffect(() => {
    setAgenteAnio(agente)
  }, [agente])

  useEffect(() => {
    if (esNuevo) return
    let cancelado = false
    async function cargar() {
      setLoading(true)
      if (isDesignPreview) {
        if (!cancelado) {
          setResumen(resumenPermisosVacio())
          setLoading(false)
        }
        return
      }
      const ready = await ensureFirebase()
      if (!ready || cancelado) {
        if (!cancelado) {
          setResumen(resumenPermisosVacio())
          setLoading(false)
        }
        return
      }
      try {
        const actualizado = await asegurarRolloverDaa(agente, anio, permisos)
        if (cancelado) return
        if (actualizado !== agente) onAgenteActualizadoRef.current?.(actualizado)
        const datos = await cargarResumenPermisosAgente(
          actualizado,
          anio,
          permisos,
        )
        if (cancelado) return
        setAgenteAnio(actualizado)
        setResumen(datos)
      } catch {
        if (!cancelado) setResumen(resumenPermisosVacio())
      } finally {
        if (!cancelado) setLoading(false)
      }
    }
    void cargar()
    return () => {
      cancelado = true
    }
  }, [agente, anio, esNuevo, permisos])

  const agenteVista: FichaPolicia = {
    ...agenteAnio,
    cuposPermiso,
  }
  const saldos = saldosPermisoAgente(agenteVista, permisos, anio, resumen)
  const usadosLpd = diasLibreDisponibilidad(resumen)
  const saldoLpd = saldoLibreDisponibilidad(resumen)

  return (
    <section className={BLOQUE}>
      <div className="mb-2 flex items-baseline justify-between gap-2">
        <h3 className={`${TITULO_BLOQUE} mb-0`}>Permisos</h3>
        <label className="flex items-center gap-1.5 text-sm text-slate-600">
          Año
          <select
            className={CAMPO}
            value={anio}
            onChange={(event) =>
              setAnio(Number(event.target.value) || anio)
            }
          >
            {Array.from({ length: 11 }, (_, i) => 2020 + i).map((valor) => (
              <option key={valor} value={valor}>
                {valor}
              </option>
            ))}
          </select>
        </label>
      </div>
      {loading ? (
        <p className="text-sm text-slate-500">Sumando permisos de {anio}…</p>
      ) : (
        <>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="text-left text-slate-500">
                  <th className="pb-1 font-semibold">Tipo</th>
                  <th className="pb-1 text-right font-semibold">Cupo</th>
                  <th className="pb-1 text-right font-semibold">Usados</th>
                  <th className="pb-1 text-right font-semibold">Restan</th>
                </tr>
              </thead>
              <tbody>
                {saldos.map((saldo) => {
                  const esDaa = esDiasAnoAnterior(saldo.codigo)
                  const catalogo = permisos.find((p) => p.codigo === saldo.codigo)
                  const valorCupo =
                    cuposPermiso[saldo.codigo] ??
                    (catalogo ? diasAnualesCatalogo(catalogo) : 0)
                  return (
                    <tr key={saldo.codigo} className="border-t border-slate-100">
                        <td className="py-1 pr-2">
                          <span className="font-medium">{saldo.nombre}</span>
                          <span className="ml-1.5 font-mono text-slate-500">
                            {saldo.abreviatura}
                          </span>
                        </td>
                        <td className="py-1 text-right">
                          {esDaa ? (
                            <span className="tabular-nums">
                              {saldo.cupo ?? 0}
                            </span>
                          ) : (
                            <input
                              type="number"
                              min={0}
                              max={366}
                              className={`${CAMPO_NUM} w-14`}
                              value={valorCupo}
                              title="Tope anual de este agente. Vacío del catálogo: 0 = sin tope."
                              onChange={(event) =>
                                onCuposPermiso(
                                  saldo.codigo,
                                  normalizarDiasAnuales(Number(event.target.value)),
                                )
                              }
                            />
                          )}
                        </td>
                        <td className="py-1 text-right tabular-nums">
                          {saldo.usados}
                        </td>
                        <td
                          className={`py-1 text-right font-semibold tabular-nums ${
                            saldo.restan != null && saldo.restan < 0
                              ? 'text-red-700'
                              : 'text-emerald-800'
                          }`}
                        >
                          {saldo.restan == null ? '∞' : saldo.restan}
                        </td>
                      </tr>
                  )
                })}
              </tbody>
            </table>
          </div>
          {saldos.length === 0 ? (
            <p className="text-sm text-slate-500">
              No hay tipos de permiso. Créalos en Administración → Permisos.
            </p>
          ) : null}
          <div className="mt-3 flex flex-col gap-1 border-t border-slate-200 pt-2 text-sm">
            <div className="flex items-center justify-between gap-2 text-violet-900">
              <span>
                <span className="font-medium">{NOMBRE_JORNADA_DISPONIBLE}</span>
                <span className="ml-1.5 font-mono text-sm text-violet-700">
                  JD
                </span>
              </span>
              <span className="font-semibold tabular-nums">
                {resumen.jornadaDisponible}
              </span>
            </div>
            <p className="text-sm text-slate-500">
              {resumen.jornadaDisponible} JD generan LPD. Usados {usadosLpd}.
              Saldo LPD{' '}
              <span
                className={`font-semibold tabular-nums ${
                  saldoLpd < 0 ? 'text-red-700' : 'text-emerald-800'
                }`}
              >
                {saldoLpd}
              </span>
              . El 31 de diciembre a las 23:59 los días que resten (AP, LPD,
              DAA…) pasan a Días del Año Anterior.
            </p>
            {esNuevo ? (
              <p className="text-sm text-slate-500">
                Los usados se contabilizan al guardar el agente y asignar
                permisos en el cuadrante.
              </p>
            ) : null}
          </div>
        </>
      )}
    </section>
  )
}

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
  cuposPermiso: Record<string, number>
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
    cuposPermiso: leerCuposPermisoAgente(agente),
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
  const [puestosTodos] = usePuestosData()
  const [form, setForm] = useState(() => formularioDesde(agente))
  const cuposAnioRef = useRef(agente.cuposPermisoAnio)
  const puestos = useMemo(() => {
    const ambito =
      form.rolBase === 'JEFE_SERVICIO' || form.rolBase === 'RESPONSABLE'
        ? 'JEFE_SERVICIO'
        : 'OPERATIVO'
    return puestosTodos.filter((puesto) => puesto.ambito === ambito)
  }, [puestosTodos, form.rolBase])

  useEffect(() => {
    setForm(formularioDesde(agente))
    cuposAnioRef.current = agente.cuposPermisoAnio
  }, [agente.id])

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
    <Modal
      title={esNuevo ? 'Nuevo agente' : 'Ficha del agente'}
      subtitle={
        esNuevo
          ? 'Alta en plantilla · Firestore'
          : `${agente.numeroPlaca} · ${agente.nombre} ${agente.apellidos}`
      }
      onClose={onCancelar}
      size="md"
      panelClassName="max-h-[90vh]"
      bodyClassName="mt-3 min-h-0 overflow-auto"
      footerClassName="items-center justify-between"
      footer={
        <>
          <div>
            {!esNuevo && onEliminar ? (
              <button
                type="button"
                className={BTN_DANGER}
                disabled={guardando}
                onClick={() => void onEliminar()}
              >
                Eliminar agente
              </button>
            ) : null}
          </div>
          <div className="flex gap-2">
            <button type="button" className={BTN_GHOST} onClick={onCancelar}>
              Cancelar
            </button>
            <button
              type="submit"
              form="ficha-agente-form"
              disabled={guardando}
              className={BTN_PRIMARY}
            >
              {guardando ? 'Guardando…' : 'Guardar'}
            </button>
          </div>
        </>
      }
    >
      <form
        id="ficha-agente-form"
        className="flex flex-col gap-3"
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
            cuposPermiso:
              Object.keys(form.cuposPermiso).length > 0
                ? form.cuposPermiso
                : agente.cuposPermiso,
            cuposPermisoAnio:
              cuposAnioRef.current ?? agente.cuposPermisoAnio,
          })
        }}
      >
          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Datos base</h3>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">
                  Placa
                </span>
                <input
                  className={CAMPO_FULL}
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
                <span className="text-sm font-semibold text-slate-600">
                  Rol
                </span>
                <select
                  className={CAMPO_FULL}
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
                <span className="text-sm font-semibold text-slate-600">
                  Nombre
                </span>
                <input
                  className={CAMPO_FULL}
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
                <span className="text-sm font-semibold text-slate-600">
                  Apellidos
                </span>
                <input
                  className={CAMPO_FULL}
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
                <span className="text-sm font-semibold text-slate-600">
                  Mes de vacaciones {ANIO_REFERENCIA_VACACIONES_DEFECTO}
                </span>
                <select
                  className={CAMPO_FULL}
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
                <span className="text-sm text-slate-500">
                  Ciclo Jun → Jul → Sep → Ago. En{' '}
                  {ANIO_REFERENCIA_VACACIONES_DEFECTO + 1}:{' '}
                  {
                    ETIQUETA_MES_VACACIONES[
                      mesSiguienteCicloVacaciones(form.mesAnclaVacaciones)
                    ]
                  }
                  .
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
            <p className="mt-2 text-sm text-slate-500">
              Los turnos marcados son los que puede hacer. Por defecto están
              activos los tres.
            </p>
          </section>

          <section className={BLOQUE}>
            <div className="mb-2 flex items-baseline justify-between gap-2">
              <h3 className={`${TITULO_BLOQUE} mb-0`}>Puestos que puede hacer</h3>
              <span className="text-sm tabular-nums text-slate-500">
                {puestosActivos}/{puestos.length} activos
              </span>
            </div>
            {puestos.length === 0 ? (
              <p className="text-sm text-slate-500">
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
                          <span className="ml-1.5 font-mono text-sm text-slate-500">
                            {puesto.abreviatura}
                          </span>
                        </span>
                      </label>
                    </li>
                  )
                })}
              </ul>
            )}
            <p className="mt-2 text-sm text-slate-500">
              Desmarca un puesto para que no se pueda asignar a este agente. Un
              puesto nuevo queda activo por defecto en toda la plantilla.
            </p>
          </section>

          <FichaPermisosBloque
            agente={agente}
            esNuevo={esNuevo}
            cuposPermiso={form.cuposPermiso}
            onCuposPermiso={(codigo, dias) =>
              setForm((actual) => ({
                ...actual,
                cuposPermiso: { ...actual.cuposPermiso, [codigo]: dias },
              }))
            }
            onAgenteActualizado={(ficha) => {
              cuposAnioRef.current = ficha.cuposPermisoAnio
            }}
          />

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
                      <span className="text-sm text-slate-500">
                        ({objetivosDesdeModo(modo).objetivoM}M ·{' '}
                        {objetivosDesdeModo(modo).objetivoT}T ·{' '}
                        {objetivosDesdeModo(modo).objetivoN}N)
                      </span>
                    ) : (
                      <span className="text-sm text-slate-500">
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
                        <span className="text-sm font-semibold text-slate-600">
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
            <p className="mt-1.5 text-sm text-slate-500">
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
      </form>
    </Modal>
  )
}

export function AgentesPage() {
  const { alert, confirm } = useAppDialog()
  const { puedeEscribir } = useAcceso()
  const soloLectura = !puedeEscribir('agentes')
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

      if (isDesignPreview) {
        setLoading(false)
        return
      }

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
    if (soloLectura) return
    if (!ficha.numeroPlaca.trim()) {
      await alert('Indica un número de placa', 'Datos incompletos')
      return
    }
    if (!ficha.nombre.trim()) {
      await alert('Indica el nombre del agente', 'Datos incompletos')
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
      await alert(mensaje, 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function eliminarAgente(agente: FichaPolicia) {
    if (soloLectura) return
    const etiqueta = `${agente.numeroPlaca} · ${agente.nombre} ${agente.apellidos}`.trim()
    const ok = await confirm(
      `¿Eliminar al agente «${etiqueta}»? Se quitará de la plantilla en Firestore.`,
      'Eliminar agente',
      true,
    )
    if (!ok) return
    if (!firebaseOk) {
      await alert('Firebase no está configurado; no se puede eliminar.', 'Firebase')
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
      await alert(mensaje, 'Error al eliminar')
    } finally {
      setGuardando(false)
    }
  }

  async function importarDesdeExcel(archivo: File) {
    if (soloLectura) return
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
      await alert(resumen + extra, 'Importación completada')
      void getAgentes().then(setAgentesData).catch(() => undefined)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo importar el Excel de agentes'
      setError(mensaje)
      await alert(mensaje, 'Error al importar')
    } finally {
      setImportando(false)
      if (inputExcel.current) inputExcel.current.value = ''
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Gestión de agentes"
        subtitle={
          loading
            ? 'Cargando plantilla desde Firestore…'
            : `${agentesData.length} fichas · importa Excel o crea manualmente`
        }
        toolbar={
          <>
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
              className={BTN_GHOST}
              onClick={() => descargarPlantillaAgentes()}
            >
              Plantilla Excel
            </button>
            <button
              type="button"
              disabled={soloLectura || loading || importando || !firebaseOk}
              className={BTN_SECONDARY}
              onClick={() => inputExcel.current?.click()}
            >
              {importando ? 'Importando…' : 'Importar Excel'}
            </button>
            <button
              type="button"
              disabled={soloLectura || loading || importando || !firebaseOk}
              className={BTN_PRIMARY}
              onClick={() => {
                setEsNuevo(true)
                setAgenteModal(agenteNuevo())
              }}
            >
              Nuevo agente
            </button>
          </>
        }
      />

      {soloLectura ? <AvisoSoloLectura /> : null}
      {error ? <p className={ALERT_ERROR}>{error}</p> : null}

      {loading ? (
        <div className={`${ALERT_INFO} flex items-center gap-2`}>
          <span
            className="inline-block size-3 animate-spin rounded-full border-2 border-slate-300 border-t-slate-700"
            aria-hidden
          />
          Cargando agentes…
        </div>
      ) : (
        <DashboardBody>
          <DashboardMain>
            <DashboardMainScroll className="p-1.5">
              <table className={TABLE}>
            <thead className="sticky top-0 z-10 bg-slate-50">
              <tr>
                <th className={TH}>Placa</th>
                <th className={TH}>Nombre</th>
                <th className={TH}>Rol base</th>
                <th className={TH}>
                  Vacaciones {ANIO_REFERENCIA_VACACIONES_DEFECTO}
                </th>
                <th className={`${TH} text-right`}>Acciones</th>
              </tr>
            </thead>
            <tbody>
              {agentesData.length === 0 ? (
                <tr>
                  <td
                    colSpan={5}
                    className={`${TD} py-6 text-center text-slate-500`}
                  >
                    No hay agentes en Firestore. Importa un Excel o pulsa
                    «Nuevo agente».
                  </td>
                </tr>
              ) : (
                agentesData.map((agente) => (
                  <tr key={agente.id} className="hover:bg-slate-50/70">
                    <td className={`${TD} font-mono tabular-nums text-slate-600`}>
                      {agente.numeroPlaca}
                    </td>
                    <td className={`${TD} font-medium text-slate-900`}>
                      {agente.nombre} {agente.apellidos}
                    </td>
                    <td className={`${TD} text-slate-600`}>
                      {ROL_LABEL[agente.rolBase]}
                    </td>
                    <td className={`${TD} text-slate-600`}>
                      {MES_LABEL[agente.mesAnclaVacaciones]}
                    </td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        disabled={soloLectura}
                        className="mr-1.5 text-sm font-medium text-slate-700 hover:underline disabled:opacity-40"
                        onClick={() => {
                          setEsNuevo(false)
                          setAgenteModal(agente)
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        disabled={soloLectura || guardando || !firebaseOk}
                        className="text-sm font-semibold text-red-700 hover:underline disabled:cursor-not-allowed disabled:opacity-40"
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
            </DashboardMainScroll>
          </DashboardMain>
          <AgentesResumenPanel agentes={agentesData} />
        </DashboardBody>
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
