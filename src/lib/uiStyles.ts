/** Tokens visuales compartidos — estilo SaaS dashboard. */

export const FOCUS_RING =
  'outline-none focus-visible:ring-2 focus-visible:ring-brand-500/40 focus-visible:ring-offset-1'

/** Cuerpo de texto principal (14px). */
export const TEXT_BODY = 'text-sm'

/** Texto secundario y etiquetas pequeñas (12px). */
export const TEXT_CAPTION = 'text-xs'

/** Etiquetas de formulario y toolbar. */
export const TEXT_LABEL = 'text-sm font-semibold text-slate-500'

export const PAGE_SECTION = 'flex h-full min-h-0 flex-col gap-3'

export const PAGE_HEADER =
  'shrink-0 rounded-xl border border-line bg-surface px-4 py-3 shadow-card'

export const PAGE_TITLE = 'font-display text-xl font-bold tracking-tight text-ink'

export const PAGE_SUBTITLE = 'text-sm text-muted'

export const PAGE_TOOLBAR =
  'mt-3 flex min-w-0 flex-wrap items-center gap-2 overflow-x-auto overscroll-x-contain border-t border-line pt-3 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

export const TOOLBAR_DIVIDER = 'mx-0.5 h-5 w-px shrink-0 bg-line'

export const PAGE_PANEL =
  'min-h-0 flex-1 overflow-hidden rounded-xl border border-line bg-surface shadow-card'

export const PAGE_PANEL_SCROLL =
  'min-h-0 flex-1 overflow-auto rounded-xl border border-line bg-surface shadow-card'

const BTN_BASE =
  'inline-flex h-9 items-center gap-1.5 rounded-lg px-3 text-sm font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-50'

export const BTN_PRIMARY = `${BTN_BASE} bg-brand-600 text-white shadow-sm hover:bg-brand-700 ${FOCUS_RING}`

export const BTN_SECONDARY = `${BTN_BASE} border border-line bg-surface text-slate-700 hover:bg-brand-50 hover:border-brand-200 hover:text-brand-800 ${FOCUS_RING}`

export const BTN_GHOST = `${BTN_BASE} text-slate-600 hover:bg-slate-100 hover:text-ink ${FOCUS_RING}`

export const BTN_DANGER = `${BTN_BASE} border border-red-200 bg-white text-red-600 hover:bg-red-50 ${FOCUS_RING}`

export const BTN_SUCCESS = `${BTN_BASE} bg-emerald-600 text-white hover:bg-emerald-500 ${FOCUS_RING}`

export const CAMPO = `h-9 rounded-lg border border-line bg-white px-2.5 text-sm text-ink placeholder:text-slate-400 ${FOCUS_RING} focus:border-brand-400`

export const CAMPO_NUM = `h-9 w-14 rounded-lg border border-line bg-white px-1 text-center text-sm tabular-nums text-ink ${FOCUS_RING} focus:border-brand-400`

export const ALERT_ERROR =
  'shrink-0 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800'

export const ALERT_WARN =
  'shrink-0 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2 text-sm text-amber-950'

export const ALERT_INFO =
  'shrink-0 rounded-xl border border-line bg-brand-50/60 px-3 py-2 text-sm text-slate-700'

export const TABLE = 'w-full border-collapse text-sm'

export const TH =
  'border-b border-line bg-slate-50/80 px-2.5 py-2 text-left text-xs font-semibold uppercase tracking-wider text-slate-500'

export const TD =
  'border-b border-line/80 px-2.5 py-1.5 align-middle text-sm text-slate-800'

export const BLOQUE = 'rounded-xl border border-line bg-surface p-3 shadow-card'

export const TITULO_BLOQUE =
  'mb-1.5 text-xs font-bold uppercase tracking-wider text-slate-500'

export const BADGE_OK =
  'rounded-full bg-emerald-100 px-2.5 py-0.5 text-xs font-semibold text-emerald-800'

export const BADGE_PENDING =
  'rounded-full bg-amber-100 px-2.5 py-0.5 text-xs font-semibold text-amber-800'

export const BADGE_NEUTRAL =
  'rounded-full bg-slate-100 px-2.5 py-0.5 text-xs font-medium text-slate-600'

/** Celdas M/T/N/V — badges pastel estilo dashboard SaaS. */
export const CLASE_TURNO_CELDA: Record<'M' | 'T' | 'N' | 'V', string> = {
  M: 'rounded-md bg-blue-100 font-semibold text-blue-700',
  T: 'rounded-md bg-orange-100 font-semibold text-orange-700',
  N: 'rounded-md bg-violet-100 font-semibold text-violet-700',
  V: 'rounded-md bg-emerald-100 font-semibold text-emerald-700',
}

export const MARCA_PLAN_CABECERA =
  'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-200'

export const MARCA_PLAN_FILA =
  'bg-amber-50/90 font-medium text-amber-900 ring-1 ring-inset ring-amber-200'

export const SEMAFORO_OK = 'bg-emerald-50 font-semibold text-emerald-800'

export const SEMAFORO_KO = 'bg-rose-50 font-semibold text-rose-800'

export const SEMAFORO_WARN = 'bg-amber-50 font-semibold text-amber-900'

export const SEMAFORO_NEUTRO = 'bg-slate-100 text-slate-500'

/** Celda densa de cuadrante / plan anual. */
export const CELDA_GRID =
  'h-7 border border-line px-1 py-0 text-sm leading-none'
