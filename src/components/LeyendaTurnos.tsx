import { LEYENDA_TURNOS } from '@/lib/uiStyles'

/** Chips de turno alineados con las celdas de Stitch. Una sola línea, sin comer altura al mes. */
export function LeyendaTurnos({ className = '' }: { className?: string }) {
  return (
    <ul
      className={`flex shrink-0 flex-wrap items-center gap-1 px-2 py-1 text-[10px] leading-none text-muted ${className}`.trim()}
      aria-label="Leyenda de turnos"
    >
      {LEYENDA_TURNOS.map((item) => (
        <li key={item.clave} className="flex items-center gap-1">
          <span
            className={`inline-flex h-4 min-w-4 items-center justify-center rounded px-0.5 font-bold ${item.clase}`}
          >
            {item.clave}
          </span>
          <span>{item.label}</span>
        </li>
      ))}
      <li className="flex items-center gap-1">
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-emerald-50 px-0.5 font-bold text-emerald-900">
          ok
        </span>
        <span>cubierto</span>
      </li>
      <li className="flex items-center gap-1">
        <span className="inline-flex h-4 min-w-4 items-center justify-center rounded bg-rose-50 px-0.5 font-bold text-rose-800">
          no
        </span>
        <span>bajo mínimo</span>
      </li>
    </ul>
  )
}
