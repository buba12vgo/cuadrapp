import { BookOpen, CheckCircle2, Clock, Layers } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import {
  KpiBarRow,
  KpiCard,
  KpiGrid2,
  KpiHighlight,
  KpiProgress,
  KpiSection,
} from '@/components/ui/DashboardKpi'
import {
  CATEGORIA_LABEL,
  ORDEN_CATEGORIAS,
  reglasPorCategoria,
  type EstadoRegla,
} from '@/lib/reglasCatalogo'

export function ReglasResumenPanel() {
  const agrupadas = reglasPorCategoria()
  const todas = [...agrupadas.values()].flat()
  const total = todas.length
  const porEstado: Record<EstadoRegla, number> = {
    implementada: 0,
    parcial: 0,
    planificada: 0,
  }
  for (const regla of todas) porEstado[regla.estado] += 1
  const pctImpl = total > 0 ? Math.round((porEstado.implementada / total) * 100) : 0

  const porCategoria = ORDEN_CATEGORIAS
    .map((cat) => ({
      cat,
      count: (agrupadas.get(cat) ?? []).length,
    }))
    .filter((c) => c.count > 0)
  const maxCat = Math.max(1, ...porCategoria.map((c) => c.count))

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={BookOpen} label="Reglas" value={total} />
        <KpiCard icon={CheckCircle2} label="Hechas" value={porEstado.implementada} />
      </KpiGrid2>
      <KpiProgress
        label="Implementación"
        value={`${porEstado.implementada}/${total}`}
        pct={pctImpl}
        ok={pctImpl >= 70}
      />
      <KpiGrid2>
        <KpiHighlight
          variant="emerald"
          icon={CheckCircle2}
          label="OK"
          title={porEstado.implementada}
        />
        <KpiHighlight
          variant="amber"
          icon={Clock}
          label="Parcial"
          title={porEstado.parcial}
        />
        <KpiHighlight
          variant="sky"
          icon={Layers}
          label="Plan."
          title={porEstado.planificada}
        />
      </KpiGrid2>
      <KpiSection title="Por categoría">
        <div className="space-y-1.5">
          {porCategoria.map(({ cat, count }) => (
            <KpiBarRow
              key={cat}
              label={CATEGORIA_LABEL[cat].split(' ')[0]}
              value={count}
              max={maxCat}
              color="bg-indigo-400"
            />
          ))}
        </div>
      </KpiSection>
    </DashboardSidebar>
  )
}
