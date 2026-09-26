import {
  BookOpen,
  Briefcase,
  CalendarClock,
  CalendarCheck,
  CalendarDays,
  CalendarRange,
  ClipboardList,
  Gauge,
  Layers,
  List,
  ListChecks,
  PanelLeftClose,
  PanelLeftOpen,
  Settings,
  Shield,
  Table2,
  UserCog,
  Users,
} from 'lucide-react'
import { Fragment, useState } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AppDialogProvider } from '@/components/ui/ConfirmDialog'
import { useAcceso } from '@/contexts/AccesoContext'
import { useAuth } from '@/contexts/AuthContext'
import { isAgentUser } from '@/lib/authAllowlist'
import { type Ambito, type RolAcceso } from '@/lib/acceso'
import { isDesignPreview } from '@/lib/designPreview'
import { FOCUS_RING } from '@/lib/uiStyles'
import { useConfigOperativaBootstrap } from '@/lib/useConfigOperativaBootstrap'

const SIDEBAR_KEY = 'cuadrapp.sidebar-collapsed'

const NAV_GROUPS: Array<{
  id: string
  label: string
  items: Array<{
    to: string
    label: string
    icon: typeof Users
    ambito: Ambito
    end?: boolean
  }>
}> = [
  {
    id: 'plantilla',
    label: 'Plantilla',
    items: [
      { to: '/admin/agentes', label: 'Agentes', icon: Users, ambito: 'agentes', end: true },
      { to: '/admin/puestos', label: 'Puestos', icon: Briefcase, ambito: 'puestos' },
      { to: '/admin/permisos', label: 'Permisos', icon: ClipboardList, ambito: 'permisos' },
      {
        to: '/admin/permisos-agentes',
        label: 'Permisos agentes',
        icon: ClipboardList,
        ambito: 'permisos-agentes',
      },
      { to: '/admin/minimos', label: 'Mínimos', icon: Gauge, ambito: 'minimos' },
      { to: '/admin/plan-anual', label: 'Plan anual', icon: CalendarRange, ambito: 'plan-anual' },
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
        ambito: 'cuadrante-mensual',
      },
      {
        to: '/admin/cuadrante-jefes',
        label: 'Cuadrante jefes',
        icon: Shield,
        ambito: 'cuadrante-jefes',
      },
      {
        to: '/admin/calendario-jefes',
        label: 'Calendario jefes',
        icon: CalendarClock,
        ambito: 'calendario-jefes',
      },
      {
        to: '/admin/calendario-agente',
        label: 'Calendario agente',
        icon: CalendarCheck,
        ambito: 'calendario-agente',
      },
      {
        to: '/admin/diario-agentes',
        label: 'Diario agentes',
        icon: ListChecks,
        ambito: 'diario-agentes',
      },
      { to: '/admin/calendario', label: 'Calendario Eventos', icon: CalendarDays, ambito: 'calendario' },
      { to: '/admin/listados', label: 'Listados', icon: List, ambito: 'listados' },
    ],
  },
  {
    id: 'cuenta',
    label: 'Cuenta',
    items: [
      { to: '/admin/usuarios', label: 'Usuarios', icon: UserCog, ambito: 'usuarios' },
      { to: '/admin/opciones', label: 'Opciones', icon: Settings, ambito: 'opciones' },
      { to: '/admin/reglas', label: 'Reglas', icon: BookOpen, ambito: 'reglas' },
      { to: '/admin/roadmap', label: 'Roadmap', icon: Layers, ambito: 'roadmap' },
    ],
  },
]

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
  const acceso = useAcceso()
  const grupos = NAV_GROUPS.map((group) => ({
    ...group,
    items: group.items.filter((item) => acceso.puedeVer(item.ambito)),
  })).filter((group) => group.items.length > 0)

  return (
    <>
      {grupos.map((group, groupIndex) => (
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

const ROLES_PREVIEW: RolAcceso[] = ['SUPERADMIN', 'ADMIN', 'CONSULTA_JEFES']

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const acceso = useAcceso()
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
                    {isDesignPreview && isAgentUser(user)
                      ? `Preview · ${acceso.etiquetaRol || 'Superadmin'}`
                      : acceso.etiquetaRol || 'Usuario'}
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
              <p className="flex flex-wrap items-center gap-2 border-t border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-800">
                <span>Sesión Cursor — datos locales, sin Firestore.</span>
                <label className="flex items-center gap-1 font-normal">
                  Ver como
                  <select
                    className="h-7 rounded-md border border-brand-200 bg-white px-1.5 text-xs text-ink"
                    value={acceso.rolPreview}
                    onChange={(event) =>
                      acceso.setRolPreview(event.target.value as RolAcceso)
                    }
                  >
                    {ROLES_PREVIEW.map((rol) => (
                      <option key={rol} value={rol}>
                        {rol === 'SUPERADMIN'
                          ? 'Superadmin'
                          : rol === 'ADMIN'
                            ? 'Admin'
                            : 'Consulta jefes'}
                      </option>
                    ))}
                  </select>
                </label>
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
