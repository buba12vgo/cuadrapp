import { useEffect, useMemo, useState } from 'react'
import { FileText } from 'lucide-react'
import { iniciarArrastrePuesto } from '@/lib/asignacionPuestos'
import { useTiposPermiso } from '@/lib/permisosStore'
import { BLOQUE, TITULO_BLOQUE } from '@/lib/uiStyles'

const CLASE_PASTILLA =
  'cursor-grab rounded-lg border border-rose-200 bg-rose-50 px-1.5 py-0.5 text-sm font-bold text-rose-900 shadow-card active:cursor-grabbing hover:border-rose-300 hover:bg-white'

const CLASE_PASTILLA_SELECCIONADA =
  'cursor-grab rounded-lg border border-rose-500 bg-rose-100 px-1.5 py-0.5 text-sm font-bold text-rose-950 shadow-card ring-2 ring-rose-400 active:cursor-grabbing'

export function BolsaPermisosPanel({
  permisoSeleccionado = null,
  onSeleccionarPermiso,
}: {
  permisoSeleccionado?: string | null
  onSeleccionarPermiso?: (permiso: string | null) => void
}) {
  const [permisos] = useTiposPermiso()
  const [ocultos, setOcultos] = useState<Set<string>>(() => new Set())

  const visibles = useMemo(
    () => permisos.filter((permiso) => !ocultos.has(permiso.codigo)),
    [permisos, ocultos],
  )
  const escondidos = useMemo(
    () => permisos.filter((permiso) => ocultos.has(permiso.codigo)),
    [permisos, ocultos],
  )

  useEffect(() => {
    if (
      permisoSeleccionado &&
      !permisos.some((permiso) => permiso.nombre === permisoSeleccionado)
    ) {
      onSeleccionarPermiso?.(null)
    }
  }, [permisoSeleccionado, permisos, onSeleccionarPermiso])

  function alternar(codigo: string) {
    setOcultos((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(codigo)) siguiente.delete(codigo)
      else siguiente.add(codigo)
      return siguiente
    })
  }

  function clicPermiso(nombre: string) {
    if (!onSeleccionarPermiso) return
    onSeleccionarPermiso(permisoSeleccionado === nombre ? null : nombre)
  }

  return (
    <div className={BLOQUE}>
      <div className={`${TITULO_BLOQUE} mb-1 flex items-center gap-1`}>
        <FileText className="h-2.5 w-2.5" />
        Bolsa · Permisos
      </div>
      <p className="mb-1.5 text-sm leading-tight text-slate-500">
        Arrastra o selecciona y pulsa una celda P.
      </p>
      <ul className="flex max-h-44 flex-col gap-1 overflow-auto">
        {visibles.map((permiso) => {
          const seleccionado = permisoSeleccionado === permiso.nombre
          return (
            <li key={permiso.codigo} className="flex items-start gap-1">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked
                aria-label={`Ocultar ${permiso.nombre}`}
                onChange={() => alternar(permiso.codigo)}
              />
              <button
                type="button"
                draggable
                className={`${
                  seleccionado ? CLASE_PASTILLA_SELECCIONADA : CLASE_PASTILLA
                } min-w-0 flex-1 text-left`}
                title={permiso.nombre}
                aria-pressed={seleccionado}
                onClick={() => clicPermiso(permiso.nombre)}
                onDragStart={(event) =>
                  iniciarArrastrePuesto(event, permiso.nombre)
                }
              >
                <span className="font-mono">{permiso.abreviatura}</span>
                <span className="mt-0.5 block truncate font-normal text-rose-800/80">
                  {permiso.nombre}
                </span>
              </button>
            </li>
          )
        })}
        {visibles.length === 0 ? (
          <li className="text-sm text-slate-500">
            No hay tipos de permiso. Créalos en Permisos.
          </li>
        ) : null}
        {escondidos.length > 0 ? (
          <li className="mt-1 border-t border-slate-100 pt-1">
            <p className="mb-0.5 text-sm font-bold uppercase text-slate-500">
              Ocultos
            </p>
            <ul className="flex flex-col gap-0.5">
              {escondidos.map((permiso) => (
                <li key={permiso.codigo}>
                  <label className="flex cursor-pointer items-center gap-1 text-sm text-slate-500">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => alternar(permiso.codigo)}
                    />
                    <span className="font-mono">{permiso.abreviatura}</span>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </div>
  )
}
