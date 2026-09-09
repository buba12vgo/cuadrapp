import { Briefcase, Hash, Shield } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import { KpiCard, KpiGrid2, KpiHighlight } from '@/components/ui/DashboardKpi'
import {
  normalizarAmbitoPuesto,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'

export function PuestosResumenPanel({ puestos }: { puestos: PuestoConfig[] }) {
  const operativos = puestos.filter(
    (p) => normalizarAmbitoPuesto(p.ambito) === 'OPERATIVO',
  ).length
  const jefes = puestos.filter(
    (p) => normalizarAmbitoPuesto(p.ambito) === 'JEFE_SERVICIO',
  ).length
  const abrevs = puestos.map((p) => p.abreviatura.length)
  const mediaAbrev =
    abrevs.length > 0
      ? (abrevs.reduce((s, n) => s + n, 0) / abrevs.length).toFixed(1)
      : '0'

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={Briefcase} label="Operativo" value={operativos} />
        <KpiCard icon={Shield} label="Jefes" value={jefes} />
      </KpiGrid2>
      <KpiCard icon={Hash} label="Abrev. media" value={mediaAbrev} />
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
