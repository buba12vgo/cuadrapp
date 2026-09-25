import { useMemo } from 'react'
import { TablaPermisosAgente } from '@/components/TablaPermisosAgente'
import { useAcceso } from '@/contexts/AccesoContext'
import { vePermisosDeTodos } from '@/lib/acceso'
import { agenteDelPerfil, useSeleccionAgente } from '@/lib/agenteSesion'
import { saldosPermisoAgente } from '@/lib/cuposPermiso'
import { resumenPermisosVacio } from '@/lib/conteoPermisos'
import { ROL_LABEL, agentesCuadranteJefes } from '@/lib/rolesCuadrante'
import { useAgentesData } from '@/lib/agentesStore'
import { useSaldosPermisosAnio } from '@/lib/useSaldosPermisosAnio'
import { useMovilMes } from '@/pages/movil/movilMes'

export function MovilPermisosPage() {
  const { anio } = useMovilMes()
  const { perfil } = useAcceso()
  const [agentesData] = useAgentesData()
  const jefes = useMemo(
    () => agentesCuadranteJefes(agentesData),
    [agentesData],
  )
  const propio = useMemo(
    () => agenteDelPerfil(agentesData, perfil),
    [agentesData, perfil],
  )
  const veTodos = vePermisosDeTodos(perfil?.rol)
  const visibles = useMemo(
    () => (veTodos ? jefes : propio ? [propio] : []),
    [veTodos, jefes, propio],
  )
  const { agenteId, elegir } = useSeleccionAgente(visibles, propio)
  const { permisos, resumenes, loading } = useSaldosPermisosAnio(visibles, anio)

  const agente = visibles.find((item) => item.id === agenteId) ?? null
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
      {veTodos ? (
      <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
        {visibles.map((item) => {
          const activo = item.id === agente?.id
          return (
            <button
              key={item.id}
              type="button"
              className={`shrink-0 rounded-2xl px-3 py-2 text-left ${
                activo ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'
              }`}
              onClick={() => elegir(item.id)}
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
      ) : null}
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
          {veTodos
            ? 'No hay jefes ni responsables en la plantilla.'
            : 'No hay una ficha vinculada a tu usuario.'}
        </p>
      )}
    </div>
  )
}
