import type { LucideIcon } from 'lucide-react'
import type { ReactNode } from 'react'
import { BLOQUE, TITULO_BLOQUE } from '@/lib/uiStyles'

export function KpiGrid2({ children }: { children: ReactNode }) {
  return <div className="grid grid-cols-2 gap-2">{children}</div>
}

type KpiCardProps = {
  icon?: LucideIcon
  label: string
  value: ReactNode
  hint?: string
}

export function KpiCard({ icon: Icon, label, value, hint }: KpiCardProps) {
  return (
    <div className={BLOQUE}>
      <div className={`${TITULO_BLOQUE} mb-1 flex items-center gap-1`}>
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </div>
      <p className="font-display text-xl font-bold tabular-nums leading-tight text-ink">
        {value}
      </p>
      {hint ? <p className="mt-0.5 text-xs text-muted">{hint}</p> : null}
    </div>
  )
}

type KpiHighlightProps = {
  variant: 'emerald' | 'sky' | 'amber' | 'violet'
  icon?: LucideIcon
  label: string
  title: ReactNode
  subtitle?: ReactNode
}

const HIGHLIGHT: Record<KpiHighlightProps['variant'], string> = {
  emerald: 'border-emerald-200 bg-emerald-50/70 text-emerald-800',
  sky: 'border-sky-200 bg-sky-50/70 text-sky-800',
  amber: 'border-amber-200 bg-amber-50/80 text-amber-900',
  violet: 'border-violet-200 bg-violet-50/70 text-violet-800',
}

const HIGHLIGHT_TITLE: Record<KpiHighlightProps['variant'], string> = {
  emerald: 'text-emerald-950',
  sky: 'text-sky-950',
  amber: 'text-amber-950',
  violet: 'text-violet-950',
}

export function KpiHighlight({
  variant,
  icon: Icon,
  label,
  title,
  subtitle,
}: KpiHighlightProps) {
  return (
    <div className={`rounded-xl border p-2.5 ${HIGHLIGHT[variant]}`}>
      <div className="mb-1 flex items-center gap-1 text-xs font-bold uppercase tracking-wider">
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {label}
      </div>
      <p className={`text-sm font-bold leading-tight ${HIGHLIGHT_TITLE[variant]}`}>
        {title}
      </p>
      {subtitle ? <p className="mt-0.5 text-xs opacity-80">{subtitle}</p> : null}
    </div>
  )
}

type KpiProgressProps = {
  label: string
  value: ReactNode
  pct: number
  ok?: boolean
}

export function KpiProgress({ label, value, pct, ok = true }: KpiProgressProps) {
  return (
    <div className={BLOQUE}>
      <p className={`${TITULO_BLOQUE} mb-1.5`}>{label}</p>
      <div className="mb-1.5 flex items-baseline justify-between gap-1">
        <span className="text-sm font-semibold text-slate-800">{value}</span>
        <span
          className={`text-sm font-bold tabular-nums ${
            ok ? 'text-emerald-600' : 'text-amber-600'
          }`}
        >
          {pct}%
        </span>
      </div>
      <div className="h-2 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${
            ok ? 'bg-emerald-500' : 'bg-amber-500'
          }`}
          style={{ width: `${Math.min(100, Math.max(0, pct))}%` }}
        />
      </div>
    </div>
  )
}

type KpiBarRowProps = {
  icon?: LucideIcon
  label: string
  value: number
  max: number
  color: string
}

export function KpiBarRow({ icon: Icon, label, value, max, color }: KpiBarRowProps) {
  const pct = max > 0 ? Math.round((value / max) * 100) : 0
  return (
    <div>
      <div className="mb-1 flex items-center justify-between text-sm">
        <span className="flex items-center gap-1.5 font-medium text-slate-700">
          {Icon ? <Icon className="h-3 w-3 text-slate-500" /> : null}
          {label}
        </span>
        <span className="font-bold tabular-nums text-ink">{value}</span>
      </div>
      <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
        <div
          className={`h-full rounded-full transition-all duration-300 ${color}`}
          style={{ width: `${pct}%` }}
        />
      </div>
    </div>
  )
}

export function KpiSection({
  icon: Icon,
  title,
  children,
}: {
  icon?: LucideIcon
  title: string
  children: ReactNode
}) {
  return (
    <div className={BLOQUE}>
      <div className={`${TITULO_BLOQUE} mb-2 flex items-center gap-1.5`}>
        {Icon ? <Icon className="h-3 w-3" /> : null}
        {title}
      </div>
      {children}
    </div>
  )
}

export function KpiChipGrid({
  items,
}: {
  items: Array<{ clave: string; total: ReactNode }>
}) {
  return (
    <div className="grid grid-cols-4 gap-1.5">
      {items.map((item) => (
        <div
          key={item.clave}
          className="rounded-lg border border-line bg-slate-50/80 px-1.5 py-1 text-center"
        >
          <div className="text-[10px] font-bold uppercase tracking-wide text-slate-500">
            {item.clave}
          </div>
          <div className="text-sm font-bold tabular-nums leading-tight text-ink">
            {item.total}
          </div>
        </div>
      ))}
    </div>
  )
}
