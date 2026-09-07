import type { ReactNode } from 'react'
import {
  PAGE_HEADER,
  PAGE_SUBTITLE,
  PAGE_TITLE,
  PAGE_TOOLBAR,
} from '@/lib/uiStyles'

type Props = {
  title: string
  subtitle?: string
  status?: ReactNode
  actions?: ReactNode
  toolbar?: ReactNode
}

export function PageHeader({ title, subtitle, status, actions, toolbar }: Props) {
  return (
    <header className={PAGE_HEADER}>
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="min-w-0">
          <h1 className={PAGE_TITLE}>{title}</h1>
          {subtitle ? <p className={PAGE_SUBTITLE}>{subtitle}</p> : null}
        </div>
        <div className="flex flex-wrap items-center gap-1">
          {status}
          {actions}
        </div>
      </div>
      {toolbar ? <div className={PAGE_TOOLBAR}>{toolbar}</div> : null}
    </header>
  )
}
