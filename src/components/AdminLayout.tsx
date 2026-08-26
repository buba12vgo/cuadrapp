import { NavLink, Outlet } from 'react-router-dom'

const navClass = ({ isActive }: { isActive: boolean }) =>
  [
    'rounded px-3 py-1.5 text-sm font-medium',
    isActive
      ? 'bg-slate-900 text-white'
      : 'text-slate-600 hover:bg-slate-100 hover:text-slate-900',
  ].join(' ')

export function AdminLayout() {
  return (
    <div className="flex h-svh flex-col bg-slate-50 text-slate-900">
      <header className="sticky top-0 z-50 shrink-0 border-b border-slate-200 bg-white">
        <div className="flex items-center justify-between gap-4 px-4 py-3">
          <p className="text-sm font-semibold tracking-tight">Cuadrapp</p>
          <nav className="flex flex-wrap gap-1">
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
          </nav>
        </div>
      </header>
      <main className="flex min-h-0 flex-1 flex-col overflow-hidden p-2">
        <Outlet />
      </main>
    </div>
  )
}
