import { useEffect, useMemo, useState } from 'react'
import { ListadosResumenPanel } from '@/components/dashboard/ListadosResumenPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
} from '@/components/ui/DashboardLayout'
import { PageHeader, ToolbarDivider, ToolbarSection } from '@/components/ui/PageHeader'
import {
  ALERT_ERROR,
  ALERT_INFO,
  ALERT_WARN,
  BTN_SECONDARY,
  FOCUS_RING,
  PAGE_SECTION,
  TABLE,
  TD,
  TH,
} from '@/lib/uiStyles'
import { useAgentesData } from '@/lib/agentesStore'
import { cuadranteDesdeFirestore } from '@/lib/cuadranteFirestore'
import { diasDelMes } from '@/lib/convenio'
import { getCuadrante } from '@/lib/db'
import { exportarVariablesCobroExcel } from '@/lib/exportarVariablesCobroExcel'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { useEventosData } from '@/lib/eventosStore'
import { ensureFirebase } from '@/lib/firebase'
import { isDesignPreview } from '@/lib/designPreview'
import {
  ABREV_VARIABLE_COBRO,
  contarVariablesCobroAgente,
  conteoVariablesCobroVacio,
  ETIQUETA_VARIABLE_COBRO,
  TIPOS_VARIABLE_COBRO,
  totalVariablesCobro,
} from '@/lib/variablesCobro'
import type { RolPolicia } from '@/types'
import {
  ROLES_OPERATIVO_CUADRANTE,
  ROL_LABEL,
  esRolOperativoCuadrante,
} from '@/lib/rolesCuadrante'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

const ROLES = ROLES_OPERATIVO_CUADRANTE

const CAMPO_TOOLBAR =
  'h-7 rounded-md border border-line bg-white px-1.5 text-xs text-ink outline-none focus:border-brand-400 focus-visible:ring-2 focus-visible:ring-brand-500/40'

