import { NavLink, Outlet } from 'react-router-dom'
import { AppDialogProvider } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { isDesignPreview } from '@/lib/designPreview'
import { FOCUS_RING } from '@/lib/uiStyles'
import { useConfigOperativaBootstrap } from '@/lib/useConfigOperativaBootstrap'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-2.5 py-1.5 text-xs font-medium',
    FOCUS_RING,
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const { estado, error, firebaseOk } = useConfigOperativaBootstrap()

  return (
    <AppDialogProvider>
    <div className="flex h-svh flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-2 px-2.5 py-1.5">
          <p className="shrink-0 text-sm font-bold tracking-tight text-slate-900">
            Cuadrapp
          </p>
          <div className="flex shrink-0 items-center gap-2">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-6 w-6 rounded-full"
              />
            ) : null}
            <span className="hidden max-w-[140px] truncate text-xs text-slate-600 sm:inline">
              {user?.displayName ?? user?.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className={`rounded-md px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900 ${FOCUS_RING}`}
            >
              Salir
            </button>
          </div>
        </div>
        <nav
          className="flex gap-0.5 overflow-x-auto overscroll-x-contain border-t border-slate-100 px-2.5 py-1 [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
          aria-label="Secciones"
        >
            <NavLink to="/admin/agentes" className={navClass} end>
              Agentes
            </NavLink>
            <NavLink to="/admin/puestos" className={navClass}>
              Puestos
            </NavLink>
            <NavLink to="/admin/minimos" className={navClass}>
              Mínimos
            </NavLink>
            <NavLink to="/admin/plan-anual" className={navClass}>
              Plan anual
            </NavLink>
            <NavLink to="/admin/cuadrante-mensual" className={navClass}>
              Cuadrante mensual
            </NavLink>
            <NavLink to="/admin/calendario" className={navClass}>
              Calendario
            </NavLink>
            <NavLink to="/admin/listados" className={navClass}>
              Listados
            </NavLink>
            <NavLink to="/admin/reglas" className={navClass}>
              Reglas
            </NavLink>
        </nav>
        {isDesignPreview ? (
          <p className="border-t border-violet-200 bg-violet-50 px-2.5 py-1 text-xs font-medium text-violet-900">
            Modo vista previa (sin Firebase) — solo para diseño y QA local
          </p>
        ) : null}
        {estado === 'loading' ? (
          <p className="border-t border-slate-100 px-2.5 py-1 text-xs text-slate-500">
            Cargando plantilla, plan anual, puestos y eventos desde Firestore…
          </p>
        ) : null}
        {error ? (
          <p className="border-t border-red-200 bg-red-50 px-2.5 py-1 text-xs text-red-800">
            {error}
            {!firebaseOk ? ' · Sin Firebase no se persisten cambios.' : ''}
          </p>
        ) : null}
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        <Outlet />
      </main>
    </div>
    </AppDialogProvider>
  )
}
