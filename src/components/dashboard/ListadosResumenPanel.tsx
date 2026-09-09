import { Coins, Users } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import {
  KpiBarRow,
  KpiCard,
  KpiGrid2,
  KpiSection,
} from '@/components/ui/DashboardKpi'
import {
  ETIQUETA_CORTA_VARIABLE_COBRO,
  ETIQUETA_VARIABLE_COBRO,
  TIPOS_VARIABLE_COBRO,
  type ConteoVariablesCobro,
  type TipoVariableCobro,
} from '@/lib/variablesCobro'
import { PAGE_SUBTITLE } from '@/lib/uiStyles'

type Props = {
  agentesCount: number
  totales: ConteoVariablesCobro
}

const COLOR_BARRA: Record<TipoVariableCobro, string> = {
  conciliacion_viernes_noche: 'bg-violet-500',
  conciliacion_sabado_manana: 'bg-sky-500',
  conciliacion_sabado_tarde: 'bg-orange-400',
  festivo: 'bg-emerald-500',
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
              label={ETIQUETA_CORTA_VARIABLE_COBRO[tipo]}
              value={totales[tipo]}
              max={maxTipo}
              color={COLOR_BARRA[tipo]}
            />
          ))}
        </div>
        <ul className="mt-2 space-y-0.5 text-[10px] leading-snug text-slate-500">
          <li>
            <span className="font-semibold text-violet-700">VN</span> ·{' '}
            {ETIQUETA_VARIABLE_COBRO.conciliacion_viernes_noche}
          </li>
          <li>
            <span className="font-semibold text-sky-700">SM</span> ·{' '}
            {ETIQUETA_VARIABLE_COBRO.conciliacion_sabado_manana}
          </li>
          <li>
            <span className="font-semibold text-orange-700">ST</span> ·{' '}
            {ETIQUETA_VARIABLE_COBRO.conciliacion_sabado_tarde}
          </li>
        </ul>
      </KpiSection>
      <KpiSection title="Notas">
        <p className={PAGE_SUBTITLE}>
          Conciliaciones y festivo son compatibles (ej. sábado festivo con M →
          conciliación SM + festivo). Noche sábado con domingo festivo suma
          festivo por el tramo 22–06 en domingo si ese día no se cobró ya.
        </p>
      </KpiSection>
    </DashboardSidebar>
  )
}
