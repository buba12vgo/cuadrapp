import type { ReactNode } from 'react'
import { PAGE_PANEL } from '@/lib/uiStyles'

export function DashboardBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 xl:flex-row">
      {children}
    </div>
  )
}

export function DashboardMain({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return <div className={`${PAGE_PANEL} ${className}`.trim()}>{children}</div>
}

export function DashboardMainScroll({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div className={`min-h-0 flex-1 overflow-auto ${className}`.trim()}>
      {children}
    </div>
  )
}

export function DashboardSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-1.5 xl:w-52 2xl:w-56">
      {children}
    </aside>
  )
}
