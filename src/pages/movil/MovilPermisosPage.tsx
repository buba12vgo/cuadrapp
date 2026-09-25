import { useEffect, useMemo, useState } from 'react'
import { TablaPermisosAgente } from '@/components/TablaPermisosAgente'
import { saldosPermisoAgente } from '@/lib/cuposPermiso'
import { resumenPermisosVacio } from '@/lib/conteoPermisos'
import { ROL_LABEL, agentesCuadranteJefes } from '@/lib/rolesCuadrante'
import { useAgentesData } from '@/lib/agentesStore'
import { useSaldosPermisosAnio } from '@/lib/useSaldosPermisosAnio'
import { useMovilMes } from '@/pages/movil/movilMes'

export function MovilPermisosPage() {
  const { anio } = useMovilMes()
  const [agentesData] = useAgentesData()
  const jefes = useMemo(
    () => agentesCuadranteJefes(agentesData),
    [agentesData],
  )
  const [agenteId, setAgenteId] = useState('')
  const { permisos, resumenes, loading } = useSaldosPermisosAnio(jefes, anio)

  useEffect(() => {
    if (!jefes.some((agente) => agente.id === agenteId)) {
      setAgenteId(jefes[0]?.id ?? '')
    }
  }, [jefes, agenteId])

  const agente = jefes.find((item) => item.id === agenteId) ?? null
  const saldos = agente
    ? saldosPermisoAgente(
        agente,
        permisos,
        anio,
        resumenes[agente.id] ?? resumenPermisosVacio(),
      )
    : []

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Permisos de {anio}. Totales, disfrutados y pendientes.
      </p>
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {jefes.map((item) => {
          const activo = item.id === agente?.id
          return (
            <button
              key={item.id}
              type="button"
              className={`shrink-0 rounded-2xl px-3 py-2 text-left ${
                activo ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'
              }`}
              onClick={() => setAgenteId(item.id)}
            >
              <span className="block text-sm font-extrabold">
                {item.nombre} {item.apellidos.split(' ')[0]}
              </span>
              <span className={`block text-[11px] font-semibold ${activo ? 'text-slate-300' : 'text-slate-500'}`}>
                {ROL_LABEL[item.rolBase]}
              </span>
            </button>
          )
        })}
      </div>
      {loading ? <p className="px-1 text-sm text-slate-500">Calculando disfrutados…</p> : null}
      {agente ? (
        <section className="rounded-3xl bg-white px-4 py-3 shadow-sm">
          <h2 className="text-base font-extrabold text-slate-950">
            {agente.nombre} {agente.apellidos}
          </h2>
          <p className="mb-3 text-xs font-semibold text-slate-500">
            {agente.numeroPlaca} · {ROL_LABEL[agente.rolBase]}
          </p>
          <TablaPermisosAgente saldos={saldos} />
        </section>
      ) : (
        <p className="rounded-2xl bg-white px-3 py-4 text-sm text-slate-600">
          No hay jefes ni responsables en la plantilla.
        </p>
      )}
    </div>
  )
}
