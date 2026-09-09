import { useEffect, useState } from 'react'
import { PuestosResumenPanel } from '@/components/dashboard/PuestosResumenPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
} from '@/components/ui/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import {
  ALERT_ERROR,
  BLOQUE,
  BTN_GHOST,
  BTN_PRIMARY,
  CAMPO,
  PAGE_SECTION,
  TABLE,
  TD,
  TH,
  TITULO_BLOQUE,
} from '@/lib/uiStyles'
import {
  AMBITO_PUESTO_LABEL,
  normalizarAmbitoPuesto,
  normalizarCodigo,
  sugerirAbreviatura,
  type AmbitoPuesto,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import {
  deletePuesto,
  getAgentes,
  saveAgentes,
  saveMinimosSemana,
  savePuesto,
} from '@/lib/db'
import { isFirebaseReady } from '@/lib/firebase'
import {
  getMinimosSemana,
  renombrarPuestoEnMinimos,
  usePuestosData,
} from '@/lib/puestosStore'

const CAMPO_FULL = `${CAMPO} w-full`

type FormularioPuesto = {
  codigo: string
  nombre: string
  abreviatura: string
  ambito: AmbitoPuesto
}

function formularioVacio(): FormularioPuesto {
  return { codigo: '', nombre: '', abreviatura: '', ambito: 'OPERATIVO' }
}

function formularioDesde(puesto: PuestoConfig): FormularioPuesto {
  return {
    codigo: puesto.codigo,
    nombre: puesto.nombre,
    abreviatura: puesto.abreviatura,
    ambito: normalizarAmbitoPuesto(puesto.ambito),
  }
}

function validar(
  form: FormularioPuesto,
  puestos: PuestoConfig[],
  editandoCodigo: string | null,
): string | null {
  const nombre = form.nombre.trim()
  const codigo = normalizarCodigo(form.codigo || form.nombre)
  const abreviatura = form.abreviatura.trim().toUpperCase()

  if (!nombre) return 'El nombre es obligatorio'
  if (!codigo) return 'El código es obligatorio'
  if (!abreviatura) return 'La abreviatura es obligatoria'
  if (abreviatura.length > 5) return 'La abreviatura máximo 5 caracteres'

  const otroMismoNombre = puestos.find(
    (p) =>
      p.nombre.toLowerCase() === nombre.toLowerCase() &&
      p.codigo !== editandoCodigo,
  )
  if (otroMismoNombre) return 'Ya existe un puesto con ese nombre'

  const otroMismoCodigo = puestos.find(
    (p) => p.codigo === codigo && p.codigo !== editandoCodigo,
  )
  if (otroMismoCodigo) return 'Ya existe un puesto con ese código'

  const otroMismaAbrev = puestos.find(
    (p) =>
      p.abreviatura.toUpperCase() === abreviatura &&
      p.codigo !== editandoCodigo,
  )
  if (otroMismaAbrev) return 'Ya existe un puesto con esa abreviatura'

  return null
}

function EditorPuestoModal({
  titulo,
  inicial,
  editandoCodigo,
  puestos,
  guardando,
  onGuardar,
  onCancelar,
}: {
  titulo: string
  inicial: FormularioPuesto
  editandoCodigo: string | null
  puestos: PuestoConfig[]
  guardando?: boolean
  onGuardar: (puesto: PuestoConfig) => void | Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [codigoManual, setCodigoManual] = useState(Boolean(inicial.codigo))
  const [abrevManual, setAbrevManual] = useState(Boolean(inicial.abreviatura))

  useEffect(() => {
    setForm(inicial)
    setError(null)
    setCodigoManual(Boolean(inicial.codigo))
    setAbrevManual(Boolean(inicial.abreviatura))
  }, [inicial])

  return (
    <Modal
      title={titulo}
      subtitle={
        editandoCodigo == null
          ? 'Al crearlo se activa automáticamente para agentes del mismo ámbito.'
          : 'Nombre, código, abreviatura y ámbito del puesto'
      }
      onClose={onCancelar}
      size="sm"
      bodyClassName="mt-3"
      footer={
        <>
          <button
            type="button"
            className={BTN_GHOST}
            disabled={guardando}
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="submit"
            form="puesto-form"
            className={BTN_PRIMARY}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar puesto'}
          </button>
        </>
      }
    >
      <form
        id="puesto-form"
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          const fallo = validar(form, puestos, editandoCodigo)
          if (fallo) {
            setError(fallo)
            return
          }
          await onGuardar({
            codigo: normalizarCodigo(form.codigo || form.nombre),
            nombre: form.nombre.trim(),
            abreviatura: form.abreviatura.trim().toUpperCase(),
            ambito: form.ambito,
          })
        }}
      >
          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Datos del puesto</h3>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">
                  Ámbito
                </span>
                <select
                  className={CAMPO_FULL}
                  value={form.ambito}
                  onChange={(event) =>
                    setForm((actual) => ({
                      ...actual,
                      ambito: normalizarAmbitoPuesto(event.target.value),
                    }))
                  }
                >
                  {(Object.keys(AMBITO_PUESTO_LABEL) as AmbitoPuesto[]).map(
                    (ambito) => (
                      <option key={ambito} value={ambito}>
                        {AMBITO_PUESTO_LABEL[ambito]}
                      </option>
                    ),
                  )}
                </select>
                <span className="text-sm text-slate-500">
                  Operativo = cuadrante mensual. Jefes = cuadrante jefes de
                  servicio.
                </span>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">
                  Nombre
                </span>
                <input
                  className={CAMPO_FULL}
                  value={form.nombre}
                  autoFocus
                  onChange={(event) => {
                    const nombre = event.target.value
                    setForm((actual) => ({
                      ...actual,
                      nombre,
                      codigo: codigoManual
                        ? actual.codigo
                        : normalizarCodigo(nombre),
                      abreviatura: abrevManual
                        ? actual.abreviatura
                        : sugerirAbreviatura(nombre),
                    }))
                  }}
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">
                  Código
                </span>
                <input
                  className={CAMPO_FULL}
                  value={form.codigo}
                  disabled={editandoCodigo != null}
                  onChange={(event) => {
                    setCodigoManual(true)
                    setForm((actual) => ({
                      ...actual,
                      codigo: normalizarCodigo(event.target.value),
                    }))
                  }}
                />
                <span className="text-sm text-slate-500">
                  Identificador estable (exclusiones de agentes). No se puede
                  cambiar al editar.
                </span>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">
                  Abreviatura
                </span>
                <input
                  className={CAMPO_FULL}
                  maxLength={5}
                  value={form.abreviatura}
                  onChange={(event) => {
                    setAbrevManual(true)
                    setForm((actual) => ({
                      ...actual,
                      abreviatura: event.target.value.toUpperCase(),
                    }))
                  }}
                />
              </label>
            </div>
          </section>
          {error ? (
            <p className="border border-red-200 bg-red-50 px-2 py-1.5 text-sm text-red-800">
              {error}
            </p>
          ) : null}
      </form>
    </Modal>
  )
}

