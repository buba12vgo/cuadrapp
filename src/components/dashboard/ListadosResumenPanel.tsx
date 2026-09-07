import { Coins, Users } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import {
  KpiBarRow,
  KpiCard,
  KpiGrid2,
  KpiSection,
} from '@/components/ui/DashboardKpi'
import {
  ETIQUETA_VARIABLE_COBRO,
  TIPOS_VARIABLE_COBRO,
  type ConteoVariablesCobro,
} from '@/lib/variablesCobro'

type Props = {
  agentesCount: number
  totales: ConteoVariablesCobro
}

export function ListadosResumenPanel({ agentesCount, totales }: Props) {
  const granTotal = Object.values(totales).reduce((s, n) => s + n, 0)
  const maxTipo = Math.max(1, ...TIPOS_VARIABLE_COBRO.map((t) => totales[t]))

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={Users} label="Agentes" value={agentesCount} />
        <KpiCard icon={Coins} label="Variables" value={granTotal} />
      </KpiGrid2>
      <KpiSection title="Por tipo">
        <div className="space-y-1.5">
          {TIPOS_VARIABLE_COBRO.map((tipo) => (
            <KpiBarRow
              key={tipo}
              label={ETIQUETA_VARIABLE_COBRO[tipo].split(' ')[0]}
              value={totales[tipo]}
              max={maxTipo}
              color="bg-emerald-400"
            />
          ))}
        </div>
      </KpiSection>
    </DashboardSidebar>
  )
}
