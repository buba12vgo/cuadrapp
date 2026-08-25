import {
  ABREV_PUESTO,
  PUESTOS_BASE,
} from '@/lib/calendarioPuestos'
import { iniciarArrastrePuesto } from '@/lib/asignacionPuestos'

const CLASE_PASTILLA =
  'cursor-grab border border-slate-400 bg-slate-100 px-2 py-1.5 text-[10px] font-bold text-slate-800 shadow-sm active:cursor-grabbing hover:bg-slate-200 hover:ring-2 hover:ring-slate-500'

export function BolsaPuestosPanel() {
  return (
    <aside className="flex w-28 shrink-0 flex-col border-l border-slate-500 bg-slate-50">
      <h2 className="border-b border-slate-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
        Bolsa de puestos
      </h2>
      <p className="border-b border-slate-200 px-2 py-1 text-[9px] leading-tight text-slate-500">
        Arrastra a cabecera (mes) o celda (día)
      </p>
      <ul className="flex flex-col gap-1.5 p-2">
        {PUESTOS_BASE.map((puesto) => (
          <li key={puesto}>
            <button
              type="button"
              draggable
              className={`${CLASE_PASTILLA} w-full text-left`}
              title={puesto}
              onDragStart={(event) => iniciarArrastrePuesto(event, puesto)}
            >
              <span className="font-mono">{ABREV_PUESTO[puesto]}</span>
              <span className="mt-0.5 block truncate font-normal text-slate-600">
                {puesto}
              </span>
            </button>
          </li>
        ))}
      </ul>
    </aside>
  )
}
