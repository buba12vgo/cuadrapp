import { useEffect, useRef } from 'react'
import {
  abreviaturaDesdePuestos,
  type PuestoBase,
} from '@/lib/calendarioPuestos'
import { getPuestos } from '@/lib/puestosStore'

export function PopoverPuestosCelda({
  rect,
  puestos,
  onElegir,
  onCerrar,
}: {
  rect: DOMRect
  puestos: PuestoBase[]
  onElegir: (puesto: PuestoBase) => void
  onCerrar: () => void
}) {
  const ref = useRef<HTMLDivElement>(null)
  const catalogo = getPuestos()

  useEffect(() => {
    function onPointer(event: MouseEvent) {
      if (ref.current && !ref.current.contains(event.target as Node)) {
        onCerrar()
      }
    }
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onCerrar()
    }
    window.addEventListener('mousedown', onPointer)
    window.addEventListener('keydown', onKey)
    return () => {
      window.removeEventListener('mousedown', onPointer)
      window.removeEventListener('keydown', onKey)
    }
  }, [onCerrar])

  const top = Math.min(rect.bottom + 4, window.innerHeight - 140)
  const left = Math.min(rect.left, window.innerWidth - 160)

  return (
    <div
      ref={ref}
      className="fixed z-[80] min-w-[140px] border border-slate-400 bg-white py-1 shadow-lg"
      style={{ top, left }}
      role="menu"
    >
      <p className="border-b border-slate-200 px-2 py-1 text-[9px] font-semibold text-slate-500">
        Asignar puesto
      </p>
      {puestos.length === 0 ? (
        <p className="px-2 py-2 text-[10px] text-slate-500">
          Sin puestos permitidos
        </p>
      ) : (
        puestos.map((puesto) => (
          <button
            key={puesto}
            type="button"
            role="menuitem"
            className="block w-full px-2 py-1 text-left text-[10px] font-semibold text-slate-800 hover:bg-slate-100"
            onClick={() => {
              onElegir(puesto)
              onCerrar()
            }}
          >
            <span className="font-mono">
              {abreviaturaDesdePuestos(catalogo, puesto)}
            </span>{' '}
            · {puesto}
          </button>
        ))
      )}
    </div>
  )
}
