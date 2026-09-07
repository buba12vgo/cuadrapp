import { AlertTriangle, CheckCircle2, Users } from 'lucide-react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import {
  KpiBarRow,
  KpiCard,
  KpiGrid2,
  KpiHighlight,
  KpiProgress,
  KpiSection,
} from '@/components/ui/DashboardKpi'
import type { MarcasPlanAnual, ObjetivosGlobales } from '@/lib/generarPlanAnual'

type Props = {
  agentesCount: number
  objetivos: ObjetivosGlobales
  marcas: MarcasPlanAnual | null
  hayPlan: boolean
}

export function PlanAnualResumenPanel({
  agentesCount,
  objetivos,
  marcas,
  hayPlan,
}: Props) {
  const cuadrado =
    hayPlan &&
    marcas?.anioCuadra &&
    (marcas.mesesSinCuadrar.length ?? 0) === 0 &&
    (marcas.agentesSinCuadrar.length ?? 0) === 0

  const pctReal = marcas?.pctAnio

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={Users} label="Vista" value={agentesCount} />
        <KpiCard
          icon={cuadrado ? CheckCircle2 : AlertTriangle}
          label="Estado"
          value={cuadrado ? 'OK' : hayPlan ? 'Rev.' : '—'}
        />
      </KpiGrid2>
      {marcas && hayPlan ? (
        <>
          <KpiProgress
            label="Cuadre anual"
            value={
              marcas.mesesSinCuadrar.length === 0 &&
              marcas.agentesSinCuadrar.length === 0
                ? 'Cuadrado'
                : `${marcas.mesesSinCuadrar.length} mes · ${marcas.agentesSinCuadrar.length} ag.`
            }
            pct={
              cuadrado
                ? 100
                : Math.max(
                    0,
                    100 -
                      marcas.mesesSinCuadrar.length * 8 -
                      marcas.agentesSinCuadrar.length * 2,
                  )
            }
            ok={cuadrado}
          />
          {pctReal ? (
            <KpiSection title="Real % anual">
              <div className="space-y-1.5">
                {(['M', 'T', 'N'] as const).map((turno) => (
                  <KpiBarRow
                    key={turno}
                    label={turno}
                    value={Math.round(pctReal[turno])}
                    max={100}
                    color={
                      Math.abs(pctReal[turno] - objetivos[turno]) <= 3
                        ? 'bg-emerald-400'
                        : 'bg-amber-400'
                    }
                  />
                ))}
              </div>
            </KpiSection>
          ) : null}
        </>
      ) : null}
      <KpiGrid2>
        {(['M', 'T', 'N'] as const).map((turno) => (
          <KpiHighlight
            key={turno}
            variant="sky"
            label={`Obj. ${turno}`}
            title={`${objetivos[turno]}%`}
          />
        ))}
      </KpiGrid2>
    </DashboardSidebar>
  )
}
