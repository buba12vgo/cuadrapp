import { useMemo, useState, type CSSProperties } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { DiaCoberturaPanel } from '@/components/DiaCoberturaPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardSidebar,
} from '@/components/ui/DashboardLayout'
import { PageHeader, ToolbarDivider, ToolbarSection } from '@/components/ui/PageHeader'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BTN_GHOST,
  FOCUS_RING,
  PAGE_SECTION,
  TITULO_BLOQUE,
} from '@/lib/uiStyles'
import { vePermisosDeTodos } from '@/lib/acceso'
import { useAcceso } from '@/contexts/AccesoContext'
import { agenteDelPerfil, useSeleccionAgente } from '@/lib/agenteSesion'
import { puestoEnCelda } from '@/lib/asignacionPuestos'
import { minimosParaFecha } from '@/lib/calendarioPuestos'
import {
  CLASE_SEMAFORO,
  ETIQUETA_SEMAFORO,
  TURNOS_COBERTURA,
  resumenDiaServicio,
} from '@/lib/coberturaDia'
import { esDiaTrabajado, esFinDeSemana, totalTrabajados } from '@/lib/convenio'
import { celdasMesCalendario } from '@/lib/exportarCalendarioJefesPdf'
import { eventosEnFecha } from '@/lib/eventosStore'
import { esFestivo } from '@/lib/festivos'
import { useMinimosSemanaData } from '@/lib/puestosStore'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import { useCuadranteOperativoMes } from '@/lib/useCuadranteOperativoMes'
import type { Turno } from '@/types'
import { ChipEventoCalendario } from '@/components/ChipEventoCalendario'

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

const DIAS_SEMANA = ['L', 'M', 'X', 'J', 'V', 'S', 'D'] as const

const PILDORA: Record<Turno, string> = {
  M: 'bg-blue-100 text-blue-800',
  T: 'bg-orange-100 text-orange-800',
  N: 'bg-violet-100 text-violet-800',
  MT: 'bg-teal-100 text-teal-800',
  L: 'bg-rose-100 text-rose-800',
  P: 'bg-rose-100 text-rose-800',
  D: 'bg-slate-200 text-slate-600',
  V: 'bg-emerald-100 text-emerald-800',
}

const SELECT_TOOLBAR =
  `h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-ink ${FOCUS_RING} focus:border-brand-400`

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function mesAnterior(anio: number, mes: number) {
  if (mes <= 1) return { anio: anio - 1, mes: 12 }
  return { anio, mes: mes - 1 }
}

function mesSiguiente(anio: number, mes: number) {
  if (mes >= 12) return { anio: anio + 1, mes: 1 }
  return { anio, mes: mes + 1 }
}

function etiquetaCorta(turno: Turno) {
  if (turno === 'MT') return 'M-T'
  if (turno === 'L') return 'P'
  return turno
}

