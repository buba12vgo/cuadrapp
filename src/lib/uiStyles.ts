/** Estilo compacto compartido (referencia: Mínimos semanales). */

export const PAGE_SECTION = 'flex h-full min-h-0 flex-col gap-2'

export const PAGE_HEADER =
  'shrink-0 rounded-lg border border-slate-200 bg-white px-2.5 py-2 shadow-sm'

export const PAGE_TITLE = 'text-sm font-bold text-slate-900'

export const PAGE_SUBTITLE = 'text-[10px] text-slate-500'

export const PAGE_TOOLBAR =
  'mt-2 flex min-w-0 flex-wrap items-center gap-1 overflow-x-auto overscroll-x-contain border-t border-slate-100 pt-2 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden'

export const PAGE_PANEL =
  'min-h-0 flex-1 overflow-hidden rounded-lg border border-slate-200 bg-white shadow-sm'

export const PAGE_PANEL_SCROLL =
  'min-h-0 flex-1 overflow-auto rounded-lg border border-slate-200 bg-white shadow-sm'

export const BTN_PRIMARY =
  'inline-flex h-7 items-center gap-1 rounded-md bg-slate-900 px-2 text-[10px] font-semibold text-white hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50'

export const BTN_SECONDARY =
  'inline-flex h-7 items-center gap-1 rounded-md border border-slate-200 bg-white px-2 text-[10px] font-semibold text-slate-700 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50'

export const BTN_GHOST =
  'inline-flex h-7 items-center rounded-md px-2 text-[10px] font-semibold text-slate-600 hover:bg-slate-100 disabled:cursor-not-allowed disabled:opacity-50'

export const BTN_DANGER =
  'inline-flex h-7 items-center rounded-md border border-red-200 bg-white px-2 text-[10px] font-semibold text-red-700 hover:bg-red-50 disabled:cursor-not-allowed disabled:opacity-50'

export const BTN_SUCCESS =
  'inline-flex h-7 items-center gap-1 rounded-md bg-emerald-700 px-2 text-[10px] font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:opacity-50'

export const CAMPO =
  'h-7 rounded-md border border-slate-200 bg-white px-1.5 text-[10px] text-slate-900 outline-none focus:border-slate-400'

export const CAMPO_NUM =
  'h-7 w-12 rounded-md border border-slate-200 bg-white px-1 text-center text-[10px] tabular-nums text-slate-900 outline-none focus:border-slate-400'

export const ALERT_ERROR =
  'shrink-0 rounded-lg border border-red-200 bg-red-50 px-2.5 py-1.5 text-[10px] text-red-800'

export const ALERT_WARN =
  'shrink-0 rounded-lg border border-amber-200 bg-amber-50 px-2.5 py-1.5 text-[10px] text-amber-950'

export const ALERT_INFO =
  'shrink-0 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-[10px] text-slate-700'

export const TABLE =
  'w-full border-collapse text-[10px]'

export const TH =
  'border-b border-slate-200 bg-slate-50 px-1.5 py-1 text-left text-[9px] font-semibold uppercase tracking-wide text-slate-500'

export const TD =
  'border-b border-slate-100 px-1.5 py-0.5 align-middle text-slate-800'

export const BLOQUE = 'rounded-lg border border-slate-200 bg-white p-2 shadow-sm'

export const TITULO_BLOQUE =
  'mb-1.5 text-[9px] font-bold uppercase tracking-wide text-slate-500'

export const BADGE_OK =
  'rounded-full bg-emerald-100 px-2 py-0.5 text-[10px] font-semibold text-emerald-800'

export const BADGE_PENDING =
  'rounded-full bg-amber-100 px-2 py-0.5 text-[10px] font-medium text-amber-800'

export const BADGE_NEUTRAL =
  'rounded-full bg-slate-100 px-2 py-0.5 text-[10px] text-slate-600'

/** Celdas M/T/N/V — tonos pastel alineados al dashboard. */
export const CLASE_TURNO_CELDA: Record<'M' | 'T' | 'N' | 'V', string> = {
  M: 'bg-amber-50 text-amber-900',
  T: 'bg-orange-50 text-orange-900',
  N: 'bg-sky-50 text-sky-900',
  V: 'bg-slate-100 text-slate-700',
}

export const MARCA_PLAN_CABECERA =
  'bg-amber-50 text-amber-900 ring-1 ring-inset ring-amber-300'

export const MARCA_PLAN_FILA =
  'bg-amber-50/90 font-medium text-amber-900 ring-1 ring-inset ring-amber-300'

export const SEMAFORO_OK = 'bg-emerald-50 font-semibold text-emerald-800'

export const SEMAFORO_KO = 'bg-rose-50 font-semibold text-rose-800'

export const SEMAFORO_NEUTRO = 'bg-slate-100 text-slate-500'
