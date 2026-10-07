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
import { normalizarCodigo } from '@/lib/calendarioPuestos'
import { deleteTipoEvento, saveTipoEvento } from '@/lib/db'
import { isDesignPreview } from '@/lib/designPreview'
import { isFirebaseReady } from '@/lib/firebase'
import {
  COLORES_TIPO_EVENTO,
  colorTipoEvento,
  esTipoEventoSistema,
  estiloTipoEvento,
  type ColorTipoEvento,
  type TipoEventoConfig,
} from '@/lib/tiposEvento'
import { useTiposEvento } from '@/lib/tiposEventoStore'
import { CalendarDays, Hash } from 'lucide-react'

const CAMPO_FULL = `${CAMPO} w-full`

type Formulario = {
  codigo: string
  nombre: string
  emoji: string
  color: ColorTipoEvento
}

function formularioVacio(): Formulario {
  return {
    codigo: '',
    nombre: '',
    emoji: '',
    color: 'slate',
  }
}

function formularioDesde(tipo: TipoEventoConfig): Formulario {
  return {
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    emoji: tipo.emoji,
    color: colorTipoEvento(tipo.color),
  }
}

function validar(
  form: Formulario,
  tipos: TipoEventoConfig[],
  editandoCodigo: string | null,
): string | null {
  const nombre = form.nombre.trim()
  const codigo = normalizarCodigo(form.codigo || form.nombre)
  if (!nombre) return 'El nombre es obligatorio'
  if (!codigo) return 'El código es obligatorio'
  if (
    tipos.some(
      (tipo) =>
        tipo.nombre.toLowerCase() === nombre.toLowerCase() &&
        tipo.codigo !== editandoCodigo,
    )
  ) {
    return 'Ya existe un tipo con ese nombre'
  }
  if (tipos.some((tipo) => tipo.codigo === codigo && tipo.codigo !== editandoCodigo)) {
    return 'Ya existe un tipo con ese código'
  }
  return null
}

function EditorModal({
  titulo,
  inicial,
  editandoCodigo,
  tipos,
  guardando,
  onGuardar,
  onCancelar,
}: {
  titulo: string
  inicial: Formulario
  editandoCodigo: string | null
  tipos: TipoEventoConfig[]
  guardando?: boolean
  onGuardar: (tipo: TipoEventoConfig) => void | Promise<void>
  onCancelar: () => void
}) {
  const [form, setForm] = useState(inicial)
  const [error, setError] = useState<string | null>(null)
  const [codigoManual, setCodigoManual] = useState(Boolean(inicial.codigo))

  useEffect(() => {
    setForm(inicial)
    setError(null)
    setCodigoManual(Boolean(inicial.codigo))
  }, [inicial])

  const vista = estiloTipoEvento({
    codigo: form.codigo || 'NUEVO',
    nombre: form.nombre.trim() || 'Nuevo tipo',
    emoji: form.emoji,
    color: form.color,
  })

  return (
    <Modal
      title={titulo}
      subtitle="Tipos que salen en el calendario de eventos."
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
            form="tipo-evento-form"
            className={BTN_PRIMARY}
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar tipo'}
          </button>
        </>
      }
    >
      <form
        id="tipo-evento-form"
        className="flex flex-col gap-3"
        onSubmit={async (event) => {
          event.preventDefault()
          const fallo = validar(form, tipos, editandoCodigo)
          if (fallo) {
            setError(fallo)
            return
          }
          await onGuardar({
            codigo: normalizarCodigo(form.codigo || form.nombre),
            nombre: form.nombre.trim(),
            emoji: form.emoji.trim(),
            color: form.color,
            sistema: esTipoEventoSistema(editandoCodigo ?? form.codigo),
          })
        }}
      >
        <section className={BLOQUE}>
          <h3 className={TITULO_BLOQUE}>Datos del tipo</h3>
          <div className="flex flex-col gap-2">
            <label className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-600">Nombre</span>
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
                  }))
                }}
              />
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-600">Código</span>
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
              <span className="text-sm font-semibold text-slate-600">Emoji</span>
              <input
                className={CAMPO_FULL}
                value={form.emoji}
                maxLength={4}
                placeholder="🚢"
                onChange={(event) =>
                  setForm((actual) => ({
                    ...actual,
                    emoji: event.target.value,
                  }))
                }
              />
            </label>
            <fieldset className="flex flex-col gap-1">
              <legend className="text-sm font-semibold text-slate-600">Color</legend>
              <div className="flex flex-wrap gap-1.5">
                {(Object.keys(COLORES_TIPO_EVENTO) as ColorTipoEvento[]).map(
                  (color) => (
                    <label
                      key={color}
                      className={`flex cursor-pointer items-center gap-1 rounded-md border px-2 py-1 text-sm ${
                        form.color === color
                          ? 'border-slate-900 bg-slate-50'
                          : 'border-slate-200'
                      }`}
                    >
                      <input
                        type="radio"
                        className="sr-only"
                        name="color-tipo-evento"
                        checked={form.color === color}
                        onChange={() =>
                          setForm((actual) => ({ ...actual, color }))
                        }
                      />
                      <span
                        className={`inline-block h-3 w-3 rounded-full ${COLORES_TIPO_EVENTO[color].clase}`}
                        aria-hidden
                      />
                      {COLORES_TIPO_EVENTO[color].label}
                    </label>
                  ),
                )}
              </div>
            </fieldset>
            <p className="text-sm text-slate-500">Vista previa</p>
            <span
              className={`inline-flex w-fit rounded px-1.5 py-0.5 text-xs font-semibold ${vista.clase}`}
            >
              {vista.emoji ? `${vista.emoji} ` : ''}
              {vista.texto}
            </span>
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

