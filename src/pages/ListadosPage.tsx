import { useEffect, useMemo, useState } from 'react'
import { ListadosResumenPanel } from '@/components/dashboard/ListadosResumenPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
} from '@/components/ui/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import {
  ALERT_ERROR,
  ALERT_INFO,
  ALERT_WARN,
  BTN_SECONDARY,
  CAMPO,
  PAGE_SECTION,
  PAGE_SUBTITLE,
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
import {
  contarVariablesCobroAgente,
  conteoVariablesCobroVacio,
  ETIQUETA_VARIABLE_COBRO,
  TIPOS_VARIABLE_COBRO,
  totalVariablesCobro,
} from '@/lib/variablesCobro'
import type { RolPolicia } from '@/types'

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

const ROLES: RolPolicia[] = [
  'RESPONSABLE',
  'JEFE_SERVICIO',
  'JEFE_EQUIPO',
  'POLICIA',
  'POLICIA_BOLSA',
]

const ROL_LABEL: Record<RolPolicia, string> = {
  RESPONSABLE: 'Responsable',
  JEFE_SERVICIO: 'Jefe de servicio',
  JEFE_EQUIPO: 'Jefe de equipo',
  POLICIA: 'Policía',
  POLICIA_BOLSA: 'Policía Bolsa',
}

const CELDA = `${TD} border-slate-200 text-center tabular-nums leading-tight`

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

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Listados · variables de cobro"
        subtitle="Conciliaciones de finde y festivos por policía (mes vencido)"
        actions={
          <>
            <label className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-600">Año</span>
              <select
                className={CAMPO}
                value={anio}
                onChange={(e) => setAnio(Number(e.target.value) || anio)}
              >
                {Array.from({ length: 11 }, (_, i) => 2020 + i).map((valor) => (
                  <option key={valor} value={valor}>{valor}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-600">Mes</span>
              <select
                className={CAMPO}
                value={mes}
                onChange={(e) => setMes(Number(e.target.value) || mes)}
              >
                {MESES.map((nombre, indice) => (
                  <option key={nombre} value={indice + 1}>{nombre}</option>
                ))}
              </select>
            </label>
            <label className="flex items-center gap-1">
              <span className="text-[10px] font-semibold text-slate-600">Rol</span>
              <select
                className={CAMPO}
                value={rolFiltro}
                onChange={(e) =>
                  setRolFiltro(e.target.value as 'TODOS' | RolPolicia)
                }
              >
                <option value="TODOS">Todos</option>
                {ROLES.map((rol) => (
                  <option key={rol} value={rol}>{ROL_LABEL[rol]}</option>
                ))}
              </select>
            </label>
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
          <DashboardMainScroll>
            <table className={`${TABLE} w-max min-w-full`}>
          <thead className="sticky top-0 z-10 bg-slate-50">
            <tr>
              <th className={`${TH} sticky left-0 z-20 bg-slate-50`}>Placa</th>
              <th className={`${TH} min-w-[7rem]`}>Nombre</th>
              {TIPOS_VARIABLE_COBRO.map((tipo) => (
                <th
                  key={tipo}
                  className={`${TH} min-w-[3.5rem] text-center leading-tight`}
                  title={ETIQUETA_VARIABLE_COBRO[tipo]}
                >
                  {ETIQUETA_VARIABLE_COBRO[tipo]}
                </th>
              ))}
              <th className={`${TH} bg-slate-100 text-center`}>Total</th>
            </tr>
          </thead>
          <tbody>
            {agentesVisibles.map((agente) => {
              const conteo = conteos[agente.id]
              const total = conteo ? totalVariablesCobro(conteo) : 0
              return (
                <tr key={agente.id} className="hover:bg-slate-50">
                  <td className={`${CELDA} sticky left-0 z-10 bg-white font-mono font-semibold text-left`}>
                    {agente.numeroPlaca}
                  </td>
                  <td className={`${CELDA} text-left`}>
                    {agente.nombre} {agente.apellidos}
                  </td>
                  {TIPOS_VARIABLE_COBRO.map((tipo) => (
                    <td
                      key={tipo}
                      className={`${CELDA} ${
                        conteo && conteo[tipo] > 0
                          ? 'bg-emerald-50 font-semibold text-emerald-900'
                          : ''
                      }`}
                    >
                      {conteo?.[tipo] ?? 0}
                    </td>
                  ))}
                  <td className={`${CELDA} bg-slate-50 font-bold`}>{total}</td>
                </tr>
              )
            })}
          </tbody>
          <tfoot className="z-10 bg-slate-200 font-bold">
            <tr>
              <td className={`${CELDA} sticky left-0 z-20 bg-slate-200 text-left`} colSpan={2}>
                TOTAL
              </td>
              {TIPOS_VARIABLE_COBRO.map((tipo) => (
                <td key={tipo} className={CELDA}>{totalesColumna[tipo]}</td>
              ))}
              <td className={CELDA}>
                {Object.values(totalesColumna).reduce((s, n) => s + n, 0)}
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

      <p className={`shrink-0 ${PAGE_SUBTITLE} px-0.5`}>
        Conciliaciones y festivo son compatibles (ej. sábado festivo con M →
        conciliación sábado mañana + festivo; con T → conciliación sábado tarde
        + festivo). Noche sábado con domingo festivo suma festivo por el tramo
        festivo por el tramo del turno 22–06 en domingo si ese día no se cobró ya.
      </p>
    </section>
  )
}
