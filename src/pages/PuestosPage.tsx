import { useEffect, useState } from 'react'
import {
  normalizarCodigo,
  sugerirAbreviatura,
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

const CAMPO =
  'h-8 w-full border border-slate-300 bg-white px-2 text-sm text-slate-900 outline-none focus:border-slate-700'
const BLOQUE = 'border border-slate-200 bg-white p-3'
const TITULO_BLOQUE =
  'mb-2 text-[11px] font-bold tracking-wide text-slate-500 uppercase'

type FormularioPuesto = {
  codigo: string
  nombre: string
  abreviatura: string
}

function formularioVacio(): FormularioPuesto {
  return { codigo: '', nombre: '', abreviatura: '' }
}

function formularioDesde(puesto: PuestoConfig): FormularioPuesto {
  return {
    codigo: puesto.codigo,
    nombre: puesto.nombre,
    abreviatura: puesto.abreviatura,
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
        aria-labelledby="puesto-titulo"
        className="w-full max-w-md border border-slate-300 bg-slate-50 shadow-xl"
        onClick={(event) => event.stopPropagation()}
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
          })
        }}
      >
        <header className="border-b border-slate-200 bg-white px-4 py-3">
          <h2 id="puesto-titulo" className="text-sm font-bold text-slate-900">
            {titulo}
          </h2>
          <p className="text-xs text-slate-500">
            {editandoCodigo == null
              ? 'Al crearlo se activa automáticamente para toda la plantilla.'
              : 'Nombre, código y abreviatura del puesto operativo'}
          </p>
        </header>

        <div className="flex flex-col gap-3 p-4">
          <section className={BLOQUE}>
            <h3 className={TITULO_BLOQUE}>Datos del puesto</h3>
            <div className="flex flex-col gap-2">
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Nombre
                </span>
                <input
                  className={CAMPO}
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
                <span className="text-[11px] font-semibold text-slate-600">
                  Código
                </span>
                <input
                  className={CAMPO}
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
                <span className="text-[10px] text-slate-500">
                  Identificador estable (exclusiones de agentes). No se puede
                  cambiar al editar.
                </span>
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-[11px] font-semibold text-slate-600">
                  Abreviatura
                </span>
                <input
                  className={CAMPO}
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
            <p className="border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
              {error}
            </p>
          ) : null}
        </div>

        <footer className="flex justify-end gap-2 border-t border-slate-200 bg-white px-4 py-3">
          <button
            type="button"
            className="h-8 px-3 text-xs font-semibold text-slate-600 hover:bg-slate-100"
            disabled={guardando}
            onClick={onCancelar}
          >
            Cancelar
          </button>
          <button
            type="submit"
            className="h-8 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
            disabled={guardando}
          >
            {guardando ? 'Guardando…' : 'Guardar puesto'}
          </button>
        </footer>
      </form>
    </div>
  )
}

export function PuestosPage() {
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
      window.alert('Firebase no está configurado; no se puede guardar.')
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
      window.alert(mensaje)
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
    const ok = window.confirm(
      `¿Eliminar el puesto «${puesto.nombre}»? Se quitará de los mínimos configurados.`,
    )
    if (!ok) return
    if (!firebaseOk) {
      window.alert('Firebase no está configurado; no se puede eliminar.')
      return
    }

    setGuardando(true)
    setError(null)
    try {
      await deletePuesto(puesto.codigo)
      const lista = puestos.filter((item) => item.codigo !== puesto.codigo)
      setPuestos(lista)
      await persistirMinimosTrasCambioPuestos(lista)
      await limpiarExclusionesDelPuesto(puesto)
    } catch (err) {
      const mensaje =
        err instanceof Error
          ? err.message
          : 'No se pudo eliminar el puesto en Firestore'
      setError(mensaje)
      window.alert(mensaje)
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className="flex h-full min-h-0 flex-col gap-2">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1">
        <div>
          <h1 className="text-sm font-bold text-slate-900">Puestos</h1>
          <p className="text-[11px] text-slate-500">
            Configura los puestos operativos · {puestos.length} puestos · un
            puesto nuevo queda activo en toda la plantilla · Firestore
          </p>
        </div>
        <button
          type="button"
          className="h-8 bg-slate-900 px-3 text-xs font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
          disabled={!firebaseOk || guardando}
          onClick={abrirNuevo}
        >
          Nuevo puesto
        </button>
      </div>

      {error ? (
        <p className="border border-red-200 bg-red-50 px-2 py-1.5 text-xs text-red-800">
          {error}
        </p>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto border border-slate-300 bg-white">
        <table className="w-full border-collapse text-xs">
          <thead>
            <tr className="bg-slate-50 text-slate-600">
              <th className="border border-slate-200 px-3 py-2 text-left font-semibold">
                Nombre
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left font-semibold">
                Código
              </th>
              <th className="border border-slate-200 px-3 py-2 text-left font-semibold">
                Abrev.
              </th>
              <th className="border border-slate-200 px-3 py-2 text-right font-semibold">
                Acciones
              </th>
            </tr>
          </thead>
          <tbody>
            {puestos.map((puesto) => (
              <tr key={puesto.codigo} className="hover:bg-slate-50">
                <td className="border border-slate-200 px-3 py-2 font-medium text-slate-800">
                  {puesto.nombre}
                </td>
                <td className="border border-slate-200 px-3 py-2 font-mono text-slate-700">
                  {puesto.codigo}
                </td>
                <td className="border border-slate-200 px-3 py-2 font-mono text-slate-700">
                  {puesto.abreviatura}
                </td>
                <td className="border border-slate-200 px-3 py-2 text-right">
                  <button
                    type="button"
                    className="mr-2 text-xs font-semibold text-slate-700 hover:underline disabled:opacity-40"
                    disabled={guardando}
                    onClick={() => abrirEditar(puesto)}
                  >
                    Editar
                  </button>
                  <button
                    type="button"
                    className="text-xs font-semibold text-red-700 hover:underline disabled:opacity-40"
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
                <td
                  colSpan={4}
                  className="border border-slate-200 px-3 py-8 text-center text-slate-500"
                >
                  No hay puestos. Crea el primero para configurar mínimos.
                </td>
              </tr>
            ) : null}
          </tbody>
        </table>
      </div>

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