export function CalendarioAgentePage() {
  const { perfil } = useAcceso()
  const hoy = useMemo(() => new Date(), [])
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)
  const claveMes = `${anio}-${mes}`
  const [seleccionDia, setSeleccionDia] = useState(() => ({
    clave: `${hoy.getFullYear()}-${hoy.getMonth() + 1}`,
    dia: hoy.getDate(),
  }))
  const [minimosSemana] = useMinimosSemanaData()
  const datos = useCuadranteOperativoMes(anio, mes)
  const veTodos = vePermisosDeTodos(perfil?.rol)
  const propio = useMemo(
    () => agenteDelPerfil(datos.operativos, perfil),
    [datos.operativos, perfil],
  )
  const candidatos = veTodos ? datos.operativos : propio ? [propio] : []
  const { agenteId, elegir } = useSeleccionAgente(
    candidatos,
    propio,
    datos.agentesCargados,
  )
  const agente = candidatos.find((item) => item.id === agenteId) ?? null
  const fila = agente ? (datos.cuadrante[agente.id] ?? []) : []
  const celdas = useMemo(() => celdasMesCalendario(anio, mes), [anio, mes])
  const puestosOperativos = useMemo(
    () => datos.puestos.filter((puesto) => puesto.ambito === 'OPERATIVO'),
    [datos.puestos],
  )

  const diaPorDefecto =
    hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes ? hoy.getDate() : 1
  const diaAbierto =
    seleccionDia.clave === claveMes ? seleccionDia.dia : diaPorDefecto

  const fechaAbierta =
    diaAbierto && diaAbierto <= datos.nDias
      ? isoFecha(anio, mes, diaAbierto)
      : null
  const resumen = fechaAbierta
    ? resumenDiaServicio({
        cuadrante: datos.cuadrante,
        asignaciones: datos.asignaciones,
        agentes: datos.operativos,
        puestos: puestosOperativos,
        minimos: minimosParaFecha(
          fechaAbierta,
          datos.eventos,
          minimosSemana,
          puestosOperativos,
        ),
        fecha: fechaAbierta,
        dia: diaAbierto!,
      })
    : null
  const turnoPropio = (
    diaAbierto ? (fila[diaAbierto - 1] ?? 'D') : null
  ) as Turno | null
  const trabajados = agente ? totalTrabajados(fila.slice(0, datos.nDias)) : 0

  function cobertura(dia: number) {
    const fecha = isoFecha(anio, mes, dia)
    return resumenDiaServicio({
      cuadrante: datos.cuadrante,
      asignaciones: datos.asignaciones,
      agentes: datos.operativos,
      puestos: puestosOperativos,
      minimos: minimosParaFecha(fecha, datos.eventos, minimosSemana, puestosOperativos),
      fecha,
      dia,
    })
  }

  return (
    <section className={`${PAGE_SECTION} gap-1.5 overflow-hidden`}>
      <PageHeader
        title="Calendario agente"
        subtitle={`Consulta de tu servicio${datos.loading ? ' · Cargando…' : ''}`}
        toolbar={
          <>
            <ToolbarSection label="Periodo">
              <button
                type="button"
                className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
                aria-label="Mes anterior"
                onClick={() => {
                  const prev = mesAnterior(anio, mes)
                  setAnio(prev.anio)
                  setMes(prev.mes)
                }}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <select
                className={`${SELECT_TOOLBAR} w-[8.25rem]`}
                aria-label="Mes"
                value={mes}
                onChange={(event) => setMes(Number(event.target.value))}
              >
                {MESES.map((nombre, indice) => (
                  <option key={nombre} value={indice + 1}>
                    {nombre}
                  </option>
                ))}
              </select>
              <select
                className={`${SELECT_TOOLBAR} w-[4.75rem]`}
                aria-label="Año"
                value={anio}
                onChange={(event) => setAnio(Number(event.target.value) || anio)}
              >
                {Array.from({ length: 21 }, (_, i) => 2020 + i).map((valor) => (
                  <option key={valor} value={valor}>
                    {valor}
                  </option>
                ))}
              </select>
              <button
                type="button"
                className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
                aria-label="Mes siguiente"
                onClick={() => {
                  const next = mesSiguiente(anio, mes)
                  setAnio(next.anio)
                  setMes(next.mes)
                }}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </ToolbarSection>
            {veTodos ? (
              <>
                <ToolbarDivider />
                <ToolbarSection label="Agente">
                  <select
                    className={`${SELECT_TOOLBAR} w-[15.5rem] max-w-[40vw]`}
                    aria-label="Agente"
                    value={agente?.id ?? ''}
                    disabled={candidatos.length === 0}
                    onChange={(event) => elegir(event.target.value)}
                  >
                    {candidatos.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.numeroPlaca} · {item.nombre} {item.apellidos}
                      </option>
                    ))}
                  </select>
                </ToolbarSection>
              </>
            ) : null}
          </>
        }
      />

      {datos.error ? <p className={ALERT_ERROR}>{datos.error}</p> : null}
      {!datos.firebaseOk ? (
        <p className={ALERT_INFO}>
          Firebase no está configurado; se muestra el mes sin servicio guardado.
        </p>
      ) : null}
      {!veTodos && !propio && datos.agentesCargados && !datos.loading ? (
        <p className={ALERT_INFO}>
          Tu usuario no está vinculado a un agente del cuadrante mensual.
        </p>
      ) : null}
      {veTodos && candidatos.length === 0 && datos.agentesCargados && !datos.loading ? (
        <p className={ALERT_INFO}>No hay agentes en el cuadrante mensual.</p>
      ) : null}

      <DashboardBody className="gap-2">
        <DashboardMain className="overflow-hidden">
          <div className="flex min-h-0 flex-1 flex-col gap-1.5 p-2">
            {agente ? (
              <p className="shrink-0 truncate text-sm font-bold text-ink">
                <span className="mr-2 font-mono text-xs">{agente.numeroPlaca}</span>
                {agente.nombre} {agente.apellidos}
                <span className="ml-2 text-xs font-semibold text-slate-500">
                  {ROL_LABEL[agente.rolBase]} · {trabajados} días
                </span>
              </p>
            ) : null}
            <div className="flex min-h-0 flex-1 flex-col overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="grid shrink-0 grid-cols-7 border-b border-slate-200 bg-slate-50">
                {DIAS_SEMANA.map((dia, indice) => (
                  <div
                    key={dia}
                    className={`py-1 text-center text-[10px] font-bold uppercase tracking-wider ${
                      indice >= 5 ? 'text-red-600' : 'text-slate-500'
                    }`}
                  >
                    {dia}
                  </div>
                ))}
              </div>
              <div
                className="grid min-h-0 flex-1 grid-cols-7 gap-px bg-slate-200 [grid-template-rows:repeat(var(--semanas),minmax(0,1fr))]"
                style={
                  {
                    '--semanas': Math.max(1, Math.ceil(celdas.length / 7)),
                  } as CSSProperties
                }
              >
                {celdas.map((dia, indice) => {
                  if (dia == null) {
                    return <div key={`hueco-${indice}`} className="bg-slate-50" />
                  }
                  const turno = (fila[dia - 1] ?? 'D') as Turno
                  const fecha = isoFecha(anio, mes, dia)
                  const eventosDia = eventosEnFecha(datos.eventos, fecha)
                  const especial = esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
                  const semaforos = cobertura(dia).turnos
                  const abierto = dia === diaAbierto
                  const puesto = agente
                    ? puestoEnCelda(
                        datos.asignaciones,
                        fecha,
                        agente.id,
                        turno,
                        puestosOperativos,
                      )
                    : null
                  const textoSemaforo = TURNOS_COBERTURA.map(
                    (codigo) => `${codigo} ${ETIQUETA_SEMAFORO[semaforos[codigo].nivel]}`,
                  ).join(', ')
                  const textoPuesto = puesto
                    ? `${puesto.abreviatura} ${puesto.nombre}`
                    : esDiaTrabajado(turno)
                      ? 'Sin puesto'
                      : ''
                  return (
                    <button
                      key={dia}
                      type="button"
                      className={`flex min-h-0 flex-col gap-1 overflow-hidden p-1.5 text-left ${FOCUS_RING} ${
                        especial && turno === 'V' ? 'bg-amber-50' : 'bg-white'
                      } ${abierto ? 'ring-2 ring-inset ring-brand-500' : ''}`}
                      aria-pressed={abierto}
                      aria-label={`${dia} ${MESES[mes - 1]}, ${etiquetaCorta(turno)}${textoPuesto ? `, ${textoPuesto}` : ''}, ${textoSemaforo}`}
                      onClick={() => setSeleccionDia({ clave: claveMes, dia })}
                    >
                      <span className="flex items-center justify-between gap-1">
                        <span
                          className={`text-xs font-extrabold tabular-nums ${
                            especial ? 'text-red-600' : 'text-slate-800'
                          }`}
                        >
                          {dia}
                        </span>
                        <span className="flex items-center gap-1">
                          {TURNOS_COBERTURA.map((codigo) => (
                            <span key={codigo} className="flex items-center gap-0.5">
                              <span className="text-[9px] font-extrabold leading-none text-slate-500">
                                {codigo}
                              </span>
                              <span
                                className={`h-2 w-2 shrink-0 rounded-full ${CLASE_SEMAFORO[semaforos[codigo].nivel]}`}
                                title={`${codigo}: ${ETIQUETA_SEMAFORO[semaforos[codigo].nivel]}`}
                              />
                            </span>
                          ))}
                        </span>
                      </span>
                      <span
                        className={`w-fit rounded px-1 text-[10px] font-extrabold ${PILDORA[turno]}`}
                      >
                        {etiquetaCorta(turno)}
                      </span>
                      {esDiaTrabajado(turno) ? (
                        <span
                          className="truncate text-[10px] font-bold leading-tight text-slate-700"
                          title={puesto?.nombre ?? 'Sin puesto'}
                        >
                          {puesto ? `${puesto.abreviatura} ${puesto.nombre}` : 'Sin puesto'}
                        </span>
                      ) : (
                        <span className="text-[10px] font-semibold text-slate-400">
                          {turno === 'V' ? 'Vacaciones' : turno === 'P' || turno === 'L' ? 'Permiso' : 'Descanso'}
                        </span>
                      )}
                      {eventosDia.slice(0, 1).map((evento) => (
                        <ChipEventoCalendario key={evento.id} evento={evento} />
                      ))}
                    </button>
                  )
                })}
              </div>
            </div>
          </div>
        </DashboardMain>
        <DashboardSidebar className="gap-2">
          <div className="rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className={`${TITULO_BLOQUE} mb-2`}>Semáforo por turno</p>
            <ul className="flex flex-col gap-1 text-xs text-slate-600">
              {(['verde', 'ambar', 'rojo'] as const).map((nivel) => (
                <li key={nivel} className="flex items-center gap-2">
                  <span className={`h-2.5 w-2.5 rounded-full ${CLASE_SEMAFORO[nivel]}`} />
                  {ETIQUETA_SEMAFORO[nivel]}
                </li>
              ))}
            </ul>
          </div>
          <div className="min-h-0 flex-1 overflow-auto rounded-xl border border-slate-200 bg-white p-3 shadow-sm">
            <p className={`${TITULO_BLOQUE} mb-2`}>Día</p>
            {resumen && diaAbierto ? (
              <DiaCoberturaPanel
                titulo={`${diaAbierto} ${MESES[mes - 1]} ${anio}`}
                turnoPropio={turnoPropio}
                resumen={resumen}
              />
            ) : (
              <p className="text-sm text-slate-500">Elige un día del calendario.</p>
            )}
          </div>
        </DashboardSidebar>
      </DashboardBody>
    </section>
  )
}
