import { CalendarCheck, CalendarRange, ClipboardList, LayoutList } from 'lucide-react'
import { NavLink, Outlet } from 'react-router-dom'
import { AppDialogProvider } from '@/components/ui/ConfirmDialog'
import { useAuth } from '@/contexts/AuthContext'
import { useConfigOperativaBootstrap } from '@/lib/useConfigOperativaBootstrap'
import { FOCUS_RING } from '@/lib/uiStyles'
import { MovilMesProvider, useMovilMes } from '@/pages/movil/movilMes'

function CabeceraMes() {
  const { user, signOut } = useAuth()
  const { nombreMes, anio, cambiarMes } = useMovilMes()
  return (
    <header className="sticky top-0 z-20 border-b border-slate-200 bg-slate-950 px-4 pb-3 pt-[max(0.75rem,env(safe-area-inset-top))] text-white">
      <div className="flex items-center justify-between gap-3">
        <div>
          <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">
            Cuadrapp · consulta
          </p>
          <p className="text-sm text-slate-300">
            {user?.email ? user.email : 'Jefes y responsables'}
          </p>
        </div>
        <button
          type="button"
          className={`rounded-full px-3 py-1 text-sm font-semibold text-slate-200 ${FOCUS_RING}`}
          onClick={() => void signOut()}
        >
          Salir
        </button>
      </div>
      <div className="mt-3 flex items-center justify-between">
        <button
          type="button"
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg ${FOCUS_RING}`}
          aria-label="Mes anterior"
          onClick={() => cambiarMes(-1)}
        >
          ‹
        </button>
        <p className="text-lg font-extrabold tracking-tight">
          {nombreMes} {anio}
        </p>
        <button
          type="button"
          className={`flex h-10 w-10 items-center justify-center rounded-full bg-white/10 text-lg ${FOCUS_RING}`}
          aria-label="Mes siguiente"
          onClick={() => cambiarMes(1)}
        >
          ›
        </button>
      </div>
    </header>
  )
}

export function MovilLayout() {
  const { estado, error } = useConfigOperativaBootstrap()
  return (
    <AppDialogProvider>
      <MovilMesProvider>
        <div className="flex min-h-svh flex-col bg-slate-100 text-slate-900">
          <CabeceraMes />
          <main className="min-h-0 flex-1 overflow-y-auto px-3 py-3 pb-24">
            {estado === 'loading' ? (
              <p className="px-1 py-6 text-sm text-slate-500">Cargando plantilla…</p>
            ) : null}
            {error ? (
              <p className="mb-3 rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">
                {error}
              </p>
            ) : null}
            <Outlet />
          </main>
          <nav
            className="fixed inset-x-0 bottom-0 z-20 grid grid-cols-4 gap-1 border-t border-slate-200 bg-white px-2 pt-2 pb-[max(0.5rem,env(safe-area-inset-bottom))]"
            aria-label="Consulta móvil"
          >
            <NavLink
              to="/m/cuadrante"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold ${FOCUS_RING} ${
                  isActive ? 'bg-slate-950 text-white' : 'text-slate-500'
                }`
              }
            >
              <LayoutList className="h-4 w-4" aria-hidden />
              Cuadrante
            </NavLink>
            <NavLink
              to="/m/calendario"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold ${FOCUS_RING} ${
                  isActive ? 'bg-slate-950 text-white' : 'text-slate-500'
                }`
              }
            >
              <CalendarRange className="h-4 w-4" aria-hidden />
              Calendario
            </NavLink>
            <NavLink
              to="/m/servicio"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold ${FOCUS_RING} ${
                  isActive ? 'bg-slate-950 text-white' : 'text-slate-500'
                }`
              }
            >
              <CalendarCheck className="h-4 w-4" aria-hidden />
              Agente
            </NavLink>
            <NavLink
              to="/m/permisos"
              className={({ isActive }) =>
                `flex flex-col items-center gap-0.5 rounded-2xl py-2 text-xs font-bold ${FOCUS_RING} ${
                  isActive ? 'bg-slate-950 text-white' : 'text-slate-500'
                }`
              }
            >
              <ClipboardList className="h-4 w-4" aria-hidden />
              Permisos
            </NavLink>
          </nav>
        </div>
      </MovilMesProvider>
    </AppDialogProvider>
  )
}
