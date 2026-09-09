import { ChevronDown } from 'lucide-react'
import { useState, type ReactNode } from 'react'

type Tone = 'info' | 'success' | 'warn' | 'error'

const TONE_CLASS: Record<Tone, string> = {
  info: 'border-line bg-brand-50/50 text-slate-700',
  success: 'border-emerald-200 bg-emerald-50 text-emerald-900',
  warn: 'border-amber-200 bg-amber-50 text-amber-950',
  error: 'border-red-200 bg-red-50 text-red-800',
}

type Props = {
  summary: string
  tone?: Tone
  defaultOpen?: boolean
  children?: ReactNode
}

/** Aviso largo plegable: una línea cuando está cerrado, detalle al expandir. */
export function CollapsibleNotice({
  summary,
  tone = 'info',
  defaultOpen = false,
  children,
}: Props) {
  const [open, setOpen] = useState(defaultOpen)
  const expandable = Boolean(children)

  return (
    <div
      className={`shrink-0 rounded-xl border px-3 py-2 text-sm ${TONE_CLASS[tone]}`}
    >
      <div className="flex items-start gap-1.5">
        <p className="min-w-0 flex-1 leading-snug">{summary}</p>
        {expandable ? (
          <button
            type="button"
            className="inline-flex shrink-0 items-center gap-0.5 rounded px-1 py-0.5 text-sm font-semibold uppercase tracking-wide opacity-80 hover:opacity-100"
            aria-expanded={open}
            onClick={() => setOpen((actual) => !actual)}
          >
            {open ? 'Menos' : 'Más'}
            <ChevronDown
              className={`h-3 w-3 transition-transform ${open ? 'rotate-180' : ''}`}
              aria-hidden
            />
          </button>
        ) : null}
      </div>
      {expandable && open ? (
        <div className="mt-1.5 space-y-1 border-t border-current/10 pt-1.5 leading-snug">
          {children}
        </div>
      ) : null}
    </div>
  )
}
