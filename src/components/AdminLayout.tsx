import { CalendarDays } from 'lucide-react'
import { Fragment } from 'react'
import { NavLink, Outlet } from 'react-router-dom'
import { AppDialogProvider } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { isDesignPreview } from '@/lib/designPreview'
import { FOCUS_RING } from '@/lib/uiStyles'
import { useConfigOperativaBootstrap } from '@/lib/useConfigOperativaBootstrap'

const NAV_GROUPS = [
  {
    id: 'plantilla',
    items: [
      { to: '/admin/agentes', label: 'Agentes', end: true as const },
      { to: '/admin/puestos', label: 'Puestos' },
      { to: '/admin/minimos', label: 'Mínimos' },
      { to: '/admin/plan-anual', label: 'Plan anual' },
    ],
  },
  {
    id: 'operacion',
    items: [
      { to: '/admin/cuadrante-mensual', label: 'Cuadrante mensual' },
      { to: '/admin/cuadrante-jefes', label: 'Cuadrante jefes' },
      { to: '/admin/calendario', label: 'Calendario' },
      { to: '/admin/listados', label: 'Listados' },
    ],
  },
  {
    id: 'normativa',
    items: [{ to: '/admin/reglas', label: 'Reglas' }],
  },
] as const

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'relative rounded-lg px-3 py-1.5 text-sm font-medium transition-colors',
    FOCUS_RING,
    isActive
      ? 'bg-brand-50 text-brand-700'
      : 'text-slate-600 hover:bg-slate-100 hover:text-ink',
  ].join(' ')

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const { estado, error, firebaseOk } = useConfigOperativaBootstrap()

  return (
    <AppDialogProvider>
      <div className="flex h-svh flex-col bg-canvas text-ink">
        <header className="sticky top-0 z-50 shrink-0 border-b border-line bg-surface/95 backdrop-blur-sm">
          <div className="flex items-center gap-3 px-3 py-2.5 sm:px-4">
            <div className="flex shrink-0 items-center gap-2.5">
              <span className="flex h-9 w-9 items-center justify-center rounded-xl bg-brand-600 text-white">
                <CalendarDays className="h-5 w-5" aria-hidden />
              </span>
              <div className="leading-tight">
                <p className="font-display text-sm font-bold tracking-tight text-ink">
                  Cuadrapp
                </p>
                <span className="inline-flex rounded-full bg-brand-50 px-1.5 py-px text-[10px] font-bold uppercase tracking-wide text-brand-700">
                  Portuaria
                </span>
              </div>
            </div>

            <nav
              className="flex min-w-0 flex-1 items-center gap-0.5 overflow-x-auto overscroll-x-contain [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
              aria-label="Secciones"
            >
              {NAV_GROUPS.map((group, groupIndex) => (
                <Fragment key={group.id}>
                  {groupIndex > 0 ? (
                    <span
                      className="mx-1.5 h-4 w-px shrink-0 bg-brand-200"
                      aria-hidden
                    />
                  ) : null}
                  {group.items.map((item) => (
                    <NavLink
                      key={item.to}
                      to={item.to}
                      className={navClass}
                      end={'end' in item ? item.end : false}
                    >
                      {item.label}
                    </NavLink>
                  ))}
                </Fragment>
              ))}
            </nav>

            <div className="flex shrink-0 items-center gap-2 border-l border-line pl-2 sm:pl-3">
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
                <p className="text-xs text-muted">Administrador</p>
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

          {isDesignPreview ? (
            <p className="border-t border-brand-200 bg-brand-50 px-4 py-1.5 text-sm font-medium text-brand-800">
              Modo vista previa (sin Firebase) — solo para diseño y QA local
            </p>
          ) : null}
          {estado === 'loading' ? (
            <p className="border-t border-line px-4 py-1.5 text-sm text-muted">
              Cargando plantilla, plan anual, puestos y eventos desde Firestore…
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

        <footer className="flex shrink-0 items-center justify-between gap-3 border-t border-line bg-surface px-3 py-1.5 text-[11px] text-muted">
          <span>Policía Portuaria</span>
          <span>Cuadrapp</span>
        </footer>
      </div>
    </AppDialogProvider>
  )
}
