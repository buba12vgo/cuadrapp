import { useEffect, useState } from 'react'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
  DashboardSidebar,
} from '@/components/ui/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { Modal } from '@/components/ui/Modal'
import { AvisoSoloLectura } from '@/components/AvisoSoloLectura'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { useAcceso } from '@/contexts/AccesoContext'
import { KpiCard, KpiGrid2 } from '@/components/ui/DashboardKpi'
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
import { normalizarCodigo, sugerirAbreviatura } from '@/lib/calendarioPuestos'
import { deleteTipoPermiso, saveTipoPermiso } from '@/lib/db'
import { isFirebaseReady } from '@/lib/firebase'
import {
  diasAnualesCatalogo,
  esDiasAnoAnterior,
  normalizarDiasAnuales,
} from '@/lib/cuposPermiso'
import type { PermisoConfig } from '@/lib/permisos'
import { useTiposPermiso } from '@/lib/permisosStore'
import { FileText, Hash } from 'lucide-react'

const CAMPO_FULL = `${CAMPO} w-full`

type Formulario = {
  codigo: string
  nombre: string
  abreviatura: string
  diasAnuales: string
}

function formularioVacio(): Formulario {
  return { codigo: '', nombre: '', abreviatura: '', diasAnuales: '0' }
}

function formularioDesde(permiso: PermisoConfig): Formulario {
  return {
    codigo: permiso.codigo,
    nombre: permiso.nombre,
    abreviatura: permiso.abreviatura,
    diasAnuales: String(diasAnualesCatalogo(permiso)),
  }
}

function validar(
  form: Formulario,
  permisos: PermisoConfig[],
  editandoCodigo: string | null,
): string | null {
  const nombre = form.nombre.trim()
  const codigo = normalizarCodigo(form.codigo || form.nombre)
  const abreviatura = form.abreviatura.trim().toUpperCase()

  if (!nombre) return 'El nombre es obligatorio'
  if (!codigo) return 'El código es obligatorio'
  if (!abreviatura) return 'La abreviatura es obligatoria'
  if (abreviatura.length > 5) return 'La abreviatura máximo 5 caracteres'

  if (
    permisos.some(
      (p) =>
        p.nombre.toLowerCase() === nombre.toLowerCase() &&
        p.codigo !== editandoCodigo,
    )
  ) {
    return 'Ya existe un permiso con ese nombre'
  }
  if (permisos.some((p) => p.codigo === codigo && p.codigo !== editandoCodigo)) {
    return 'Ya existe un permiso con ese código'
  }
  if (
    permisos.some(
      (p) =>
        p.abreviatura.toUpperCase() === abreviatura &&
        p.codigo !== editandoCodigo,
    )
  ) {
    return 'Ya existe un permiso con esa abreviatura'
  }
  return null
}

function EditorModal({
  titulo,
  inicial,
  editandoCodigo,
  permisos,
  guardando,
  onGuardar,
  onCancelar,
}: {
  titulo: string
  inicial: Formulario
  editandoCodigo: string | null
  permisos: PermisoConfig[]
  guardando?: boolean
  onGuardar: (permiso: PermisoConfig) => void | Promise<void>
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
          subtitle="Tipos de permiso de toda la plantilla (celda P)."
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
            form="permiso-form"
            className={BTN_PRIMARY}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar permiso'}
          </button>
        </>
      }
    >
      <form
        id="permiso-form"
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          const fallo = validar(form, permisos, editandoCodigo)
          if (fallo) {
            setError(fallo)
            return
          }
          await onGuardar({
            codigo: normalizarCodigo(form.codigo || form.nombre),
            nombre: form.nombre.trim(),
            abreviatura: form.abreviatura.trim().toUpperCase(),
            diasAnuales: esDiasAnoAnterior(form.codigo || form.nombre)
              ? 0
              : normalizarDiasAnuales(Number(form.diasAnuales)),
            visible: true,
          })
        }}
      >
        <section className={BLOQUE}>
          <h3 className={TITULO_BLOQUE}>Datos del permiso</h3>
          <div className="flex flex-col gap-2">
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
            <label className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-600">
                Días al año (por agente)
              </span>
              <input
                className={CAMPO_FULL}
                type="number"
                min={0}
                max={366}
                disabled={esDiasAnoAnterior(editandoCodigo ?? form.codigo)}
                value={form.diasAnuales}
                onChange={(event) =>
                  setForm((actual) => ({
                    ...actual,
                    diasAnuales: event.target.value,
                  }))
                }
              />
              <span className="text-sm text-slate-500">
                {esDiasAnoAnterior(editandoCodigo ?? form.codigo)
                  ? 'Este cupo se llena el 31 de diciembre a las 23:59 con los días no gastados.'
                  : 'Ej. 6 en Asuntos propios. 0 = sin tope anual (no pasa a Días del Año Anterior).'}
              </span>
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

