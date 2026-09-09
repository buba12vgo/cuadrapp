import type { ReactNode } from 'react'

export function DashboardBody({ children }: { children: ReactNode }) {
  return (
    <div className="flex min-h-0 flex-1 flex-col gap-3 overflow-hidden xl:flex-row">
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
  return (
    <div
      className={`flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden rounded-xl border border-line bg-surface shadow-card ${className}`.trim()}
    >
      {children}
    </div>
  )
}

export function DashboardMainScroll({
  children,
  className = '',
}: {
  children: ReactNode
  className?: string
}) {
  return (
    <div
      className={`min-h-0 min-w-0 flex-1 overflow-auto overscroll-contain ${className}`.trim()}
    >
      {children}
    </div>
  )
}

export function DashboardSidebar({ children }: { children: ReactNode }) {
  return (
    <aside className="flex w-full shrink-0 flex-col gap-2 overflow-y-auto xl:w-64 xl:max-h-full 2xl:w-72">
      {children}
    </aside>
  )
}
