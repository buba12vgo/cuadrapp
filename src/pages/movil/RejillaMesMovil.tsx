import { useMemo } from 'react'
import { celdasMesCalendario } from '@/lib/exportarCalendarioJefesPdf'
import { esFinDeSemana } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'

const CABECERA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

export function RejillaMesMovil({
  anio,
  mes,
  diaSeleccionado,
  onElegir,
  marca,
}: {
  anio: number
  mes: number
  diaSeleccionado: number | null
  onElegir: (dia: number) => void
  marca?: (dia: number) => {
    aviso?: boolean
    texto?: string
    punto?: 'verde' | 'ambar' | 'rojo'
    puntos?: Array<'verde' | 'ambar' | 'rojo'>
  }
}) {
  const celdas = useMemo(() => celdasMesCalendario(anio, mes), [anio, mes])

  return (
    <div className="overflow-hidden rounded-3xl bg-white shadow-sm">
      <div className="grid grid-cols-7 border-b border-slate-100">
        {CABECERA.map((dia, indice) => (
          <div
            key={dia}
            className={`py-2 text-center text-[11px] font-extrabold ${
              indice >= 5 ? 'text-rose-600' : 'text-slate-400'
            }`}
          >
            {dia}
          </div>
        ))}
      </div>
      <div className="grid grid-cols-7">
        {celdas.map((dia, indice) => {
          if (dia == null) {
            return <div key={`hueco-${indice}`} className="aspect-square bg-slate-50/80" />
          }
          const especial = esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
          const seleccionado = dia === diaSeleccionado
          const extra = marca?.(dia)
          return (
            <button
              key={dia}
              type="button"
              className={`flex aspect-square flex-col items-center justify-center gap-0.5 ${
                seleccionado ? 'bg-slate-950 text-white' : especial ? 'bg-rose-50' : 'bg-white'
              }`}
              aria-pressed={seleccionado}
              onClick={() => onElegir(dia)}
            >
              <span
                className={`text-sm font-extrabold leading-none ${
                  seleccionado ? 'text-white' : especial ? 'text-rose-700' : 'text-slate-900'
                }`}
              >
                {dia}
              </span>
              {extra?.texto ? (
                <span
                  className={`max-w-full truncate px-0.5 text-[9px] font-extrabold leading-none ${
                    seleccionado ? 'text-slate-200' : 'text-slate-600'
                  }`}
                >
                  {extra.texto}
                </span>
              ) : null}
              {extra?.puntos ? (
                <span className="flex gap-0.5">
                  {extra.puntos.map((punto, indicePunto) => (
                    <span
                      key={indicePunto}
                      className={`h-1.5 w-1.5 rounded-full ${
                        punto === 'verde'
                          ? 'bg-emerald-500'
                          : punto === 'ambar'
                            ? 'bg-amber-400'
                            : 'bg-rose-500'
                      }`}
                    />
                  ))}
                </span>
              ) : (
                <span
                  className={`h-1.5 w-1.5 rounded-full ${
                    extra?.punto === 'verde'
                      ? 'bg-emerald-500'
                      : extra?.punto === 'ambar'
                        ? 'bg-amber-400'
                        : extra?.punto === 'rojo'
                          ? 'bg-rose-500'
                          : extra?.aviso
                            ? seleccionado
                              ? 'bg-amber-300'
                              : 'bg-amber-500'
                            : 'bg-transparent'
                  }`}
                />
              )}
            </button>
          )
        })}
      </div>
    </div>
  )
}
