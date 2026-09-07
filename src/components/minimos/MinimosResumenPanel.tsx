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
  { clave: 'M' as const, label: 'Mañana', icon: Sun, color: 'bg-amber-400' },
  { clave: 'T' as const, label: 'Tarde', icon: Sunset, color: 'bg-orange-400' },
  { clave: 'N' as const, label: 'Noche', icon: Moon, color: 'bg-indigo-400' },
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
    <aside className="flex w-full shrink-0 flex-col gap-3 lg:w-72 xl:w-80">
      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <CalendarRange className="h-3.5 w-3.5" />
            Total semanal
          </div>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {stats.totalSemanal}
          </p>
          <p className="text-[11px] text-slate-500">plazas mínimas acumuladas</p>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
          <div className="mb-1 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            <Users className="h-3.5 w-3.5" />
            Plantilla
          </div>
          <p className="text-2xl font-bold tabular-nums text-slate-900">
            {plantillaOperativa}
          </p>
          <p className="text-[11px] text-slate-500">agentes operativos</p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Cobertura de pico
        </p>
        <div className="mb-1 flex items-baseline justify-between gap-2">
          <span className="text-sm font-semibold text-slate-800">
            {stats.picoTurno} plazas / turno
          </span>
          <span
            className={`text-xs font-bold tabular-nums ${
              coberturaOk ? 'text-emerald-600' : 'text-amber-600'
            }`}
          >
            {coberturaPct}%
          </span>
        </div>
        <div className="h-2.5 overflow-hidden rounded-full bg-slate-100">
          <div
            className={`h-full rounded-full transition-all ${
              coberturaOk ? 'bg-emerald-500' : 'bg-amber-500'
            }`}
            style={{ width: `${coberturaPct}%` }}
          />
        </div>
        <p className="mt-1.5 text-[11px] text-slate-500">
          {coberturaOk
            ? 'La plantilla cubre el pico diario por turno.'
            : 'El pico de un turno supera la plantilla operativa.'}
        </p>
      </div>

      <div className="grid grid-cols-2 gap-2">
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 p-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-emerald-800">
            <ArrowUp className="h-3.5 w-3.5" />
            Mayor cobertura
          </div>
          <p className="text-lg font-bold text-emerald-950">
            {stats.diaMayor.clave}
          </p>
          <p className="text-[11px] text-emerald-800/80">
            {stats.diaMayor.label} · {stats.diaMayor.total} plazas
          </p>
        </div>
        <div className="rounded-xl border border-sky-200 bg-sky-50/60 p-3">
          <div className="mb-1 flex items-center gap-1 text-[10px] font-semibold uppercase text-sky-800">
            <ArrowDown className="h-3.5 w-3.5" />
            Menor cobertura
          </div>
          <p className="text-lg font-bold text-sky-950">{stats.diaMenor.clave}</p>
          <p className="text-[11px] text-sky-800/80">
            {stats.diaMenor.label} · {stats.diaMenor.total} plazas
          </p>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
        <div className="mb-3 flex items-center gap-1.5 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          <BarChart3 className="h-3.5 w-3.5" />
          Carga por turno (semana)
        </div>
        <div className="space-y-3">
          {TURNO_META.map(({ clave, label, icon: Icon, color }) => {
            const valor = stats.porTurnoSemana[clave]
            const pct =
              stats.maxTurnoSemana > 0
                ? Math.round((valor / stats.maxTurnoSemana) * 100)
                : 0
            return (
              <div key={clave}>
                <div className="mb-1 flex items-center justify-between text-xs">
                  <span className="flex items-center gap-1.5 font-medium text-slate-700">
                    <Icon className="h-3.5 w-3.5 text-slate-500" />
                    {label}
                  </span>
                  <span className="font-bold tabular-nums text-slate-900">
                    {valor}
                  </span>
                </div>
                <div className="h-2 overflow-hidden rounded-full bg-slate-100">
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

      <div className="rounded-xl border border-slate-200 bg-slate-50 p-3">
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-wide text-slate-500">
          Totales por día
        </p>
        <div className="flex flex-wrap gap-1.5">
          {stats.porDia.map((dia) => (
            <div
              key={dia.dia}
              className="min-w-[3.25rem] rounded-lg border border-slate-200 bg-white px-2 py-1 text-center"
            >
              <div className="text-[10px] font-semibold text-slate-500">
                {dia.clave}
              </div>
              <div className="text-sm font-bold tabular-nums text-slate-900">
                {dia.total}
              </div>
            </div>
          ))}
        </div>
      </div>
    </aside>
  )
}
