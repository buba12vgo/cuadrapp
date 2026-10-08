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
import { deleteTipoEvento, saveTipoEvento } from '@/lib/db'
import { isFirebaseReady } from '@/lib/firebase'
import {
  ESTILOS_TIPO_EVENTO,
  estiloTipoEvento,
  tipoEventoEsSistema,
  type TipoEventoConfig,
} from '@/lib/tiposEvento'
import { useTiposEvento } from '@/lib/tiposEventoStore'
import { CalendarDays, Flag } from 'lucide-react'

const CAMPO_FULL = `${CAMPO} w-full`

type Formulario = {
  codigo: string
  nombre: string
  abreviatura: string
  estiloId: string
  esFestivo: boolean
  orden: string
}

function formularioVacio(orden: number): Formulario {
  return {
    codigo: '',
    nombre: '',
    abreviatura: '',
    estiloId: 'violeta',
    esFestivo: false,
    orden: String(orden),
  }
}

function formularioDesde(tipo: TipoEventoConfig): Formulario {
  return {
    codigo: tipo.codigo,
    nombre: tipo.nombre,
    abreviatura: tipo.abreviatura,
    estiloId: tipo.estiloId,
    esFestivo: tipo.esFestivo,
    orden: String(tipo.orden),
  }
}

function validar(
  form: Formulario,
  tipos: TipoEventoConfig[],
  editandoCodigo: string | null,
): string | null {
  const nombre = form.nombre.trim()
  const codigo = normalizarCodigo(form.codigo || form.nombre)
  const abreviatura = form.abreviatura.trim().toUpperCase()
  const orden = Number(form.orden)

  if (!nombre) return 'El nombre es obligatorio'
  if (!codigo) return 'El código es obligatorio'
  if (!abreviatura) return 'La abreviatura es obligatoria'
  if (abreviatura.length > 5) return 'La abreviatura máximo 5 caracteres'
  if (!Number.isInteger(orden) || orden < 0 || orden > 999) {
    return 'El orden tiene que ser un número entero entre 0 y 999'
  }
  if (
    tipos.some(
      (item) =>
        item.nombre.toLowerCase() === nombre.toLowerCase() &&
        item.codigo !== editandoCodigo,
    )
  ) {
    return 'Ya existe un tipo de evento con ese nombre'
  }
  if (tipos.some((item) => item.codigo === codigo && item.codigo !== editandoCodigo)) {
    return 'Ya existe un tipo de evento con ese código'
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
  const [abrevManual, setAbrevManual] = useState(Boolean(inicial.abreviatura))

  useEffect(() => {
    setForm(inicial)
    setError(null)
    setCodigoManual(Boolean(inicial.codigo))
    setAbrevManual(Boolean(inicial.abreviatura))
  }, [inicial])

  const estilo = estiloTipoEvento(form.estiloId)

  return (
    <Modal
      title={titulo}
      subtitle="Catálogo de tipos para el calendario de eventos."
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
          const previo = tipos.find((item) => item.codigo === editandoCodigo)
          await onGuardar({
            codigo: normalizarCodigo(form.codigo || form.nombre),
            nombre: form.nombre.trim(),
            abreviatura: form.abreviatura.trim().toUpperCase(),
            estiloId: form.estiloId,
            esFestivo: form.esFestivo,
            visible: previo ? previo.visible !== false : true,
            orden: Number(form.orden),
            sistema: previo ? tipoEventoEsSistema(previo) : false,
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
                    abreviatura: abrevManual
                      ? actual.abreviatura
                      : sugerirAbreviatura(nombre),
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
              <span className="text-sm font-semibold text-slate-600">Estilo</span>
              <select
                className={CAMPO_FULL}
                value={form.estiloId}
                onChange={(event) =>
                  setForm((actual) => ({
                    ...actual,
                    estiloId: event.target.value,
                  }))
                }
              >
                {ESTILOS_TIPO_EVENTO.map((item) => (
                  <option key={item.id} value={item.id}>
                    {item.emoji} {item.etiqueta}
                  </option>
                ))}
              </select>
              <span className={`mt-1 inline-flex w-fit rounded px-1.5 py-0.5 text-xs font-semibold ${estilo.clase}`}>
                {estilo.emoji} {form.nombre.trim() || 'Vista previa'}
              </span>
            </label>
            <label className="flex flex-col gap-0.5">
              <span className="text-sm font-semibold text-slate-600">Orden</span>
              <input
                className={CAMPO_FULL}
                type="number"
                min={0}
                max={999}
                value={form.orden}
                onChange={(event) =>
                  setForm((actual) => ({ ...actual, orden: event.target.value }))
                }
              />
            </label>
            <label className="flex items-start gap-2 text-sm text-slate-800">
              <input
                type="checkbox"
                className="mt-0.5 h-4 w-4 accent-slate-950"
                checked={form.esFestivo}
                onChange={(event) =>
                  setForm((actual) => ({
                    ...actual,
                    esFestivo: event.target.checked,
                  }))
                }
              />
              <span>
                <span className="font-semibold">Festivo</span>
                <span className="mt-0.5 block text-slate-500">
                  Cuenta como festivo para cobro, conciliaciones compatibles y
                  turno M/T de jefes, igual que un festivo oficial.
                </span>
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

  async function guardar(tipo: TipoEventoConfig) {
    if (soloLectura) return
    if (!firebaseOk) {
      await showAlert('Firebase no está configurado; no se puede guardar.', 'Firebase')
      return
    }
    setGuardando(true)
    setError(null)
    try {
      const guardado = await saveTipoEvento(tipo)
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
    if (tipoEventoEsSistema(tipo)) {
      await showAlert(
        `«${tipo.nombre}» es un tipo de sistema y no se puede eliminar.`,
        'No se puede eliminar',
      )
      return
    }
    const ok = await askConfirm(
      `¿Eliminar el tipo de evento «${tipo.nombre}»?`,
      'Eliminar tipo',
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
      await deleteTipoEvento(tipo.codigo)
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

  const siguienteOrden =
    tipos.reduce((max, tipo) => Math.max(max, tipo.orden), 0) + 1
  const festivos = tipos.filter((tipo) => tipo.esFestivo).length

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Tipos de evento"
        subtitle={`${tipos.length} tipos · los marcados como festivo aplican cobro, conciliaciones y M/T de jefes`}
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
                  <th className={TH}>Abrev.</th>
                  <th className={TH}>Festivo</th>
                  <th className={`${TH} text-right`}>Orden</th>
                  <th className={`${TH} text-right`}>Acciones</th>
                </tr>
              </thead>
              <tbody>
                {tipos.map((tipo) => {
                  const estilo = estiloTipoEvento(tipo.estiloId)
                  return (
                    <tr key={tipo.codigo} className="hover:bg-slate-50/70">
                      <td className={`${TD} font-medium`}>
                        <span className={`inline-flex rounded px-1.5 py-0.5 text-xs font-semibold ${estilo.clase}`}>
                          {estilo.emoji} {tipo.nombre}
                        </span>
                      </td>
                      <td className={`${TD} font-mono text-slate-600`}>
                        {tipo.codigo}
                      </td>
                      <td className={`${TD} font-mono text-slate-600`}>
                        {tipo.abreviatura}
                      </td>
                      <td className={TD}>{tipo.esFestivo ? 'Sí' : 'No'}</td>
                      <td className={`${TD} text-right tabular-nums text-slate-600`}>
                        {tipo.orden}
                      </td>
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
                            tipoEventoEsSistema(tipo)
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
                      colSpan={6}
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
            <KpiCard icon={Flag} label="Festivos" value={festivos} />
          </KpiGrid2>
        </DashboardSidebar>
      </DashboardBody>

      {modo === 'nuevo' ? (
        <EditorModal
          titulo="Nuevo tipo de evento"
          inicial={formularioVacio(siguienteOrden)}
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
