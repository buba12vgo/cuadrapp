import type { ReactNode } from 'react'
import { useEffect } from 'react'
import { BLOQUE, FOCUS_RING } from '@/lib/uiStyles'

type Props = {
  title: string
  children: ReactNode
  footer?: ReactNode
  onClose: () => void
  size?: 'sm' | 'md' | 'lg'
}

const SIZE: Record<NonNullable<Props['size']>, string> = {
  sm: 'max-w-sm',
  md: 'max-w-lg',
  lg: 'max-w-2xl',
}

export function Modal({ title, children, footer, onClose, size = 'md' }: Props) {
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
        className={`${BLOQUE} w-full ${SIZE[size]} shadow-xl`}
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-title"
        onClick={(event) => event.stopPropagation()}
      >
        <div className="mb-3 flex items-start justify-between gap-2">
          <h2 id="modal-title" className="text-sm font-bold text-slate-900">
            {title}
          </h2>
          <button
            type="button"
            className={`rounded-md px-1.5 py-0.5 text-slate-500 hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
            aria-label="Cerrar"
            onClick={onClose}
          >
            ✕
          </button>
        </div>
        <div className="text-xs text-slate-800">{children}</div>
        {footer ? (
          <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-slate-100 pt-3">
            {footer}
          </div>
        ) : null}
      </div>
    </div>
  )
}
