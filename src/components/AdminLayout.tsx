import { NavLink, Outlet } from 'react-router-dom'
import { useAuth } from '@/contexts/AuthContext'
import { useConfigOperativaBootstrap } from '@/lib/useConfigOperativaBootstrap'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded-md px-2 py-1 text-[11px] font-medium',
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
        <div className="flex items-center justify-between gap-2 px-2.5 py-2">
          <p className="text-sm font-bold tracking-tight text-slate-900">Cuadrapp</p>
          <nav className="flex flex-1 flex-wrap justify-center gap-0.5">
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
            <NavLink to="/admin/listados" className={navClass}>
              Listados
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
                className="h-6 w-6 rounded-full"
              />
            ) : null}
            <span className="hidden max-w-[120px] truncate text-[10px] text-slate-600 sm:inline">
              {user?.displayName ?? user?.email}
            </span>
            <button
              type="button"
              onClick={() => void signOut()}
              className="rounded-md px-1.5 py-0.5 text-[10px] font-medium text-slate-600 hover:bg-slate-100 hover:text-slate-900"
            >
              Salir
            </button>
          </div>
        </div>
        {estado === 'loading' ? (
          <p className="border-t border-slate-100 px-2.5 py-0.5 text-[10px] text-slate-500">
            Cargando plantilla, plan anual, puestos y eventos desde Firestore…
          </p>
        ) : null}
        {error ? (
          <p className="border-t border-red-200 bg-red-50 px-2.5 py-0.5 text-[10px] text-red-800">
            {error}
            {!firebaseOk ? ' · Sin Firebase no se persisten cambios.' : ''}
          </p>
        ) : null}
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-1.5">
        <Outlet />
      </main>
    </div>
  )
}