export function PermisosPage() {
  const { alert: showAlert, confirm: askConfirm } = useAppDialog()
  const { puedeEscribir } = useAcceso()
  const soloLectura = !puedeEscribir('permisos')
  const [permisos, setPermisos] = useTiposPermiso()
  const [modo, setModo] = useState<'nuevo' | 'editar' | null>(null)
  const [editando, setEditando] = useState<PermisoConfig | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firebaseOk = isFirebaseReady()

  async function guardar(permiso: PermisoConfig) {
    if (soloLectura) return
    if (!firebaseOk) {
      await showAlert('Firebase no está configurado; no se puede guardar.', 'Firebase')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const previo = permisos.find((item) => item.codigo === permiso.codigo)
      const guardado = await saveTipoPermiso({
        ...permiso,
        visible: previo ? previo.visible !== false : permiso.visible !== false,
      })
      if (modo === 'nuevo') {
        setPermisos((actual) => [...actual, guardado])
      } else if (editando) {
        setPermisos((actual) =>
          actual.map((item) =>
            item.codigo === editando.codigo ? guardado : item,
          ),
        )
      }
      setModo(null)
      setEditando(null)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo guardar el tipo de permiso'
      setError(mensaje)
      await showAlert(mensaje, 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function cambiarVisible(permiso: PermisoConfig, visible: boolean) {
    if (soloLectura) return
    const siguiente = { ...permiso, visible }
    setPermisos((actual) =>
      actual.map((item) => (item.codigo === permiso.codigo ? siguiente : item)),
    )
    if (!firebaseOk) return
    setGuardando(true)
    setError(null)
    try {
      const guardado = await saveTipoPermiso(siguiente)
      setPermisos((actual) =>
        actual.map((item) => (item.codigo === guardado.codigo ? guardado : item)),
      )
    } catch (err) {
      setPermisos((actual) =>
        actual.map((item) => (item.codigo === permiso.codigo ? permiso : item)),
      )
      const mensaje =
        err instanceof Error ? err.message : 'No se pudo cambiar la visibilidad'
      setError(mensaje)
      await showAlert(mensaje, 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(permiso: PermisoConfig) {
    if (soloLectura) return
    if (esDiasAnoAnterior(permiso.codigo)) {
      await showAlert(
        '«Días del Año Anterior» es un tipo de sistema: el 31 de diciembre a las 23:59 recibe el saldo no gastado.',
        'No se puede eliminar',
      )
      return
    }
    const ok = await askConfirm(
      `¿Eliminar el permiso «${permiso.nombre}»?`,
      'Eliminar permiso',
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
      await deleteTipoPermiso(permiso.codigo)
      setPermisos((actual) =>
        actual.filter((item) => item.codigo !== permiso.codigo),
      )
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el tipo de permiso'
      setError(mensaje)
      await showAlert(mensaje, 'Error al eliminar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Permisos"
        subtitle={`${permisos.length} tipos · solo los visibles salen en la lista del agente`}
        actions={
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={soloLectura || !firebaseOk || guardando}
            onClick={() => {
              setEditando(null)
              setModo('nuevo')
            }}
          >
            Nuevo permiso
          </button>
        }
      />

      {soloLectura ? <AvisoSoloLectura /> : null}
      {error ? <p className={ALERT_ERROR}>{error}</p> : null}

      <DashboardBody>
        <DashboardMain>
          <DashboardMainScroll className="p-1.5">
            <table className={TABLE}>
              <thead className="sticky top-0 z-10 bg-slate-50">
                <tr>
                  <th className={TH}>Nombre</th>
                  <th className={TH}>Código</th>
                  <th className={TH}>Abrev.</th>
                  <th className={`${TH} text-right`}>Días/año</th>
                  <th className={TH}>Visible</th>
                  <th className={`${TH} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {permisos.map((permiso) => (
                  <tr key={permiso.codigo} className="hover:bg-slate-50/70">
                    <td className={`${TD} font-medium`}>{permiso.nombre}</td>
                    <td className={`${TD} font-mono text-slate-600`}>
                      {permiso.codigo}
                    </td>
                    <td className={`${TD} font-mono text-slate-600`}>
                      {permiso.abreviatura}
                    </td>
                    <td className={`${TD} text-right tabular-nums text-slate-600`}>
                      {esDiasAnoAnterior(permiso.codigo)
                        ? 'Cierre'
                        : diasAnualesCatalogo(permiso) === 0
                          ? 'Sin tope'
                          : diasAnualesCatalogo(permiso)}
                    </td>
                    <td className={TD}>
                      <input
                        type="checkbox"
                        className="h-4 w-4 accent-slate-950"
                        checked={permiso.visible !== false}
                        disabled={soloLectura || guardando}
                        aria-label={`Visible para agentes: ${permiso.nombre}`}
                        onChange={(event) =>
                          void cambiarVisible(permiso, event.target.checked)
                        }
                      />
                    </td>
                    <td className={`${TD} text-right`}>
                      <button
                        type="button"
                        className="mr-1.5 text-sm font-semibold text-slate-700 hover:underline disabled:opacity-40"
                        disabled={soloLectura || guardando}
                        onClick={() => {
                          setEditando(permiso)
                          setModo('editar')
                        }}
                      >
                        Editar
                      </button>
                      <button
                        type="button"
                        className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-40"
                        disabled={soloLectura || guardando || esDiasAnoAnterior(permiso.codigo)}
                        onClick={() => void borrar(permiso)}
                      >
                        Eliminar
                      </button>
                    </td>
                  </tr>
                ))}
                {permisos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={5}
                      className={`${TD} py-6 text-center text-slate-500`}
                    >
                      No hay tipos de permiso. Crea Asuntos propios, IT, etc.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </DashboardMainScroll>
        </DashboardMain>
        <DashboardSidebar>
          <KpiGrid2>
            <KpiCard icon={FileText} label="Tipos" value={permisos.length} />
            <KpiCard
              icon={Hash}
              label="Abrev. media"
              value={
                permisos.length === 0
                  ? '0'
                  : (
                      permisos.reduce(
                        (s, p) => s + p.abreviatura.length,
                        0,
                      ) / permisos.length
                    ).toFixed(1)
              }
            />
          </KpiGrid2>
        </DashboardSidebar>
      </DashboardBody>

      {modo === 'nuevo' ? (
        <EditorModal
          titulo="Nuevo permiso"
          inicial={formularioVacio()}
          editandoCodigo={null}
          permisos={permisos}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={() => setModo(null)}
        />
      ) : null}
      {modo === 'editar' && editando ? (
        <EditorModal
          titulo="Editar permiso"
          inicial={formularioDesde(editando)}
          editandoCodigo={editando.codigo}
          permisos={permisos}
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
