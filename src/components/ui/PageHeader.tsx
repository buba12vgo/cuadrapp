import type { ReactNode } from 'react'
import {
  PAGE_HEADER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
  PAGE_TOOLBAR,
  TOOLBAR_DIVIDER,
} from '@/lib/uiStyles'

type Props = {
  title: string
  subtitle?: string
  status?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
}

export function ToolbarSection({
  label,
  children,
}: {
  label?: string
  children: ReactNode
}) {
  return (
    <div className="flex items-center gap-1.5">
      {label ? (
        <span className="text-sm font-semibold text-slate-500">{label}</span>
      ) : null}
      {children}
    </div>
  )
}

export function ToolbarDivider() {
  return <span className={TOOLBAR_DIVIDER} aria-hidden="true" />
}

export function PageHeader({ title, subtitle, status, actions, toolbar }: Props) {
  return (
    <header className={PAGE_HEADER}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE}>{title}</h1>
          {subtitle ? <p className={PAGE_SUBTITLE}>{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1.5">
          {status}
          {actions}
        </div>
      </div>
      {toolbar ? (
        <div className={PAGE_TOOLBAR}>
          <div className="flex min-w-max flex-wrap items-center gap-1.5">
            {toolbar}
          </div>
        </div>
      ) : null}
    </header>
  )
}
