import { CollapsibleNotice } from '@/components/ui/CollapsibleNotice'
import { KpiSection } from '@/components/ui/DashboardKpi'
import { esSinPreferencia } from '@/lib/preferenciasAnuales'
import type { MarcasPlanAnual } from '@/lib/generarPlanAnual'
import type { FichaPolicia } from '@/types'

const MESES = [
  'Ene',
  'Feb',
  'Mar',
  'Abr',
  'May',
  'Jun',
  'Jul',
  'Ago',
  'Sep',
  'Oct',
  'Nov',
  'Dic',
]

type Props = {
  marcas: MarcasPlanAnual
  agentes: FichaPolicia[]
}

export function PlanAnualAvisosPanel({ marcas, agentes }: Props) {
  const cuadrado =
    marcas.anioCuadra &&
    marcas.mesesSinCuadrar.length === 0 &&
    marcas.agentesSinCuadrar.length === 0

  const summary = cuadrado
    ? 'Plan cuadrado (% global, meses y patrones).'
    : [
        marcas.preferenciasIncompatibles
          ? 'Plantilla no alcanza el % global.'
          : !marcas.anioCuadra
            ? 'No se ha podido cuadrar el % anual.'
            : 'Revisar marcas del plan.',
        marcas.mesesSinCuadrar.length > 0
          ? `${marcas.mesesSinCuadrar.length} mes(es) sin cuadrar.`
          : null,
        marcas.agentesSinCuadrar.length > 0
          ? `${marcas.agentesSinCuadrar.length} ficha(s) sin la frecuencia de la ficha.`
          : null,
      ]
        .filter(Boolean)
        .join(' ')

  return (
    <KpiSection title="Avisos">
      <CollapsibleNotice
        tone={cuadrado ? 'success' : 'warn'}
        defaultOpen={!cuadrado}
        summary={summary}
      >
        {marcas.preferenciasIncompatibles ? (
          <p>
            La plantilla no alcanza el % global del selector
            {marcas.pctAnio
              ? ` (real ≈ ${marcas.pctAnio.M.toFixed(1)}/${marcas.pctAnio.T.toFixed(1)}/${marcas.pctAnio.N.toFixed(1)}%). Ajusta M/T/N en Agentes.`
              : '. Ajusta M/T/N en Agentes.'}
          </p>
        ) : null}
        {!marcas.anioCuadra && !marcas.preferenciasIncompatibles ? (
          <p>
            No se ha podido cuadrar el % anual con la plantilla
            {marcas.pctAnio
              ? ` (queda ${marcas.pctAnio.M.toFixed(1)}/${marcas.pctAnio.T.toFixed(1)}/${marcas.pctAnio.N.toFixed(1)}%).`
              : '.'}
          </p>
        ) : null}
        {marcas.mesesSinCuadrar.length > 0 ? (
          <p>
            Meses sin cuadrar:{' '}
            <span className="font-semibold">
              {marcas.mesesSinCuadrar.map((m) => MESES[m]).join(', ')}
            </span>
            . Marcados en cabecera.
          </p>
        ) : null}
        {marcas.agentesSinCuadrar.length > 0 ? (
          <p>
            Fichas con infracciones o con una frecuencia distinta a la de la ficha:{' '}
            <span className="font-semibold">
              {marcas.agentesSinCuadrar
                .map((id) => {
                  const agente = agentes.find((a) => a.id === id)
                  const flex = agente
                    ? esSinPreferencia(agente.preferenciaAnual)
                    : false
                  return agente
                    ? `${agente.numeroPlaca} ${agente.nombre}${flex ? ' (Flex)' : ''}`
                    : id
                })
                .join(', ')}
            </span>
            . Marcadas a la izquierda; columna Pat indica el patrón.
          </p>
        ) : null}
        <p className="text-slate-600">
          La frecuencia de la ficha se mantiene. Si no se puede colocar, los
          totales y Pat salen en rojo.{' '}
          <span className="font-semibold text-violet-700">Flex</span> = sin
          preferencia.
        </p>
      </CollapsibleNotice>
    </KpiSection>
  )
}
