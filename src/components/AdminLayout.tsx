import {
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Gauge,
  List,
  PanelLeftClose,
  PanelLeftOpen,
  Shield,
  Table2,
  Users,
} from 'lucide-react'
import { Fragment, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AppDialogProvider } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { isAgentUser } from '@/lib/authAllowlist'
import { isDesignPreview } from '@/lib/designPreview'
import { FOCUS_RING } from '@/lib/uiStyles'
import { useConfigOperativaBootstrap } from '@/lib/useConfigOperativaBootstrap'

const SIDEBAR_KEY = 'cuadrapp.sidebar-collapsed'

const NAV_GROUPS = [
  {
    id: 'plantilla',
    label: 'Plantilla',
    items: [
      { to: '/admin/agentes', label: 'Agentes', icon: Users, end: true as const },
      { to: '/admin/puestos', label: 'Puestos', icon: Briefcase },
      { to: '/admin/permisos', label: 'Permisos', icon: ClipboardList },
      { to: '/admin/minimos', label: 'Mínimos', icon: Gauge },
      { to: '/admin/plan-anual', label: 'Plan anual', icon: CalendarRange },
    ],
  },
  {
    id: 'operacion',
    label: 'Operación',
    items: [
      {
        to: '/admin/cuadrante-mensual',
        label: 'Cuadrante mensual',
        icon: Table2,
      },
      {
        to: '/admin/cuadrante-jefes',
        label: 'Cuadrante jefes',
        icon: Shield,
      },
      {
        to: '/admin/calendario-jefes',
        label: 'Calendario jefes',
        icon: CalendarClock,
      },
      { to: '/admin/calendario', label: 'Calendario', icon: CalendarDays },
      { to: '/admin/listados', label: 'Listados', icon: List },
    ],
  },
  {
    id: 'normativa',
    label: 'Normativa',
    items: [{ to: '/admin/reglas', label: 'Reglas', icon: BookOpen }],
  },
] as const

function leerSidebarPlegado() {
  try {
    return localStorage.getItem(SIDEBAR_KEY) === '1'
  } catch {
    return false
  }
}

function guardarSidebarPlegado(plegado: boolean) {
  try {
    localStorage.setItem(SIDEBAR_KEY, plegado ? '1' : '0')
  } catch {
    /* ignore quota / private mode */
  }
}

function navClass(isActive: boolean, variant: 'side' | 'top', collapsed: boolean) {
  const base = [
    'flex items-center gap-2 whitespace-nowrap rounded-lg text-sm font-medium transition-colors',
    FOCUS_RING,
    isActive
      ? 'bg-brand-50 text-brand-800'
      : 'text-slate-600 hover:bg-slate-100 hover:text-ink',
  ]
  if (variant === 'side') {
    base.push(
      collapsed ? 'w-full justify-center px-0 py-1.5' : 'w-full px-2.5 py-1.5',
    )
  } else {
    base.push('shrink-0 px-3 py-1.5')
  }
  return base.join(' ')
}

function NavItems({
  variant,
  collapsed = false,
}: {
  variant: 'side' | 'top'
  collapsed?: boolean
}) {
  return (
    <>
      {NAV_GROUPS.map((group, groupIndex) => (
        <Fragment key={group.id}>
          {variant === 'side' && !collapsed ? (
            <p
              className={`px-2.5 text-[10px] font-bold uppercase tracking-wider text-muted ${
                groupIndex === 0 ? 'pt-1 pb-1' : 'pt-3 pb-1'
              }`}
            >
              {group.label}
            </p>
          ) : variant === 'side' && collapsed && groupIndex > 0 ? (
            <span className="mx-auto my-1 h-px w-6 bg-line" aria-hidden />
          ) : variant === 'top' && groupIndex > 0 ? (
            <span
              className="mx-1.5 h-4 w-px shrink-0 bg-brand-200"
              aria-hidden
            />
          ) : null}
          {group.items.map((item) => {
            const Icon = item.icon
            return (
              <NavLink
                key={item.to}
                to={item.to}
                title={collapsed ? item.label : undefined}
                className={({ isActive }) =>
                  navClass(isActive, variant, collapsed)
                }
                end={'end' in item ? item.end : false}
              >
                {variant === 'side' ? (
                  <Icon className="h-4 w-4 shrink-0 opacity-80" aria-hidden />
                ) : null}
                {variant === 'side' && collapsed ? (
                  <span className="sr-only">{item.label}</span>
                ) : (
                  item.label
                )}
              </NavLink>
            )
          })}
        </Fragment>
      ))}
    </>
  )
}