export function PuestosPage() {
  const { alert: showAlert, confirm: askConfirm } = useAppDialog()
  const [puestos, setPuestos] = usePuestosData()
  const [modo, setModo] = useState<'nuevo' | 'editar' | null>(null)
  const [editando, setEditando] = useState<PuestoConfig | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firebaseOk = isFirebaseReady()

  function abrirNuevo() {
    setEditando(null)
    setModo('nuevo')
  }

  function abrirEditar(puesto: PuestoConfig) {
    setEditando(puesto)
    setModo('editar')
  }

  async function persistirMinimosTrasCambioPuestos(lista: PuestoConfig[]) {
    await saveMinimosSemana(getMinimosSemana(), lista)
  }

  async function guardar(puesto: PuestoConfig) {
    if (!firebaseOk) {
      await showAlert('Firebase no está configurado; no se puede guardar.', 'Firebase')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      const guardado = await savePuesto(puesto)
      if (modo === 'nuevo') {
        setPuestos((actual) => [...actual, guardado])
        await persistirMinimosTrasCambioPuestos([
          ...puestos.filter((p) => p.codigo !== guardado.codigo),
          guardado,
        ])
      } else if (editando) {
        const nombreAnterior = editando.nombre
        if (nombreAnterior !== guardado.nombre) {
          renombrarPuestoEnMinimos(nombreAnterior, guardado.nombre)
        }
        const lista = puestos.map((item) =>
          item.codigo === editando.codigo ? guardado : item,
        )
        setPuestos(lista)
        await persistirMinimosTrasCambioPuestos(lista)
      }
      setModo(null)
      setEditando(null)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el puesto en Firestore'
      setError(mensaje)
      await showAlert(mensaje, 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function limpiarExclusionesDelPuesto(puesto: PuestoConfig) {
    const agentes = await getAgentes()
    const afectados = agentes.filter((agente) =>
      agente.puestosExcluidos.some(
        (valor) => valor === puesto.codigo || valor === puesto.nombre,
      ),
    )
    if (afectados.length === 0) return

    await saveAgentes(
      afectados.map((agente) => ({
        ...agente,
        puestosExcluidos: agente.puestosExcluidos.filter(
          (valor) => valor !== puesto.codigo && valor !== puesto.nombre,
        ),
      })),
    )
  }

  async function borrar(puesto: PuestoConfig) {
    const ok = await askConfirm(
      `¿Eliminar el puesto «${puesto.nombre}»? Se quitará de los mínimos configurados.`,
      'Eliminar puesto',
      true,
    )
    if (!ok) return
    if (!firebaseOk) {
      await showAlert('Firebase no está configurado; no se puede eliminar.', 'Firebase')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      await deletePuesto(puesto.codigo)
      const lista = puestos.filter((item) => item.codigo !== puesto.codigo)
      setPuestos(lista)
      await persistirMinimosTrasCambioPuestos(lista)
      try {
        await limpiarExclusionesDelPuesto(puesto)
      } catch (err) {
        console.warn('No se pudieron limpiar exclusiones del puesto eliminado', err)
      }
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el puesto en Firestore'
      setError(mensaje)
      await showAlert(mensaje, 'Error al eliminar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Puestos"
        subtitle={`${puestos.length} puestos · operativo y jefes · Firestore`}
        actions={
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={!firebaseOk || guardando}
            onClick={abrirNuevo}
          >
            Nuevo puesto
          </button>
        }
      />

      {error ? <p className={ALERT_ERROR}>{error}</p> : null}

      <DashboardBody>
        <DashboardMain>
          <DashboardMainScroll className="p-1.5">
            <table className={TABLE}>
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className={TH}>Nombre</th>
              <th className={TH}>Ámbito</th>
              <th className={TH}>Código</th>
              <th className={TH}>Abrev.</th>
              <th className={`${TH} text-right`}>Acciones</th>
            </tr>
          </thead>
          <tbody>
            {puestos.map((puesto) => (
              <tr key={puesto.codigo} className="hover:bg-slate-50/70">
                <td className={`${TD} font-medium`}>{puesto.nombre}</td>
                <td className={TD}>
                  {AMBITO_PUESTO_LABEL[normalizarAmbitoPuesto(puesto.ambito)]}
                </td>
                <td className={`${TD} font-mono text-slate-600`}>
                  {puesto.codigo}
                </td>
                <td className={`${TD} font-mono text-slate-600`}>
                  {puesto.abreviatura}
                </td>
                <td className={`${TD} text-right`}>
                  <button
                    type="button"
                    className="mr-1.5 text-sm font-semibold text-slate-700 hover:underline disabled:opacity-40"
                    disabled={guardando}
                    onClick={() => abrirEditar(puesto)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-40"
                    disabled={guardando}
                    onClick={() => void borrar(puesto)}
                  >
                    Eliminar
                  </button>
                </td>
              </tr>
            ))}
            {puestos.length === 0 ? (
              <tr>
                <td colSpan={5} className={`${TD} py-6 text-center text-slate-500`}>
                  No hay puestos. Crea el primero para configurar mínimos.
                </td>
              </tr>
            ) : null}
          </tbody>
            </table>
          </DashboardMainScroll>
        </DashboardMain>
        <PuestosResumenPanel puestos={puestos} />
      </DashboardBody>

      {modo === 'nuevo' ? (
        <EditorPuestoModal
          titulo="Nuevo puesto"
          inicial={formularioVacio()}
          editandoCodigo={null}
          puestos={puestos}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={() => setModo(null)}
        />
      ) : null}
      {modo === 'editar' && editando ? (
        <EditorPuestoModal
          titulo="Editar puesto"
          inicial={formularioDesde(editando)}
          editandoCodigo={editando.codigo}
          puestos={puestos}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={() => {
            setModo(null)
            setEditando(null)
          }}
        />
      ) : null}
    </section>
  )
}
