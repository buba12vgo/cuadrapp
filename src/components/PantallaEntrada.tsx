import { useCallback, useEffect, useState, type ReactNode } from 'react'
import { CalendarDays } from 'lucide-react'
import {
  DURACION_ENTRADA_MS,
  entradaYaVista,
  marcarEntradaVista,
} from '@/lib/entrada'
import { FOCUS_RING, PAGE_SUBTITLE } from '@/lib/uiStyles'

export function PantallaEntrada({ children }: { children: ReactNode }) {
  const [lista, setLista] = useState(entradaYaVista)

  const entrar = useCallback(() => {
    marcarEntradaVista()
    setLista(true)
  }, [])

  useEffect(() => {
    if (lista) return
    const id = window.setTimeout(entrar, DURACION_ENTRADA_MS)
    return () => window.clearTimeout(id)
  }, [entrar, lista])

  return (
    <>
      {children}
      {lista ? null : (
        <div
          className="fixed inset-0 z-[200] flex flex-col items-center justify-center overflow-hidden bg-canvas px-6"
          role="dialog"
          aria-label="Entrada a Cuadrapp"
          aria-modal="true"
        >
          <div
            className="pointer-events-none absolute inset-0 opacity-80"
            aria-hidden
            style={{
              background:
                'radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--color-brand-500) 18%, transparent), transparent), radial-gradient(ellipse 50% 36% at 100% 100%, color-mix(in srgb, var(--color-brand-600) 10%, transparent), transparent)',
            }}
          />
          <div className="entrada-marca relative flex flex-col items-center gap-4">
            <button
              type="button"
              onClick={entrar}
              className={`${FOCUS_RING} entrada-logo flex h-24 w-24 items-center justify-center rounded-[1.75rem] bg-brand-600 text-white shadow-card-lg`}
              aria-label="Entrar ahora"
            >
              <CalendarDays className="h-12 w-12" aria-hidden />
            </button>
            <div className="text-center">
              <p className="font-display text-2xl font-bold tracking-tight text-ink">
                Cuadrapp
              </p>
              <span className="mt-1 inline-flex rounded-full bg-brand-50 px-2 py-0.5 text-[11px] font-bold uppercase tracking-wide text-brand-700">
                Portuaria
              </span>
            </div>
            <p className={`${PAGE_SUBTITLE} text-center`}>
              Pulsa el logo para entrar
            </p>
          </div>
        </div>
      )}
    </>
  )
}
