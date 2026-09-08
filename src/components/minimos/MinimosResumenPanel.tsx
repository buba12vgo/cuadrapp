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
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import {
  KpiBarRow,
  KpiCard,
  KpiChipGrid,
  KpiGrid2,
  KpiHighlight,
  KpiProgress,
  KpiSection,
} from '@/components/ui/DashboardKpi'
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
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={CalendarRange} label="Semana" value={stats.totalSemanal} />
        <KpiCard icon={Users} label="Plantilla" value={plantillaOperativa} />
      </KpiGrid2>

      <KpiProgress
        label="Pico turno"
        value={stats.picoTurno}
        pct={coberturaPct}
        ok={coberturaOk}
      />

      <KpiGrid2>
        <KpiHighlight
          variant="emerald"
          icon={ArrowUp}
          label="Máx"
          title={stats.diaMayor.clave}
          subtitle={stats.diaMayor.total}
        />
        <KpiHighlight
          variant="sky"
          icon={ArrowDown}
          label="Mín"
          title={stats.diaMenor.clave}
          subtitle={stats.diaMenor.total}
        />
      </KpiGrid2>

      <KpiSection icon={BarChart3} title="Por turno">
        <div className="space-y-1.5">
          {TURNO_META.map(({ clave, label, icon: Icon, color }) => (
            <KpiBarRow
              key={clave}
              icon={Icon}
              label={label}
              value={stats.porTurnoSemana[clave]}
              max={stats.maxTurnoSemana}
              color={color}
            />
          ))}
        </div>
      </KpiSection>

      <div className="rounded-lg border border-slate-200 bg-slate-50 p-2">
        <p className="mb-1 text-sm font-semibold uppercase tracking-wide text-slate-500">
          Por día
        </p>
        <KpiChipGrid
          items={stats.porDia.map((dia) => ({
            clave: dia.clave,
            total: dia.total,
          }))}
        />
      </div>
    </DashboardSidebar>
  )
}
