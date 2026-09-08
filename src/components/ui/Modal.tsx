import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { BLOQUE, FOCUS_RING } from '@/lib/uiStyles'

type Props = {
  title: string
  subtitle?: ReactNode
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
  panelClassName?: string
  bodyClassName?: string
  footerClassName?: string
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({
  title,
  subtitle,
  children,
  footer,
  onClose,
  size = 'md',
  panelClassName = '',
  bodyClassName = 'text-xs text-slate-800',
  footerClassName = 'justify-end',
}: Props) {
  useEffect(() => {
    function onKey(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose()
    }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [onClose])

  return (
    <div
      className="fixed inset-0 z-[60] flex items-center justify-center bg-slate-900/50 p-4"
      onClick={onClose}
      role="presentation"
    >
      <div
        className={`${BLOQUE} flex w-full flex-col ${SIZE[size]} shadow-xl ${panelClassName}`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="flex shrink-0 items-start justify-between gap-2">
          <div className="min-w-0">
            <h2 id="modal-title" className="text-sm font-bold text-slate-900">
              {title}
            </h2>
            {subtitle ? (
              <p className="mt-0.5 text-xs text-slate-500">{subtitle}</p>
            ) : null}
          </div>
          <button
            type="button"
            className={`shrink-0 rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
            aria-label="Cerrar"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className={`min-h-0 flex-1 ${bodyClassName}`}>{children}</div>
        {footer ? (
          <div
            className={`mt-4 flex shrink-0 flex-wrap gap-2 border-t border-slate-100 pt-3 ${footerClassName}`}
          >
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
