import {
  ArrowDown,
  ArrowUp,
  BarChart3,
  CalendarRange,
  Moon,
  Sun,
  Sunset,
  Users,
} from 'lucide-react'
import { estadisticasMinimosSemana } from '@/lib/minimosEstadisticas'
import type { MinimosSemana, PuestoConfig } from '@/lib/calendarioPuestos'

type Props = {
  puestos: PuestoConfig[]
  minimos: MinimosSemana
  plantillaOperativa: number
}

const TURNO_META = [
  { clave: 'M' as const, label: 'M', icon: Sun, color: 'bg-amber-400' },
  { clave: 'T' as const, label: 'T', icon: Sunset, color: 'bg-orange-400' },
  { clave: 'N' as const, label: 'N', icon: Moon, color: 'bg-indigo-400' },
]

export function MinimosResumenPanel({
  puestos,
  minimos,
  plantillaOperativa,
}: Props) {
  const stats = estadisticasMinimosSemana(puestos, minimos)
  const coberturaPct =
    stats.picoTurno > 0
      ? Math.min(100, Math.round((plantillaOperativa / stats.picoTurno) * 100))
      : 100
  const coberturaOk = plantillaOperativa >= stats.picoTurno

  return (
    <aside className="flex w-full shrink-0 flex-col gap-1.5 xl:w-52 2xl:w-56">
      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-0.5 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarRange className="h-2.5 w-2.5" />
            Semana
          </div>
          <p className="text-lg font-bold tabular-nums leading-tight text-slate-900">
            {stats.totalSemanal}
          </p>
        </div>
        <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
          <div className="mb-0.5 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-2.5 w-2.5" />
            Plantilla
          </div>
          <p className="text-lg font-bold tabular-nums leading-tight text-slate-900">
            {plantillaOperativa}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
          Pico turno
        </p>
        <div className="mb-0.5 flex items-baseline justify-between gap-1">
          <span className="text-[11px] font-semibold text-slate-800">
            {stats.picoTurno}
          </span>
          <span
            className={`text-[10px] font-bold tabular-nums ${
              coberturaOk ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {coberturaPct}%
          </span>
        </div>
        <div className="h-1.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              coberturaOk ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${coberturaPct}%` }}
          />
        </div>
      </div>

      <div className="grid grid-cols-2 gap-1.5">
        <div className="rounded-lg border border-emerald-200 bg-emerald-50/60 p-1.5">
          <div className="mb-0.5 flex items-center gap-0.5 text-[8px] font-semibold uppercase text-emerald-800">
            <ArrowUp className="h-2.5 w-2.5" />
            Máx
          </div>
          <p className="text-sm font-bold leading-tight text-emerald-950">
            {stats.diaMayor.clave}
          </p>
          <p className="text-[9px] text-emerald-800/80">{stats.diaMayor.total}</p>
        </div>
        <div className="rounded-lg border border-sky-200 bg-sky-50/60 p-1.5">
          <div className="mb-0.5 flex items-center gap-0.5 text-[8px] font-semibold uppercase text-sky-800">
            <ArrowDown className="h-2.5 w-2.5" />
            Mín
          </div>
          <p className="text-sm font-bold leading-tight text-sky-950">
            {stats.diaMenor.clave}
          </p>
          <p className="text-[9px] text-sky-800/80">{stats.diaMenor.total}</p>
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-white p-2 shadow-sm">
        <div className="mb-1.5 flex items-center gap-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
          <BarChart3 className="h-2.5 w-2.5" />
          Por turno
        </div>
        <div className="space-y-1.5">
          {TURNO_META.map(({ clave, label, icon: Icon, color }) => {
            const valor = stats.porTurnoSemana[clave]
            const pct =
              stats.maxTurnoSemana > 0
                ? Math.round((valor / stats.maxTurnoSemana) * 100)
                : 0
            return (
              <div key={clave}>
                <div className="mb-0.5 flex items-center justify-between text-[10px]">
                  <span className="flex items-center gap-1 font-medium text-slate-700">
                    <Icon className="h-2.5 w-2.5 text-slate-500" />
                    {label}
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {valor}
                  </span>
                </div>
                <div className="h-1 overflow-hidden rounded-full bg-slate-100">
                  <div
                    className={`h-full rounded-full ${color}`}
                    style={{ width: `${pct}%` }}
                  />
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
        <p className="mb-1 text-[8px] font-semibold uppercase tracking-wide text-slate-500">
          Por día
        </p>
        <div className="grid grid-cols-4 gap-1">
          {stats.porDia.map((dia) => (
            <div
              key={dia.dia}
              className="rounded border border-slate-200 bg-white px-1 py-0.5 text-center"
            >
              <div className="text-[8px] font-semibold text-slate-500">
                {dia.clave}
              </div>
              <div className="text-[11px] font-bold tabular-nums leading-tight text-slate-900">
                {dia.total}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
