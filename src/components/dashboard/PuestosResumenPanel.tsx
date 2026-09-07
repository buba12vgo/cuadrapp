import { Briefcase, Hash } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import { KpiCard, KpiGrid2, KpiHighlight } from '@/components/ui/DashboardKpi'
import type { PuestoConfig } from '@/lib/calendarioPuestos'

export function PuestosResumenPanel({ puestos }: { puestos: PuestoConfig[] }) {
  const abrevs = puestos.map((p) => p.abreviatura.length)
  const mediaAbrev =
    abrevs.length > 0
      ? (abrevs.reduce((s, n) => s + n, 0) / abrevs.length).toFixed(1)
      : '0'

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={Briefcase} label="Puestos" value={puestos.length} />
        <KpiCard icon={Hash} label="Abrev. media" value={mediaAbrev} />
      </KpiGrid2>
      {puestos.length > 0 ? (
        <KpiHighlight
          variant="sky"
          label="Último"
          title={puestos[puestos.length - 1]?.abreviatura ?? '—'}
          subtitle={puestos[puestos.length - 1]?.nombre}
        />
      ) : null}
    </DashboardSidebar>
  )
}
