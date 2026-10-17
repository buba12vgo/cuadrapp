import { useMemo, useState } from 'react'
import { ListadoComputoDias } from '@/components/ListadoComputoDias'
import { TablaPermisosAgente } from '@/components/TablaPermisosAgente'
import { PageHeader, ToolbarDivider, ToolbarSection } from '@/components/ui/PageHeader'
import { useAcceso } from '@/contexts/AccesoContext'
import { vePermisosDeTodos } from '@/lib/acceso'
import { agenteDelPerfil, useSeleccionAgente } from '@/lib/agenteSesion'
import { useAgentesData } from '@/lib/agentesStore'
import {
  computoDesdeContadores,
  computoDesdeFilas,
  filasEjemploComputoAnual,
} from '@/lib/computoDiasTrabajados'
import {
  CODIGO_DIAS_ANO_ANTERIOR,
  esDiasAnoAnterior,
  leerCuposPermisoAgente,
  normalizarDiasAnuales,
  saldosPermisoAgente,
} from '@/lib/cuposPermiso'
import { resumenPermisosVacio } from '@/lib/conteoPermisos'
import { saveAgente } from '@/lib/db'
import { isDesignPreview } from '@/lib/designPreview'
import { ensureFirebase } from '@/lib/firebase'
import { esLibrePorDisponibilidad } from '@/lib/jornadaDisponible'
import { saldosDePermisosVisibles } from '@/lib/permisos'
import { esRolCuadranteJefes, ROL_LABEL } from '@/lib/rolesCuadrante'
import { useSaldosPermisosAnio } from '@/lib/useSaldosPermisosAnio'
import { ALERT_ERROR, CAMPO, FOCUS_RING, PAGE_SECTION } from '@/lib/uiStyles'
import type { FichaPolicia, RolPolicia } from '@/types'

type VistaPermisos = 'saldos' | 'computo'

const ORDEN_ROL: RolPolicia[] = [
  'RESPONSABLE',
  'JEFE_SERVICIO',
  'JEFE_EQUIPO',
  'POLICIA',
  'POLICIA_BOLSA',
]

function sinAcentos(valor: string) {
  return valor
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
}

function coincideBusqueda(agente: FichaPolicia, texto: string) {
  const consulta = sinAcentos(texto.trim())
  if (!consulta) return true
  const nombre = sinAcentos(`${agente.nombre} ${agente.apellidos}`)
  if (nombre.includes(consulta)) return true
  if (sinAcentos(agente.numeroPlaca).includes(consulta)) return true
  const numero = Number(consulta)
  const placa = Number(agente.numeroPlaca)
  return Number.isInteger(numero) && Number.isInteger(placa) && numero === placa
}

