import { useEffect, useMemo, useState } from 'react'
import { TablaPermisosAgente } from '@/components/TablaPermisosAgente'
import { PageHeader, ToolbarSection } from '@/components/ui/PageHeader'
import { useAgentesData } from '@/lib/agentesStore'
import { saldosPermisoAgente } from '@/lib/cuposPermiso'
import { resumenPermisosVacio } from '@/lib/conteoPermisos'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import { useSaldosPermisosAnio } from '@/lib/useSaldosPermisosAnio'
import { CAMPO, PAGE_SECTION } from '@/lib/uiStyles'

export function PermisosAgentesPage() {
  const [agentesData] = useAgentesData()
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [agenteId, setAgenteId] = useState('')
  const agentes = useMemo(
    () =>
      [...agentesData].sort((a, b) =>
        a.numeroPlaca.localeCompare(b.numeroPlaca, 'es', { numeric: true }),
      ),
    [agentesData],
  )
  const { permisos, resumenes, loading } = useSaldosPermisosAnio(agentes, anio)

  useEffect(() => {
    if (!agentes.some((agente) => agente.id === agenteId)) {
      setAgenteId(agentes[0]?.id ?? '')
    }
  }, [agentes, agenteId])

  const agente = agentes.find((item) => item.id === agenteId) ?? null
  const saldos = agente
    ? saldosPermisoAgente(
        agente,
        permisos,
        anio,
        resumenes[agente.id] ?? resumenPermisosVacio(),
      )
    : []

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Permisos"
        subtitle="Totales, disfrutados y pendientes de cada agente"
        toolbar={
          <ToolbarSection label="Año">
            <input
              type="number"
              min={2020}
              max={2040}
              className={`${CAMPO} w-20`}
              value={anio}
              onChange={(event) => setAnio(Number(event.target.value) || anio)}
            />
          </ToolbarSection>
        }
      />
      {agentes.length === 0 ? (
        <p className="text-sm text-slate-500">No hay agentes en la plantilla.</p>
      ) : (
        <div className="grid gap-3 lg:grid-cols-[16rem_minmax(0,1fr)]">
          <ul className="flex gap-2 overflow-x-auto lg:flex-col lg:overflow-visible">
            {agentes.map((item) => {
              const activo = item.id === agente?.id
              return (
                <li key={item.id} className="shrink-0 lg:shrink">
                  <button
                    type="button"
                    className={`w-full rounded-xl px-3 py-2 text-left ${
                      activo ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'
                    }`}
                    onClick={() => setAgenteId(item.id)}
                  >
                    <span className="block text-sm font-extrabold">
                      {item.nombre} {item.apellidos}
                    </span>
                    <span className={`block text-[11px] font-semibold ${activo ? 'text-slate-300' : 'text-slate-500'}`}>
                      {item.numeroPlaca} · {ROL_LABEL[item.rolBase]}
                    </span>
                  </button>
                </li>
              )
            })}
          </ul>
          <section className="rounded-2xl bg-white p-4 shadow-sm">
            {agente ? (
              <>
                <h2 className="text-base font-extrabold text-slate-950">
                  {agente.nombre} {agente.apellidos}
                </h2>
                <p className="mb-3 text-xs font-semibold text-slate-500">
                  {agente.numeroPlaca} · {ROL_LABEL[agente.rolBase]} · {anio}
                  {loading ? ' · calculando disfrutados…' : ''}
                </p>
                <TablaPermisosAgente saldos={saldos} />
              </>
            ) : null}
          </section>
        </div>
      )}
    </section>
  )
}
