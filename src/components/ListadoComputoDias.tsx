import { useMemo } from 'react'
import {
  JORNADAS_ANUALES_REFERENCIA,
  type ComputoDiasTrabajados,
} from '@/lib/computoDiasTrabajados'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import { TABLE, TD, TH } from '@/lib/uiStyles'
import type { FichaPolicia } from '@/types'

function textoDiferencia(valor: number) {
  if (valor > 0) return `+${valor}`
  return String(valor)
}

function claseDiferencia(valor: number) {
  if (valor > 0) return 'font-semibold text-emerald-800'
  if (valor < 0) return 'font-semibold text-amber-800'
  return 'font-semibold text-slate-600'
}

export function ListadoComputoDias({
  agentes,
  computos,
  loading,
  anio,
  vistaPrevia,
}: {
  agentes: FichaPolicia[]
  computos: Record<string, ComputoDiasTrabajados>
  loading: boolean
  anio: number
  vistaPrevia?: boolean
}) {
  const totales = useMemo(() => {
    const suma = { trabajados: 0, permisos: 0, total: 0, diferencia: 0 }
    for (const agente of agentes) {
      const computo = computos[agente.id]
      if (!computo) continue
      suma.trabajados += computo.trabajados
      suma.permisos += computo.permisos
      suma.total += computo.total
      suma.diferencia += computo.diferencia
    }
    return suma
  }, [agentes, computos])

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2">
      <p className="text-xs text-slate-500">
        {anio}: cada turno M, T o N cuenta 1 jornada y M-T cuenta 2. Un permiso
        cuenta 1 solo si su tipo está marcado como día de trabajo. Vacaciones y
        descansos no entran. La diferencia es el cómputo menos{' '}
        {JORNADAS_ANUALES_REFERENCIA}.
        {vistaPrevia
          ? ' Vista previa con un cuadrante de ejemplo, sin datos guardados.'
          : ' Solo entran los meses con cuadrante guardado.'}
      </p>
      <div className="min-h-0 flex-1 overflow-auto rounded-2xl bg-white shadow-sm">
        <table className={TABLE}>
          <caption className="sr-only">
            Cómputo de días trabajados de {anio}. Referencia{' '}
            {JORNADAS_ANUALES_REFERENCIA} jornadas.
          </caption>
          <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
            <tr>
              <th className={`${TH} sticky left-0 z-20 bg-slate-50/95`}>Placa</th>
              <th className={TH}>Nombre</th>
              <th className={`${TH} text-center`} title="M, T y N = 1. M-T = 2.">
                Trabajados
              </th>
              <th
                className={`${TH} text-center`}
                title="Días de permiso cuyo tipo suma como día de trabajo."
              >
                Permisos
              </th>
              <th className={`${TH} text-center`} title="Trabajados + permisos">
                Cómputo
              </th>
              <th
                className={`${TH} text-center`}
                title={`Cómputo menos ${JORNADAS_ANUALES_REFERENCIA}`}
              >
                Diferencia
              </th>
            </tr>
          </thead>
          <tbody>
            {loading ? (
              <tr>
                <td colSpan={6} className={`${TD} py-6 text-center text-slate-500`}>
                  Calculando el cómputo de {anio}…
                </td>
              </tr>
            ) : agentes.length === 0 ? (
              <tr>
                <td colSpan={6} className={`${TD} py-6 text-center text-slate-500`}>
                  Ningún agente coincide.
                </td>
              </tr>
            ) : (
              agentes.map((agente) => {
                const computo = computos[agente.id]
                const diferencia = computo?.diferencia ?? -JORNADAS_ANUALES_REFERENCIA
                return (
                  <tr key={agente.id} className="hover:bg-slate-50/70">
                    <td
                      className={`${TD} sticky left-0 z-10 bg-white font-mono tabular-nums text-slate-600`}
                    >
                      {agente.numeroPlaca}
                    </td>
                    <td className={TD}>
                      <span className="block font-medium text-ink">
                        {agente.nombre} {agente.apellidos}
                      </span>
                      <span className="block text-[11px] font-semibold text-slate-500">
                        {ROL_LABEL[agente.rolBase]}
                      </span>
                    </td>
                    <td className={`${TD} text-center tabular-nums`}>
                      {computo?.trabajados ?? 0}
                    </td>
                    <td className={`${TD} text-center tabular-nums`}>
                      {computo?.permisos ?? 0}
                    </td>
                    <td className={`${TD} text-center font-bold tabular-nums text-ink`}>
                      {computo?.total ?? 0}
                    </td>
                    <td
                      className={`${TD} text-center tabular-nums ${claseDiferencia(diferencia)}`}
                    >
                      {textoDiferencia(diferencia)}
                    </td>
                  </tr>
                )
              })
            )}
          </tbody>
          {!loading && agentes.length > 0 ? (
            <tfoot>
              <tr className="bg-slate-50 font-bold">
                <td
                  className={`${TD} sticky left-0 z-10 border-t border-line bg-slate-50`}
                  colSpan={2}
                >
                  TOTAL · ref. {JORNADAS_ANUALES_REFERENCIA} × {agentes.length}
                </td>
                <td className={`${TD} border-t border-line text-center tabular-nums`}>
                  {totales.trabajados}
                </td>
                <td className={`${TD} border-t border-line text-center tabular-nums`}>
                  {totales.permisos}
                </td>
                <td className={`${TD} border-t border-line text-center tabular-nums`}>
                  {totales.total}
                </td>
                <td
                  className={`${TD} border-t border-line text-center tabular-nums ${claseDiferencia(totales.diferencia)}`}
                >
                  {textoDiferencia(totales.diferencia)}
                </td>
              </tr>
            </tfoot>
          ) : null}
        </table>
      </div>
    </div>
  )
}