export function PermisosAgentesPage() {
  const { perfil, puedeEscribir } = useAcceso()
  const [agentesData, setAgentesData] = useAgentesData()
  const [anio, setAnio] = useState(() => new Date().getFullYear())
  const [vista, setVista] = useState<VistaPermisos>('saldos')
  const [busqueda, setBusqueda] = useState('')
  const [rolFiltro, setRolFiltro] = useState<RolPolicia | ''>('')
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)
  const agentes = useMemo(
    () =>
      [...agentesData].sort((a, b) =>
        a.numeroPlaca.localeCompare(b.numeroPlaca, 'es', { numeric: true }),
      ),
    [agentesData],
  )
  const propio = useMemo(
    () => agenteDelPerfil(agentes, perfil),
    [agentes, perfil],
  )
  const veTodos = vePermisosDeTodos(perfil?.rol)
  const puedeEditar = veTodos && puedeEscribir('agentes')
  const visibles = useMemo(
    () => (veTodos ? agentes : propio ? [propio] : []),
    [veTodos, agentes, propio],
  )
  const roles = useMemo(
    () => ORDEN_ROL.filter((rol) => visibles.some((agente) => agente.rolBase === rol)),
    [visibles],
  )
  const filtrados = useMemo(
    () =>
      visibles.filter(
        (agente) =>
          (rolFiltro === '' || agente.rolBase === rolFiltro) &&
          coincideBusqueda(agente, busqueda),
      ),
    [visibles, rolFiltro, busqueda],
  )
  const { agenteId, elegir } = useSeleccionAgente(filtrados, propio)
  const { permisos, resumenes, loading } = useSaldosPermisosAnio(visibles, anio)
  const computos = useMemo(() => {
    const mapa: Record<string, ReturnType<typeof computoDesdeContadores>> = {}
    for (const item of filtrados) {
      if (isDesignPreview) {
        const extra = (Number(item.numeroPlaca) % 3) + (anio % 2)
        mapa[item.id] = computoDesdeFilas(
          filasEjemploComputoAnual(esRolCuadranteJefes(item.rolBase), extra),
        )
        continue
      }
      const resumen = resumenes[item.id] ?? resumenPermisosVacio()
      mapa[item.id] = computoDesdeContadores(
        resumen.jornadasTrabajadas,
        resumen.diasPermiso,
      )
    }
    return mapa
  }, [filtrados, resumenes, anio])

  const agente = visibles.find((item) => item.id === agenteId) ?? null
  const saldos = agente
    ? saldosDePermisosVisibles(
        saldosPermisoAgente(
          agente,
          permisos,
          anio,
          resumenes[agente.id] ?? resumenPermisosVacio(),
        ),
        permisos,
      )
    : []

  async function guardarTotal(codigo: string, dias: number) {
    if (!agente || !puedeEditar) return
    const cupo = normalizarDiasAnuales(dias)
    const anterior = agente
    let siguiente: FichaPolicia
    if (esDiasAnoAnterior(codigo)) {
      const clave = String(anio)
      siguiente = {
        ...agente,
        cuposPermisoAnio: {
          ...(agente.cuposPermisoAnio ?? {}),
          [clave]: {
            ...(agente.cuposPermisoAnio?.[clave] ?? {}),
            [CODIGO_DIAS_ANO_ANTERIOR]: cupo,
          },
        },
      }
    } else if (esLibrePorDisponibilidad(codigo)) {
      const generadas = resumenes[agente.id]?.jornadaDisponible ?? 0
      siguiente = {
        ...agente,
        cuposPermiso: {
          ...leerCuposPermisoAgente(agente),
          [codigo]: Math.max(0, cupo - generadas),
        },
      }
    } else {
      siguiente = {
        ...agente,
        cuposPermiso: {
          ...leerCuposPermisoAgente(agente),
          [codigo]: cupo,
        },
      }
    }
    setErrorGuardado(null)
    setAgentesData((actual) =>
      actual.map((item) => (item.id === siguiente.id ? siguiente : item)),
    )
    setGuardando(true)
    try {
      if (await ensureFirebase()) await saveAgente(siguiente)
    } catch (err) {
      setAgentesData((actual) =>
        actual.map((item) => (item.id === anterior.id ? anterior : item)),
      )
      setErrorGuardado(
        err instanceof Error ? err.message : 'No se pudo guardar el permiso.',
      )
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title={vista === 'computo' ? 'Cómputo días trabajados' : 'Permisos'}
        subtitle={
          vista === 'computo'
            ? `Jornadas trabajadas más los permisos que suman como día de trabajo en ${anio}. Referencia 186.`
            : veTodos
              ? 'Totales, disfrutados y pendientes de cada agente'
              : 'Totales, disfrutados y pendientes'
        }
        toolbar={
          <>
            <ToolbarSection label="Vista">
              <button
                type="button"
                className={`h-7 rounded-md px-2.5 text-xs font-semibold ${FOCUS_RING} ${
                  vista === 'saldos'
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-white text-slate-700 hover:bg-brand-50'
                }`}
                aria-pressed={vista === 'saldos'}
                onClick={() => setVista('saldos')}
              >
                Saldos
              </button>
              <button
                type="button"
                className={`h-7 rounded-md px-2.5 text-xs font-semibold ${FOCUS_RING} ${
                  vista === 'computo'
                    ? 'bg-brand-600 text-white'
                    : 'border border-line bg-white text-slate-700 hover:bg-brand-50'
                }`}
                aria-pressed={vista === 'computo'}
                onClick={() => setVista('computo')}
              >
                Cómputo días
              </button>
            </ToolbarSection>
            <ToolbarDivider />
            <ToolbarSection label="Año">
              <input
                type="number"
                min={2020}
                max={2040}
                className={`${CAMPO} w-20`}
                value={anio}
                aria-label="Año"
                onChange={(event) => setAnio(Number(event.target.value) || anio)}
              />
            </ToolbarSection>
          </>
        }
      />
      {visibles.length === 0 ? (
        <p className="text-sm text-slate-500">
          {veTodos
            ? 'No hay agentes en la plantilla.'
            : 'No hay una ficha vinculada a tu usuario.'}
        </p>
      ) : vista === 'computo' ? (
        <div className="flex min-h-0 flex-1 flex-col gap-2">
          {veTodos ? (
            <div className="flex flex-wrap gap-2">
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Número o nombre"
                aria-label="Buscar agente por número o nombre"
                className={`${CAMPO} w-56`}
              />
              <select
                className={`${CAMPO} w-48`}
                value={rolFiltro}
                aria-label="Filtrar por tipo de agente"
                onChange={(event) => setRolFiltro(event.target.value as RolPolicia | '')}
              >
                <option value="">Todos los tipos</option>
                {roles.map((rol) => (
                  <option key={rol} value={rol}>
                    {ROL_LABEL[rol]}
                  </option>
                ))}
              </select>
            </div>
          ) : null}
          <ListadoComputoDias
            agentes={filtrados}
            computos={computos}
            loading={loading && !isDesignPreview}
            anio={anio}
            vistaPrevia={isDesignPreview}
          />
        </div>
      ) : (
        <div
          className={`grid min-h-0 flex-1 gap-3 ${veTodos ? 'lg:grid-cols-[18rem_minmax(0,1fr)]' : ''}`}
        >
          {veTodos ? (
            <div className="flex min-h-0 flex-col gap-2">
              <input
                type="search"
                value={busqueda}
                onChange={(event) => setBusqueda(event.target.value)}
                placeholder="Número o nombre"
                aria-label="Buscar agente por número o nombre"
                className={CAMPO}
              />
              <select
                className={CAMPO}
                value={rolFiltro}
                aria-label="Filtrar por tipo de agente"
                onChange={(event) => setRolFiltro(event.target.value as RolPolicia | '')}
              >
                <option value="">Todos los tipos</option>
                {roles.map((rol) => (
                  <option key={rol} value={rol}>
                    {ROL_LABEL[rol]}
                  </option>
                ))}
              </select>
              <ul className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto overscroll-contain pr-1 lg:max-h-[calc(100svh-13.5rem)]">
                {filtrados.length === 0 ? (
                  <li className="rounded-xl bg-white px-3 py-2 text-sm text-slate-500">
                    Ningún agente coincide.
                  </li>
                ) : (
                  filtrados.map((item) => {
                    const activo = item.id === agente?.id
                    return (
                      <li key={item.id} className="shrink-0">
                        <button
                          type="button"
                          className={`w-full rounded-xl px-3 py-2 text-left ${
                            activo ? 'bg-slate-950 text-white' : 'bg-white text-slate-800'
                          }`}
                          onClick={() => elegir(item.id)}
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
                  })
                )}
              </ul>
            </div>
          ) : null}
          <section className="min-h-0 overflow-y-auto rounded-2xl bg-white p-4 shadow-sm">
            {agente ? (
              <>
                <h2 className="text-base font-extrabold text-slate-950">
                  {agente.nombre} {agente.apellidos}
                </h2>
                <p className="mb-3 text-xs font-semibold text-slate-500">
                  {agente.numeroPlaca} · {ROL_LABEL[agente.rolBase]} · {anio}
                  {loading ? ' · calculando disfrutados…' : ''}
                  {guardando ? ' · guardando…' : ''}
                </p>
                {errorGuardado ? <p className={`${ALERT_ERROR} mb-3`}>{errorGuardado}</p> : null}
                <TablaPermisosAgente
                  saldos={saldos}
                  onCambiarTotal={puedeEditar ? (codigo, dias) => void guardarTotal(codigo, dias) : undefined}
                />
              </>
            ) : null}
          </section>
        </div>
      )}
    </section>
  )
}
