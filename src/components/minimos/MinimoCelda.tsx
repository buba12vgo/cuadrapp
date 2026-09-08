import { Minus, Plus } from 'lucide-react'

type Props = {
  valor: number
  etiqueta: string
  onCambiar: (valor: number) => void
}

function leerNumero(valor: string) {
  const n = Number(valor)
  if (!Number.isFinite(n)) return 0
  return Math.min(99, Math.max(0, Math.round(n)))
}

export function MinimoCelda({ valor, etiqueta, onCambiar }: Props) {
  const activo = valor > 0

  return (
    <div
      className={`group/celda relative mx-auto flex h-4 w-[1.35rem] items-center justify-center rounded-sm border transition-colors ${
        activo
          ? 'border-sky-200/80 bg-sky-50/80 hover:border-sky-300'
          : 'border-slate-200/80 bg-slate-50/60 hover:border-slate-300'
      }`}
    >
      <button
        type="button"
        className="absolute -left-2 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition hover:text-slate-800 group-hover/celda:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        aria-label={`Reducir ${etiqueta}`}
        disabled={valor <= 0}
        onClick={() => onCambiar(Math.max(0, valor - 1))}
      >
        <Minus className="h-2.5 w-2.5" strokeWidth={2.5} />
      </button>
      <input
        type="number"
        min={0}
        max={99}
        aria-label={etiqueta}
        value={valor}
        onChange={(event) => onCambiar(leerNumero(event.target.value))}
        className={`h-full w-full bg-transparent text-center text-sm font-semibold tabular-nums outline-none [appearance:textfield] [&::-webkit-inner-spin-button]:appearance-none [&::-webkit-outer-spin-button]:appearance-none ${
          activo ? 'text-sky-900' : 'text-slate-400'
        }`}
      />
      <button
        type="button"
        className="absolute -right-2 z-10 flex h-3.5 w-3.5 items-center justify-center rounded-full border border-slate-200 bg-white text-slate-500 opacity-0 shadow-sm transition hover:text-slate-800 group-hover/celda:opacity-100 disabled:pointer-events-none disabled:opacity-0"
        aria-label={`Aumentar ${etiqueta}`}
        disabled={valor >= 99}
        onClick={() => onCambiar(Math.min(99, valor + 1))}
      >
        <Plus className="h-2.5 w-2.5" strokeWidth={2.5} />
      </button>
    </div>
  )
}