export function ListadosPage() {
  const [agentesData] = useAgentesData()
  const [eventosData] = useEventosData()
  const anioActual = new Date().getFullYear()
  const [anio, setAnio] = useState(anioActual)
  const [mes, setMes] = useState(new Date().getMonth() + 1)
  const [rolFiltro, setRolFiltro] = useState<'TODOS' | RolPolicia>('TODOS')
  const [loading, setLoading] = useState(true)
  const [error, setError] = useState<string | null>(null)
  const [cuadrante, setCuadrante] = useState<CuadranteMensual>({})

  const nDias = diasDelMes(anio, mes)

  const agentesVisibles = useMemo(() => {
    const lista = agentesData.filter((agente) => {
      if (!esRolOperativoCuadrante(agente.rolBase)) return false
      if (rolFiltro !== 'TODOS' && agente.rolBase !== rolFiltro) return false
      return true
    })
    return [...lista].sort((a, b) =>
      a.numeroPlaca.localeCompare(b.numeroPlaca, undefined, { numeric: true }),
    )
  }, [agentesData, rolFiltro])

  useEffect(() => {
    let cancelado = false

    async function cargar() {
      setLoading(true)
      setError(null)
      setCuadrante({})

      if (isDesignPreview) {
        setLoading(false)
        return
      }

      const ready = await ensureFirebase()
      if (cancelado) return
      if (!ready) {
        setError('Firebase no configurado.')
        setLoading(false)
        return
      }

      try {
        const datos = await getCuadrante(mes, anio)
        if (cancelado) return
        if (datos && agentesData.length > 0) {
          const { cuadrante: cargado } = cuadranteDesdeFirestore(
            datos,
            agentesData,
            anio,
            mes,
            nDias,
          )
          setCuadrante(cargado)
        }
      } catch (err) {
        if (!cancelado) {
          setError(
            err instanceof Error
              ? err.message
              : 'No se pudo cargar el cuadrante',
          )
        }
      } finally {
        if (!cancelado) setLoading(false)
      }
    }

    void cargar()
    return () => {
      cancelado = true
    }
  }, [anio, mes, nDias, agentesData])

  const conteos = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof contarVariablesCobroAgente>> =
      {}
    for (const agente of agentesVisibles) {
      const fila = cuadrante[agente.id] ?? []
      mapa[agente.id] = contarVariablesCobroAgente(
        fila,
        anio,
        mes,
        eventosData,
      )
    }
    return mapa
  }, [agentesVisibles, cuadrante, anio, mes, eventosData])

  const totalesColumna = useMemo(() => {
    const totales = conteoVariablesCobroVacio()
    for (const agente of agentesVisibles) {
      const conteo = conteos[agente.id]
      if (!conteo) continue
      for (const tipo of TIPOS_VARIABLE_COBRO) {
        totales[tipo] += conteo[tipo]
      }
    }
    return totales
  }, [agentesVisibles, conteos])

  const hayCuadrante = Object.keys(cuadrante).length > 0
  const granTotal = Object.values(totalesColumna).reduce((s, n) => s + n, 0)

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Listados · variables de cobro"
        subtitle="Conciliaciones de finde y festivos por policía (mes vencido)"
        actions={
          <button
            type="button"
            className={BTN_SECONDARY}
            disabled={!hayCuadrante || agentesVisibles.length === 0}
            onClick={() =>
              exportarVariablesCobroExcel({
                anio,
                mes,
                agentes: agentesVisibles,
                conteos,
              })
            }
          >
            Exportar Excel
          </button>
        }
        toolbar={
          <>
            <ToolbarSection label="Periodo">
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Año</span>
                <select
                  className={`${CAMPO_TOOLBAR} min-w-[5.25rem] pr-6 ${FOCUS_RING}`}
                  value={anio}
                  onChange={(e) => setAnio(Number(e.target.value) || anio)}
                >
                  {Array.from({ length: 11 }, (_, i) => 2020 + i).map((valor) => (
                    <option key={valor} value={valor}>
                      {valor}
                    </option>
                  ))}
                </select>
              </label>
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Mes</span>
                <select
                  className={CAMPO_TOOLBAR}
                  value={mes}
                  onChange={(e) => setMes(Number(e.target.value) || mes)}
                >
                  {MESES.map((nombre, indice) => (
                    <option key={nombre} value={indice + 1}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>
            </ToolbarSection>
            <ToolbarDivider />
            <ToolbarSection label="Filtros">
              <label className="flex items-center gap-1">
                <span className="text-xs font-medium text-slate-600">Rol</span>
                <select
                  className={CAMPO_TOOLBAR}
                  value={rolFiltro}
                  onChange={(e) =>
                    setRolFiltro(e.target.value as 'TODOS' | RolPolicia)
                  }
                >
                  <option value="TODOS">Todos</option>
                  {ROLES.map((rol) => (
                    <option key={rol} value={rol}>
                      {ROL_LABEL[rol]}
                    </option>
                  ))}
                </select>
              </label>
            </ToolbarSection>
          </>
        }
      />

      {error ? <p className={ALERT_ERROR}>{error}</p> : null}

      {loading ? (
        <p className={ALERT_INFO}>
          Cargando cuadrante de {MESES[mes - 1]} {anio}…
        </p>
      ) : null}

      {!loading && !hayCuadrante ? (
        <p className={ALERT_WARN}>
          No hay cuadrante guardado para {MESES[mes - 1]} {anio}. Las variables
          salen en cero hasta que exista cuadrante mensual.
        </p>
      ) : null}

      <DashboardBody>
        <DashboardMain>
          <DashboardMainScroll className="p-1.5">
            <table className={TABLE}>
              <thead className="sticky top-0 z-10 bg-slate-50/95 backdrop-blur-sm">
                <tr>
                  <th className={`${TH} sticky left-0 z-20 bg-slate-50/95`}>
                    Placa
                  </th>
                  <th className={TH}>Nombre</th>
                  {TIPOS_VARIABLE_COBRO.map((tipo) => (
                    <th
                      key={tipo}
                      className={`${TH} text-center`}
                      title={ETIQUETA_VARIABLE_COBRO[tipo]}
                    >
                      {ABREV_VARIABLE_COBRO[tipo]}
                    </th>
                  ))}
                  <th className={`${TH} text-center`}>Total</th>
                </tr>
              </thead>
              <tbody>
                {agentesVisibles.length === 0 ? (
                  <tr>
                    <td
                      colSpan={3 + TIPOS_VARIABLE_COBRO.length}
                      className={`${TD} py-6 text-center text-slate-500`}
                    >
                      No hay agentes en la vista.
                    </td>
                  </tr>
                ) : (
                  agentesVisibles.map((agente) => {
                    const conteo = conteos[agente.id]
                    const total = conteo ? totalVariablesCobro(conteo) : 0
                    return (
                      <tr key={agente.id} className="hover:bg-slate-50/70">
                        <td
                          className={`${TD} sticky left-0 z-10 bg-white font-mono tabular-nums text-slate-600`}
                        >
                          {agente.numeroPlaca}
                        </td>
                        <td className={`${TD} font-medium text-ink`}>
                          {agente.nombre} {agente.apellidos}
                        </td>
                        {TIPOS_VARIABLE_COBRO.map((tipo) => {
                          const valor = conteo?.[tipo] ?? 0
                          return (
                            <td
                              key={tipo}
                              className={`${TD} text-center tabular-nums ${
                                valor > 0
                                  ? 'bg-emerald-50 font-semibold text-emerald-900'
                                  : 'text-slate-500'
                              }`}
                            >
                              {valor}
                            </td>
                          )
                        })}
                        <td
                          className={`${TD} text-center font-bold tabular-nums text-ink`}
                        >
                          {total}
                        </td>
                      </tr>
                    )
                  })
                )}
              </tbody>
              <tfoot>
                <tr className="bg-slate-50 font-bold">
                  <td
                    className={`${TD} sticky left-0 z-10 border-t border-line bg-slate-50 text-left`}
                    colSpan={2}
                  >
                    TOTAL
                  </td>
                  {TIPOS_VARIABLE_COBRO.map((tipo) => (
                    <td
                      key={tipo}
                      className={`${TD} border-t border-line text-center tabular-nums`}
                    >
                      {totalesColumna[tipo]}
                    </td>
                  ))}
                  <td
                    className={`${TD} border-t border-line text-center tabular-nums`}
                  >
                    {granTotal}
                  </td>
                </tr>
              </tfoot>
            </table>
          </DashboardMainScroll>
        </DashboardMain>
        <ListadosResumenPanel
          agentesCount={agentesVisibles.length}
          totales={totalesColumna}
        />
      </DashboardBody>
    </section>
  )
}
