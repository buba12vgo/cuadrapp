import { CalendarRange, Users } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import { KpiCard, KpiGrid2, KpiHighlight } from '@/components/ui/DashboardKpi'

type Props = {
  agentesVisibles: number
  diaDesde: number
  diaHasta: number
  nDias: number
  guardado: boolean
}

export function CuadranteResumenPanel({
  agentesVisibles,
  diaDesde,
  diaHasta,
  nDias,
  guardado,
}: Props) {
  const diasRango = Math.max(0, diaHasta - diaDesde + 1)

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={Users} label="Agentes" value={agentesVisibles} />
        <KpiCard icon={CalendarRange} label="Días" value={diasRango} />
      </KpiGrid2>
      <KpiGrid2>
        <KpiHighlight
          variant={guardado ? 'emerald' : 'amber'}
          label="Firestore"
          title={guardado ? 'Guardado' : 'Sin guardar'}
        />
        <KpiHighlight
          variant="sky"
          label="Mes"
          title={`${diaDesde}–${diaHasta}`}
          subtitle={`de ${nDias}`}
        />
      </KpiGrid2>
    </DashboardSidebar>
  )
}
