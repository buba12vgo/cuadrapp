import { useMemo, useState } from 'react'
import { DiaCoberturaPanel } from '@/components/DiaCoberturaPanel'
import { vePermisosDeTodos } from '@/lib/acceso'
import { agenteDelPerfil, useSeleccionAgente } from '@/lib/agenteSesion'
import { minimosParaFecha } from '@/lib/calendarioPuestos'
import { resumenDiaServicio } from '@/lib/coberturaDia'
import { totalTrabajados } from '@/lib/convenio'
import { useMinimosSemanaData } from '@/lib/puestosStore'
import { ROL_LABEL } from '@/lib/rolesCuadrante'
import { useCuadranteOperativoMes } from '@/lib/useCuadranteOperativoMes'
import { useAcceso } from '@/contexts/AccesoContext'
import type { Turno } from '@/types'
import { RejillaMesMovil } from '@/pages/movil/RejillaMesMovil'
import { etiquetaDia, isoFechaMovil, useMovilMes } from '@/pages/movil/movilMes'

function etiquetaCorta(turno: Turno) {
  if (turno === 'MT') return 'M-T'
  if (turno === 'L') return 'P'
  return turno
}

export function MovilServicioPage() {
  const { anio, mes, nombreMes } = useMovilMes()
  const { perfil } = useAcceso()
  const datos = useCuadranteOperativoMes(anio, mes)
  const [minimosSemana] = useMinimosSemanaData()
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
  const hoy = useMemo(() => new Date(), [])
  const claveMes = `${anio}-${mes}`
  const [seleccionDia, setSeleccionDia] = useState(() => ({
    clave: `${hoy.getFullYear()}-${hoy.getMonth() + 1}`,
    dia: hoy.getDate(),
  }))
  const diaPorDefecto =
    hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes ? hoy.getDate() : 1
  const dia = seleccionDia.clave === claveMes ? seleccionDia.dia : diaPorDefecto

  const agente = candidatos.find((item) => item.id === agenteId) ?? null
  const fila = agente ? (datos.cuadrante[agente.id] ?? []) : []
  const diaAbierto = dia != null && dia <= datos.nDias ? dia : null
  const fecha = diaAbierto ? isoFechaMovil(anio, mes, diaAbierto) : ''
  const puestos = useMemo(
    () => datos.puestos.filter((puesto) => puesto.ambito === 'OPERATIVO'),
    [datos.puestos],
  )
  const resumen = fecha
    ? resumenDiaServicio({
        cuadrante: datos.cuadrante,
        asignaciones: datos.asignaciones,
        agentes: datos.operativos,
        puestos,
        minimos: minimosParaFecha(fecha, datos.eventos, minimosSemana, puestos),
        fecha,
        dia: diaAbierto!,
      })
    : null
  const turno = (diaAbierto ? (fila[diaAbierto - 1] ?? 'D') : 'D') as Turno
  const trabajados = agente ? totalTrabajados(fila.slice(0, datos.nDias)) : 0

  return (
    <div className="flex flex-col gap-3">
      <p className="px-1 text-sm text-slate-500">
        Tu servicio del mes. Pulsa un día para ver los mínimos y quién está en cada puesto.
      </p>
      {veTodos ? (
        <div className="-mx-3 flex gap-2 overflow-x-auto px-3 pb-1">
          {candidatos.map((item) => {
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
                  {item.numeroPlaca} · {ROL_LABEL[item.rolBase]}
                </span>
              </button>
            )
          })}
        </div>
      ) : null}
      {datos.loading ? <p className="px-1 text-sm text-slate-500">Cargando servicio…</p> : null}
      {datos.error ? (
        <p className="rounded-2xl bg-rose-50 px-3 py-2 text-sm text-rose-800">{datos.error}</p>
      ) : null}
      {!datos.loading && !agente ? (
        <p className="rounded-2xl bg-white px-3 py-4 text-sm text-slate-600">
          {veTodos
            ? 'No hay agentes en el cuadrante mensual.'
            : 'Tu usuario no está vinculado a un agente del cuadrante mensual.'}
        </p>
      ) : null}
      {agente ? (
        <>
          <p className="px-1 text-sm font-semibold text-slate-700">
            {agente.numeroPlaca} · {agente.nombre} {agente.apellidos} · {trabajados} días
          </p>
          <RejillaMesMovil
            anio={anio}
            mes={mes}
            diaSeleccionado={diaAbierto}
            onElegir={(numero) => setSeleccionDia({ clave: claveMes, dia: numero })}
            marca={(numero) => {
              const turnoDia = (fila[numero - 1] ?? 'D') as Turno
              const fechaDia = isoFechaMovil(anio, mes, numero)
              const nivel = resumenDiaServicio({
                cuadrante: datos.cuadrante,
                asignaciones: datos.asignaciones,
                agentes: datos.operativos,
                puestos,
                minimos: minimosParaFecha(fechaDia, datos.eventos, minimosSemana, puestos),
                fecha: fechaDia,
                dia: numero,
              }).nivel
              return { texto: etiquetaCorta(turnoDia), punto: nivel }
            }}
          />
          {resumen && diaAbierto ? (
            <section className="rounded-3xl bg-white px-4 py-3 shadow-sm">
              <DiaCoberturaPanel
                titulo={`${etiquetaDia(anio, mes, diaAbierto).largo} ${diaAbierto} ${nombreMes}`}
                turnoPropio={turno}
                resumen={resumen}
              />
            </section>
          ) : null}
        </>
      ) : null}
    </div>
  )
}
