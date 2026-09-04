import { useEffect, useMemo, useState } from 'react'
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

const CELDA =
  'border border-slate-400 px-2 py-1 text-xs leading-tight text-center tabular-nums'
const CAMPO =
  'h-6 border border-slate-400 bg-white px-1 text-xs text-slate-900 outline-none focus:border-slate-700'

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
    const totales = {
      conciliacion_viernes_noche: 0,
      conciliacion_sabado_manana: 0,
      conciliacion_domingo_manana: 0,
      festivo: 0,
    }
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
    <section className="flex h-full min-h-0 flex-col">
      <div className="flex shrink-0 flex-wrap items-center justify-between gap-2 px-1 py-1">
        <div>
          <h1 className="text-xs font-bold text-slate-900">
            Listados · variables de cobro
          </h1>
          <p className="text-[11px] text-slate-600">
            Conciliaciones de finde y festivos por policía (mes vencido)
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1">
            <span className="text-xs font-semibold text-slate-600">Año</span>
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
            <span className="text-xs font-semibold text-slate-600">Mes</span>
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
            <span className="text-xs font-semibold text-slate-600">Rol</span>
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
            className="h-6 border border-slate-400 bg-white px-2 text-xs font-semibold text-slate-800 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
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
        </div>
      </div>

      {error ? (
        <div className="mx-1 mb-1 border border-red-200 bg-red-50 px-2 py-1 text-xs text-red-800">
          {error}
        </div>
      ) : null}

      {loading ? (
        <div className="mx-1 mb-1 border border-slate-300 bg-slate-50 px-2 py-1 text-xs text-slate-700">
          Cargando cuadrante de {MESES[mes - 1]} {anio}…
        </div>
      ) : null}

      {!loading && !hayCuadrante ? (
        <div className="mx-1 mb-1 border border-amber-300 bg-amber-50 px-2 py-1 text-xs text-amber-950">
          No hay cuadrante guardado para {MESES[mes - 1]} {anio}. Las variables
          salen en cero hasta que exista cuadrante mensual.
        </div>
      ) : null}

      <div className="min-h-0 flex-1 overflow-auto border border-slate-500 bg-white">
        <table className="w-full border-separate border-spacing-0 text-xs">
          <thead className="sticky top-0 z-10 bg-slate-100">
            <tr>
              <th className={`${CELDA} sticky left-0 z-20 bg-slate-100 text-left font-bold`}>
                Placa
              </th>
              <th className={`${CELDA} text-left font-bold min-w-[140px]`}>
                Nombre
              </th>
              {TIPOS_VARIABLE_COBRO.map((tipo) => (
                <th
                  key={tipo}
                  className={`${CELDA} min-w-[72px] font-bold leading-tight`}
                  title={ETIQUETA_VARIABLE_COBRO[tipo]}
                >
                  {ETIQUETA_VARIABLE_COBRO[tipo]}
                </th>
              ))}
              <th className={`${CELDA} font-bold bg-slate-200`}>Total</th>
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
          <tfoot className="sticky bottom-0 z-10 bg-slate-200 font-bold">
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
      </div>

      <p className="shrink-0 px-1 py-1 text-[11px] text-slate-600">
        Conciliaciones y festivo son compatibles (ej. sábado festivo con M →
        conciliación sábado + festivo). Noche sábado con domingo festivo suma
        festivo por el tramo del turno 22–06 en domingo si ese día no se cobró ya.
      </p>
    </section>
  )
}
