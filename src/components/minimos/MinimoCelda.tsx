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
      className={`group/celda flex items-center justify-center rounded-lg border px-0.5 py-0.5 transition-colors ${
        activo
          ? 'border-sky-200 bg-sky-50/90 hover:border-sky-300'
          : 'border-slate-200 bg-slate-50/80 hover:border-slate-300'
      }`}
    >
      <button
        type="button"
        className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-700 group-hover/celda:opacity-100 disabled:opacity-0"
        aria-label={`Reducir ${etiqueta}`}
        disabled={valor <= 0}
        onClick={() => onCambiar(Math.max(0, valor - 1))}
      >
        <Minus className="h-3 w-3" strokeWidth={2.5} />
      </button>
      <input
        type="number"
        min={0}
        max={99}
        aria-label={etiqueta}
        value={valor}
        onChange={(event) => onCambiar(leerNumero(event.target.value))}
        className={`h-8 w-9 bg-transparent text-center text-sm font-semibold tabular-nums outline-none ${
          activo ? 'text-sky-900' : 'text-slate-400'
        }`}
      />
      <button
        type="button"
        className="flex h-7 w-5 shrink-0 items-center justify-center rounded text-slate-400 opacity-0 transition hover:bg-white hover:text-slate-700 group-hover/celda:opacity-100 disabled:opacity-0"
        aria-label={`Aumentar ${etiqueta}`}
        disabled={valor >= 99}
        onClick={() => onCambiar(Math.min(99, valor + 1))}
      >
        <Plus className="h-3 w-3" strokeWidth={2.5} />
      </button>
    </div>
  )
}