function BrandMark({ compact = false }: { compact?: boolean }) {
  return (
    <div
      className={`flex shrink-0 items-center ${
        compact ? 'justify-center' : 'gap-2.5'
      }`}
    >
      <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
        <CalendarDays className="h-5 w-5" aria-hidden />
      </span>
      {compact ? (
        <span className="sr-only">Cuadrapp</span>
      ) : (
        <div className="leading-tight">
          <p className="font-display text-sm font-bold tracking-tight text-ink">
            Cuadrapp
          </p>
          <span className="inline-flex rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand-700">
            Portuaria
          </span>
        </div>
      )}
    </div>
  )
}

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const { estado, error, firebaseOk } = useConfigOperativaBootstrap()
  const [collapsed, setCollapsed] = useState(leerSidebarPlegado)

  function toggleSidebar() {
    setCollapsed((actual) => {
      const siguiente = !actual
      guardarSidebarPlegado(siguiente)
      return siguiente
    })
  }

  return (
    <AppDialogProvider>
      <div className="flex h-svh bg-canvas text-ink">
        <aside
          className={`hidden shrink-0 flex-col overflow-hidden border-r border-line bg-surface transition-[width] duration-200 ease-out lg:flex ${
            collapsed ? 'w-14' : 'w-56'
          }`}
        >
          <div
            className={`border-b border-line py-2.5 ${collapsed ? 'px-1.5' : 'px-3'}`}
          >
            <BrandMark compact={collapsed} />
          </div>
          <nav
            id="admin-sidebar-nav"
            className={`flex min-h-0 flex-1 flex-col overflow-y-auto py-2 ${
              collapsed ? 'px-1.5' : 'px-2'
            }`}
            aria-label="Secciones"
          >
            <NavItems variant="side" collapsed={collapsed} />
          </nav>
          <div className="border-t border-line p-1.5">
            <button
              type="button"
              onClick={toggleSidebar}
              aria-expanded={!collapsed}
              aria-controls="admin-sidebar-nav"
              title={collapsed ? 'Desplegar menú' : 'Plegar menú'}
              className={`flex w-full items-center rounded-lg py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink ${FOCUS_RING} ${
                collapsed ? 'justify-center px-0' : 'gap-2 px-2.5'
              }`}
            >
              {collapsed ? (
                <PanelLeftOpen className="h-4 w-4" aria-hidden />
              ) : (
                <PanelLeftClose className="h-4 w-4" aria-hidden />
              )}
              {collapsed ? (
                <span className="sr-only">Desplegar menú</span>
              ) : (
                <span>Plegar</span>
              )}
            </button>
          </div>
        </aside>

        <div className="flex min-h-0 min-w-0 flex-1 flex-col">
          <header className="sticky top-0 z-50 shrink-0 border-b border-line bg-surface/95 backdrop-blur-sm">
            <div className="flex items-center gap-3 px-3 py-2 sm:px-4">
              <div className="lg:hidden">
                <BrandMark />
              </div>
              <div className="ml-auto flex shrink-0 items-center gap-2">
                {user?.photoURL ? (
                  <img
                    src={user.photoURL}
                    alt=""
                    className="h-8 w-8 rounded-full ring-2 ring-brand-100"
                  />
                ) : (
                  <span className="flex h-8 w-8 items-center justify-center rounded-full bg-brand-100 text-xs font-bold text-brand-700">
                    {(user?.displayName ?? user?.email ?? '?')
                      .slice(0, 1)
                      .toUpperCase()}
                  </span>
                )}
                <div className="hidden min-w-0 leading-tight sm:block">
                  <p className="max-w-[140px] truncate text-sm font-semibold text-ink">
                    {user?.displayName ?? user?.email ?? 'Usuario'}
                  </p>
                  <p className="text-xs text-muted">
                    {isAgentUser(user) ? 'Agente' : 'Administrador'}
                  </p>
                </div>
                <button
                  type="button"
                  onClick={() => void signOut()}
                  className={`rounded-lg px-2.5 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-100 hover:text-ink ${FOCUS_RING}`}
                >
                  Salir
                </button>
              </div>
            </div>
            <nav
              className="flex min-w-0 items-center gap-0.5 overflow-x-auto overscroll-x-contain border-t border-line px-2 py-1 [-ms-overflow-style:none] [scrollbar-width:none] lg:hidden [&::-webkit-scrollbar]:hidden"
              aria-label="Secciones"
            >
              <NavItems variant="top" />
            </nav>

            {isDesignPreview ? (
              <p className="border-t border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-800">
                Sesión Cursor (cursor@cuadrapp.local) — datos locales, sin
                Firestore
              </p>
            ) : null}
            {estado === 'loading' ? (
              <p className="border-t border-line px-4 py-1.5 text-sm text-muted">
                Cargando plantilla, plan anual, puestos y eventos desde
                Firestore…
              </p>
            ) : null}
            {error ? (
              <p className="border-t border-red-200 bg-red-50 px-4 py-1.5 text-sm text-red-800">
                {error}
                {!firebaseOk ? ' · Sin Firebase no se persisten cambios.' : ''}
              </p>
            ) : null}
          </header>

          <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2 sm:p-2.5">
            <Outlet />
          </main>

          <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-3 py-1.5 text-[11px] text-muted lg:hidden">
            <span>Policía Portuaria</span>
            <span>Cuadrapp</span>
          </footer>
        </div>
      </div>
    </AppDialogProvider>
  )
}
