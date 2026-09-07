import { Users, Shield, UserCog } from 'lucide-react'
import {
  DashboardSidebar,
} from '@/components/ui/DashboardLayout'
import {
  KpiBarRow,
  KpiCard,
  KpiGrid2,
  KpiSection,
} from '@/components/ui/DashboardKpi'
import type { RolPolicia } from '@/types'
import type { FichaPolicia } from '@/types'

const ROL_LABEL: Record<RolPolicia, string> = {
  RESPONSABLE: 'Responsable',
  JEFE_SERVICIO: 'Jefe serv.',
  JEFE_EQUIPO: 'Jefe eq.',
  POLICIA: 'Policía',
  POLICIA_BOLSA: 'Bolsa',
}

const ROLES: RolPolicia[] = [
  'POLICIA',
  'POLICIA_BOLSA',
  'JEFE_EQUIPO',
  'JEFE_SERVICIO',
  'RESPONSABLE',
]

export function AgentesResumenPanel({ agentes }: { agentes: FichaPolicia[] }) {
  const porRol = ROLES.map((rol) => ({
    rol,
    count: agentes.filter((a) => a.rolBase === rol).length,
  }))
  const maxRol = Math.max(1, ...porRol.map((r) => r.count))
  const operativos = agentes.filter(
    (a) => a.rolBase === 'POLICIA' || a.rolBase === 'JEFE_EQUIPO',
  ).length

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={Users} label="Plantilla" value={agentes.length} />
        <KpiCard icon={Shield} label="Operativos" value={operativos} />
      </KpiGrid2>
      <KpiSection icon={UserCog} title="Por rol">
        <div className="space-y-1.5">
          {porRol.map(({ rol, count }) => (
            <KpiBarRow
              key={rol}
              label={ROL_LABEL[rol]}
              value={count}
              max={maxRol}
              color="bg-slate-500"
            />
          ))}
        </div>
      </KpiSection>
    </DashboardSidebar>
  )
}