export function TiposEventoPage() {
  const { alert: showAlert, confirm: askConfirm } = useAppDialog()
  const { puedeEscribir } = useAcceso()
  const soloLectura = !puedeEscribir('tipos-evento')
  const [tipos, setTipos] = useTiposEvento()
  const [modo, setModo] = useState<'nuevo' | 'editar' | null>(null)
  const [editando, setEditando] = useState<TipoEventoConfig | null>(null)
  const [guardando, setGuardando] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const firebaseOk = isFirebaseReady()
  const puedeGuardar = firebaseOk || isDesignPreview

  async function guardar(tipo: TipoEventoConfig) {
    if (soloLectura) return
    if (!puedeGuardar) {
      await showAlert('Firebase no está configurado; no se puede guardar.', 'Firebase')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const guardado = isDesignPreview ? tipo : await saveTipoEvento(tipo)
      if (modo === 'nuevo') {
        setTipos((actual) => [...actual, guardado])
      } else if (editando) {
        setTipos((actual) =>
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
          : 'No se pudo guardar el tipo de evento'
      setError(mensaje)
      await showAlert(mensaje, 'Error al guardar')
    } finally {
      setGuardando(false)
    }
  }

  async function borrar(tipo: TipoEventoConfig) {
    if (soloLectura) return
    if (esTipoEventoSistema(tipo.codigo)) {
      await showAlert(
        '«Mínimos especiales» es el tipo de sistema para un día normal con mínimos personalizados.',
        'No se puede eliminar',
      )
      return
    }
    const ok = await askConfirm(
      `¿Eliminar el tipo «${tipo.nombre}»? Los eventos que ya lo usen seguirán con ese código.`,
      'Eliminar tipo de evento',
      true,
    )
    if (!ok) return
    if (!puedeGuardar) {
      await showAlert('Firebase no está configurado; no se puede eliminar.', 'Firebase')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      if (!isDesignPreview) await deleteTipoEvento(tipo.codigo)
      setTipos((actual) => actual.filter((item) => item.codigo !== tipo.codigo))
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el tipo de evento'
      setError(mensaje)
      await showAlert(mensaje, 'Error al eliminar')
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Tipos de evento"
        subtitle={`${tipos.length} tipos · salen en el desplegable del calendario`}
        actions={
          <button
            type="button"
            className={BTN_PRIMARY}
            disabled={soloLectura || !puedeGuardar || guardando}
            onClick={() => {
              setEditando(null)
              setModo('nuevo')
            }}
          >
            Nuevo tipo
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
                  <th className={TH}>Color</th>
                  <th className={`${TH} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((tipo) => {
                  const estilo = estiloTipoEvento(tipo)
                  return (
                    <tr key={tipo.codigo} className="hover:bg-slate-50/70">
                      <td className={`${TD} font-medium`}>
                        <span
                          className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${estilo.clase}`}
                        >
                          {estilo.emoji ? `${estilo.emoji} ` : ''}
                          {estilo.texto}
                        </span>
                        {tipo.sistema ? (
                          <span className="ml-2 text-xs font-semibold uppercase tracking-wide text-slate-400">
                            Sistema
                          </span>
                        ) : null}
                      </td>
                      <td className={`${TD} font-mono text-slate-600`}>
                        {tipo.codigo}
                      </td>
                      <td className={TD}>{COLORES_TIPO_EVENTO[tipo.color].label}</td>
                      <td className={`${TD} text-right`}>
                        <button
                          type="button"
                          className="mr-1.5 text-sm font-semibold text-slate-700 hover:underline disabled:opacity-40"
                          disabled={soloLectura || guardando}
                          onClick={() => {
                            setEditando(tipo)
                            setModo('editar')
                          }}
                        >
                          Editar
                        </button>
                        <button
                          type="button"
                          className="text-sm font-semibold text-red-700 hover:underline disabled:opacity-40"
                          disabled={
                            soloLectura ||
                            guardando ||
                            esTipoEventoSistema(tipo.codigo)
                          }
                          onClick={() => void borrar(tipo)}
                        >
                          Eliminar
                        </button>
                      </td>
                    </tr>
                  )
                })}
                {tipos.length === 0 ? (
                  <tr>
                    <td
                      colSpan={4}
                      className={`${TD} py-6 text-center text-slate-500`}
                    >
                      No hay tipos de evento. Crea Festivo, Crucero, etc.
                    </td>
                  </tr>
                ) : null}
              </tbody>
            </table>
          </DashboardMainScroll>
        </DashboardMain>
        <DashboardSidebar>
          <KpiGrid2>
            <KpiCard icon={CalendarDays} label="Tipos" value={tipos.length} />
            <KpiCard
              icon={Hash}
              label="Editables"
              value={tipos.filter((tipo) => !tipo.sistema).length}
            />
          </KpiGrid2>
        </DashboardSidebar>
      </DashboardBody>

      {modo === 'nuevo' ? (
        <EditorModal
          titulo="Nuevo tipo de evento"
          inicial={formularioVacio()}
          editandoCodigo={null}
          tipos={tipos}
          guardando={guardando}
          onGuardar={guardar}
          onCancelar={() => setModo(null)}
        />
      ) : null}
      {modo === 'editar' && editando ? (
        <EditorModal
          titulo="Editar tipo de evento"
          inicial={formularioDesde(editando)}
          editandoCodigo={editando.codigo}
          tipos={tipos}
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
