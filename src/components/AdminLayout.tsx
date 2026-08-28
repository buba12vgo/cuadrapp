import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useConfigOperativaBootstrap } from '@/lib/useConfigOperativaBootstrap'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded px-3 py-1.5 text-sm font-medium',
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

export function AdminLayout() {
  const { user, signOut } = useAuth()
  const { estado, error, firebaseOk } = useConfigOperativaBootstrap()

  return (
    <div className="flex h-svh flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold tracking-tight">Cuadrapp</p>
          <nav className="flex flex-1 flex-wrap justify-center gap-1">
            <NavLink to="/admin/agentes" className={navClass}>
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
            <NavLink to="/admin/reglas" className={navClass}>
              Reglas
            </NavLink>
          </nav>
          <div className="flex shrink-0 items-center gap-2">
            {user?.photoURL ? (
              <img
                src={user.photoURL}
                alt=""
                className="h-7 w-7 rounded-full"
              />
            ) : null}
            <span className="hidden max-w-[140px] truncate text-xs text-slate-600 sm:inline">
              {user?.displayName ?? user?.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded px-2 py-1 text-xs font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Salir
            </button>
          </div>
        </div>
        {estado === 'loading' ? (
          <p className="border-t border-slate-100 px-4 py-1 text-[11px] text-slate-500">
            Cargando puestos, mínimos y eventos desde Firestore…
          </p>
        ) : null}
        {error ? (
          <p className="border-t border-red-200 bg-red-50 px-4 py-1 text-[11px] text-red-800">
            {error}
            {!firebaseOk ? ' · Sin Firebase no se persisten cambios.' : ''}
          </p>
        ) : null}
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        <Outlet />
      </main>
    </div>
  )
}
