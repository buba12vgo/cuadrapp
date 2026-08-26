import { iniciarArrastrePuesto } from '@/lib/asignacionPuestos'
import { usePuestosData } from '@/lib/puestosStore'

const CLASE_PASTILLA =
  'cursor-grab border border-slate-400 bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-800 shadow-sm active:cursor-grabbing hover:bg-slate-200 hover:ring-2 hover:ring-slate-500'

export function BolsaPuestosPanel() {
  const [puestos] = usePuestosData()

  return (
    <aside className="flex w-28 shrink-0 flex-col border-l border-slate-500 bg-slate-50">
      <h2 className="border-b border-slate-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
        Bolsa de puestos
      </h2>
      <p className="border-b border-slate-200 px-2 py-1 text-[9px] leading-tight text-slate-500">
        Arrastra a cabecera (mes) o celda (día)
      </p>
      <ul className="flex flex-col gap-1.5 p-2">
        {puestos.map((puesto) => (
          <li key={puesto.codigo}>
            <button
              type="button"
              draggable
              className={`${CLASE_PASTILLA} w-full text-left`}
              title={puesto.nombre}
              onDragStart={(event) =>
                iniciarArrastrePuesto(event, puesto.nombre)
              }
            >
              <span className="font-mono">{puesto.abreviatura}</span>
              <span className="mt-0.5 block truncate font-normal text-slate-600">
                {puesto.nombre}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
