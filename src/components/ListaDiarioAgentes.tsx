import { useEffect, useMemo, useState } from 'react'
import { ChevronDown } from 'lucide-react'
import { useAppDialog } from '@/components/ui/ConfirmDialog'
import { useAcceso } from '@/contexts/AccesoContext'
import {
  asignarPuestoEnCelda,
  puestosPermitidosParaAgente,
  quitarAsignacionCelda,
} from '@/lib/asignacionPuestos'
import {
  minimosParaFecha,
  type AsignacionesDiarias,
  type PuestoConfig,
  type TurnoOperativo,
} from '@/lib/calendarioPuestos'
import {
  resumenDiaServicio,
  TURNOS_COBERTURA,
  type LineaPuestoDia,
  type PersonaTurno,
  type ResumenDiaServicio,
} from '@/lib/coberturaDia'
import { diasDelMes, esFinDeSemana } from '@/lib/convenio'
import { cuadranteParaFirestore } from '@/lib/cuadranteFirestore'
import { saveCuadrante } from '@/lib/db'
import { isDesignPreview } from '@/lib/designPreview'
import type { CuadranteMensual } from '@/lib/generarCuadranteMensual'
import { esFestivo } from '@/lib/festivos'
import { NOMBRE_JORNADA_DISPONIBLE } from '@/lib/jornadaDisponible'
import { useTiposPermiso } from '@/lib/permisosStore'
import { useMinimosSemanaData } from '@/lib/puestosStore'
import { useCuadranteOperativoMes } from '@/lib/useCuadranteOperativoMes'
import { ALERT_ERROR, ALERT_INFO, FOCUS_RING } from '@/lib/uiStyles'
import type { FichaPolicia } from '@/types'

const TURNO_LABEL: Record<TurnoOperativo, string> = {
  M: 'Mañana',
  T: 'Tarde',
  N: 'Noche',
}

const DIAS = ['domingo', 'lunes', 'martes', 'miércoles', 'jueves', 'viernes', 'sábado']

function pad(n: number) {
  return String(n).padStart(2, '0')
}

function isoFecha(anio: number, mes: number, dia: number) {
  return `${anio}-${pad(mes)}-${pad(dia)}`
}

function puestosSinCubrir(resumen: ResumenDiaServicio) {
  return resumen.lineas.filter((linea) => linea.minimo > 0 && linea.personas.length < linea.minimo)
}

function hayServicio(cuadrante: CuadranteMensual) {
  return Object.values(cuadrante).some((fila) =>
    fila.some((celda) => celda === 'M' || celda === 'T' || celda === 'N'),
  )
}

function cuadranteMuestraPreview(
  cuadrante: CuadranteMensual,
  operativos: FichaPolicia[],
  nDias: number,
  dia: number,
): CuadranteMensual {
  const demo: CuadranteMensual = {}
  for (const agente of operativos) {
    const fila = [...(cuadrante[agente.id] ?? [])]
    while (fila.length < nDias) fila.push('D')
    fila[dia - 1] = 'M'
    demo[agente.id] = fila.slice(0, nDias)
  }
  return demo
}

function opcionesPuesto(agente: FichaPolicia, puestos: PuestoConfig[], actual: string) {
  const permitidos = new Set(puestosPermitidosParaAgente(agente, puestos, 'OPERATIVO'))
  const nombres = puestos
    .map((puesto) => puesto.nombre)
    .filter((nombre) => permitidos.has(nombre) || nombre === actual)
  if (actual === NOMBRE_JORNADA_DISPONIBLE && !nombres.includes(actual)) {
    nombres.push(actual)
  }
  return nombres
}

export function ListaDiarioAgentes({ anio, mes }: { anio: number; mes: number }) {
  const { alert } = useAppDialog()
  const { puedeEscribir } = useAcceso()
  const puedeEditar = puedeEscribir('diario-agentes')
  const datos = useCuadranteOperativoMes(anio, mes)
  const [minimosSemana] = useMinimosSemanaData()
  const [tiposPermiso] = useTiposPermiso()
  const [asignaciones, setAsignaciones] = useState<AsignacionesDiarias>({})
  const [cuadranteVista, setCuadranteVista] = useState<CuadranteMensual>({})
  const [muestraPreview, setMuestraPreview] = useState(false)
  const [guardando, setGuardando] = useState(false)
  const [errorGuardado, setErrorGuardado] = useState<string | null>(null)
  const hoy = useMemo(() => new Date(), [])
  const claveMes = `${anio}-${mes}`
  const [seleccion, setSeleccion] = useState(() => ({
    clave: `${hoy.getFullYear()}-${hoy.getMonth() + 1}`,
    dia: hoy.getDate(),
  }))
  const diaPorDefecto =
    hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes ? hoy.getDate() : 1
  const diaAbierto = seleccion.clave === claveMes ? seleccion.dia : diaPorDefecto
  const nDias = diasDelMes(anio, mes)

  useEffect(() => {
    if (datos.loading) return
    const diaMuestra =
      hoy.getFullYear() === anio && hoy.getMonth() + 1 === mes
        ? Math.min(hoy.getDate(), nDias)
        : 1
    const sembrar =
      isDesignPreview && !datos.firebaseOk && !hayServicio(datos.cuadrante)
    setAsignaciones(datos.asignaciones)
    setMuestraPreview(sembrar)
    setCuadranteVista(
      sembrar
        ? cuadranteMuestraPreview(datos.cuadrante, datos.operativos, nDias, diaMuestra)
        : datos.cuadrante,
    )
  }, [
    anio,
    mes,
    nDias,
    hoy,
    datos.loading,
    datos.firebaseOk,
    datos.asignaciones,
    datos.cuadrante,
    datos.operativos,
  ])

  const puestos = useMemo(
    () => datos.puestos.filter((puesto) => puesto.ambito === 'OPERATIVO'),
    [datos.puestos],
  )
  const dias = useMemo(() => Array.from({ length: nDias }, (_, i) => i + 1), [nDias])
  const agentesPorId = useMemo(
    () => new Map(datos.operativos.map((agente) => [agente.id, agente])),
    [datos.operativos],
  )

  function resumenDe(dia: number, fuente: AsignacionesDiarias = asignaciones) {
    const fecha = isoFecha(anio, mes, dia)
    return resumenDiaServicio({
      cuadrante: cuadranteVista,
      asignaciones: fuente,
      agentes: datos.operativos,
      puestos,
      minimos: minimosParaFecha(fecha, datos.eventos, minimosSemana, puestos),
      fecha,
      dia,
    })
  }

  async function persistir(siguiente: AsignacionesDiarias) {
    if (!datos.firebaseOk) return
    setGuardando(true)
    setErrorGuardado(null)
    try {
      await saveCuadrante(
        mes,
        anio,
        cuadranteParaFirestore(
          datos.cuadrante,
          siguiente,
          datos.operativos,
          anio,
          mes,
          nDias,
          { puestos, permisos: tiposPermiso },
        ),
      )
    } catch (err) {
      setErrorGuardado(
        err instanceof Error ? err.message : 'No se pudo guardar el cambio de puesto',
      )
    } finally {
      setGuardando(false)
    }
  }

  function cambiarPuesto(
    agente: FichaPolicia,
    fecha: string,
    turno: TurnoOperativo,
    puesto: string,
  ) {
    if (!puedeEditar) return
    if (!puesto) {
      const siguiente = quitarAsignacionCelda(asignaciones, agente.id, fecha, turno)
      setAsignaciones(siguiente)
      void persistir(siguiente)
      return
    }
    const resultado = asignarPuestoEnCelda(
      asignaciones,
      agente,
      fecha,
      turno,
      puesto,
      puestos,
    )
    if (!resultado.ok) {
      void alert(resultado.error, 'Puesto no disponible')
      return
    }
    setAsignaciones(resultado.asignaciones)
    void persistir(resultado.asignaciones)
  }

  return (
    <div className="flex min-h-0 flex-1 flex-col gap-2 overflow-y-auto">
      {datos.loading ? <p className="text-sm text-slate-500">Cargando el mes…</p> : null}
      {datos.error ? <p className={ALERT_ERROR}>{datos.error}</p> : null}
      {errorGuardado ? <p className={ALERT_ERROR}>{errorGuardado}</p> : null}
      {!datos.firebaseOk ? (
        <p className={ALERT_INFO}>
          Sin Firestore los cambios de puesto se ven aquí, pero no se guardan en el servidor.
          {muestraPreview
            ? ' El día de hoy muestra a la plantilla en mañana para poder mover puestos.'
            : ''}
        </p>
      ) : null}
      {guardando ? <p className="text-xs font-semibold text-slate-500">Guardando puesto…</p> : null}
      <ul className="flex flex-col gap-2">
        {dias.map((dia) => {
          const abierto = dia === diaAbierto
          const resumen = resumenDe(dia)
          const cortos = puestosSinCubrir(resumen)
          const especial = esFinDeSemana(anio, mes, dia) || esFestivo(anio, mes, dia)
          const fecha = isoFecha(anio, mes, dia)
          return (
            <li key={dia} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                className={`flex w-full items-center gap-3 px-3 py-2 text-left ${FOCUS_RING}`}
                aria-expanded={abierto}
                onClick={() =>
                  setSeleccion({ clave: claveMes, dia: abierto ? 0 : dia })
                }
              >
                <span
                  className={`w-8 text-lg font-extrabold tabular-nums ${
                    especial ? 'text-red-600' : 'text-slate-900'
                  }`}
                >
                  {dia}
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block text-sm font-bold capitalize text-slate-800">
                    {DIAS[new Date(anio, mes - 1, dia).getDay()]}
                  </span>
                  <span
                    className={`block text-xs font-semibold ${
                      cortos.length > 0 ? 'text-rose-700' : 'text-emerald-700'
                    }`}
                  >
                    {cortos.length > 0
                      ? `${cortos.length} puesto${cortos.length === 1 ? '' : 's'} sin cubrir`
                      : 'Mínimos cubiertos'}
                  </span>
                </span>
                <ChevronDown
                  className={`h-4 w-4 shrink-0 text-slate-400 transition-transform ${
                    abierto ? 'rotate-180' : ''
                  }`}
                />
              </button>
              {abierto ? (
                <div className="grid grid-cols-1 gap-3 border-t border-slate-100 p-2 lg:grid-cols-3">
                  {TURNOS_COBERTURA.map((turno) => (
                    <TurnoDia
                      key={turno}
                      turno={turno}
                      resumen={resumen}
                      fecha={fecha}
                      puestos={puestos}
                      agentesPorId={agentesPorId}
                      puedeEditar={puedeEditar}
                      onCambiar={cambiarPuesto}
                    />
                  ))}
                </div>
              ) : null}
            </li>
          )
        })}
      </ul>
    </div>
  )
}

function TurnoDia({
  turno,
  resumen,
  fecha,
  puestos,
  agentesPorId,
  puedeEditar,
  onCambiar,
}: {
  turno: TurnoOperativo
  resumen: ResumenDiaServicio
  fecha: string
  puestos: PuestoConfig[]
  agentesPorId: Map<string, FichaPolicia>
  puedeEditar: boolean
  onCambiar: (agente: FichaPolicia, fecha: string, turno: TurnoOperativo, puesto: string) => void
}) {
  const lineas = resumen.lineas.filter((linea) => linea.turno === turno)
  const sueltos = resumen.sinPuesto.filter((persona) => persona.turno === turno)
  const disponibles = resumen.jornadaDisponible.filter((persona) => persona.turno === turno)
  if (lineas.length === 0 && sueltos.length === 0 && disponibles.length === 0) return null
  const cobertura = resumen.turnos[turno]

  return (
    <section className="min-w-0 rounded-lg border border-slate-200 bg-slate-50/70">
      <h3 className="flex items-baseline justify-between gap-2 border-b border-slate-200 px-2 py-1.5 text-xs font-bold uppercase tracking-wide text-slate-600">
        {TURNO_LABEL[turno]}
        <span className="font-semibold normal-case tracking-normal text-slate-400">
          {cobertura.trabajando}/{cobertura.minimo}
        </span>
      </h3>
      <ul className="divide-y divide-slate-200">
        {lineas.map((linea) => (
          <LineaPuesto
            key={linea.puesto}
            linea={linea}
            fecha={fecha}
            turno={turno}
            puestos={puestos}
            agentesPorId={agentesPorId}
            puedeEditar={puedeEditar}
            onCambiar={onCambiar}
          />
        ))}
      </ul>
      {disponibles.length > 0 || sueltos.length > 0 ? (
        <div className="flex flex-col gap-1 border-t border-slate-200 px-2 py-1.5">
          {disponibles.map((persona) => (
            <PersonaSuelta
              key={`jd-${persona.id}`}
              persona={persona}
              fecha={fecha}
              turno={turno}
              puestos={puestos}
              agentesPorId={agentesPorId}
              valor={NOMBRE_JORNADA_DISPONIBLE}
              puedeEditar={puedeEditar}
              onCambiar={onCambiar}
            />
          ))}
          {sueltos.map((persona) => (
            <PersonaSuelta
              key={`sin-${persona.id}`}
              persona={persona}
              fecha={fecha}
              turno={turno}
              puestos={puestos}
              agentesPorId={agentesPorId}
              valor=""
              puedeEditar={puedeEditar}
              onCambiar={onCambiar}
            />
          ))}
        </div>
      ) : null}
    </section>
  )
}

function LineaPuesto({
  linea,
  fecha,
  turno,
  puestos,
  agentesPorId,
  puedeEditar,
  onCambiar,
}: {
  linea: LineaPuestoDia
  fecha: string
  turno: TurnoOperativo
  puestos: PuestoConfig[]
  agentesPorId: Map<string, FichaPolicia>
  puedeEditar: boolean
  onCambiar: (agente: FichaPolicia, fecha: string, turno: TurnoOperativo, puesto: string) => void
}) {
  const corto = linea.minimo > 0 && linea.personas.length < linea.minimo
  return (
    <li className={`px-2 py-1 ${corto ? 'bg-rose-50' : 'bg-white'}`}>
      <p className="flex items-baseline gap-1.5 text-xs">
        <span className={`font-mono font-bold ${corto ? 'text-rose-800' : 'text-slate-500'}`}>
          {linea.abreviatura}
        </span>
        <span className={`min-w-0 flex-1 truncate font-semibold ${corto ? 'text-rose-950' : 'text-slate-800'}`}>
          {linea.puesto}
        </span>
        <span className={`shrink-0 font-bold tabular-nums ${corto ? 'text-rose-700' : 'text-emerald-700'}`}>
          {linea.personas.length}/{linea.minimo}
        </span>
      </p>
      {linea.personas.length === 0 ? (
        <p className={`text-[11px] ${corto ? 'font-semibold text-rose-700' : 'text-slate-400'}`}>
          Nadie asignado
        </p>
      ) : (
        <ul>
          {linea.personas.map((persona) => {
            const agente = agentesPorId.get(persona.id)
            if (!agente) return null
            return (
              <li key={persona.id}>
                <SelectorPuesto
                  agente={agente}
                  nombre={`${persona.placa} ${persona.nombre}`}
                  valor={linea.puesto}
                  puestos={puestos}
                  puedeEditar={puedeEditar}
                  ocultarPuesto
                  onCambiar={(puesto) => onCambiar(agente, fecha, turno, puesto)}
                />
              </li>
            )
          })}
        </ul>
      )}
    </li>
  )
}

function PersonaSuelta({
  persona,
  fecha,
  turno,
  puestos,
  agentesPorId,
  valor,
  puedeEditar,
  onCambiar,
}: {
  persona: PersonaTurno
  fecha: string
  turno: TurnoOperativo
  puestos: PuestoConfig[]
  agentesPorId: Map<string, FichaPolicia>
  valor: string
  puedeEditar: boolean
  onCambiar: (agente: FichaPolicia, fecha: string, turno: TurnoOperativo, puesto: string) => void
}) {
  const agente = agentesPorId.get(persona.id)
  if (!agente) return null
  return (
    <div>
      <SelectorPuesto
        agente={agente}
        nombre={`${persona.placa} ${persona.nombre}`}
        valor={valor}
        puestos={puestos}
        puedeEditar={puedeEditar}
        onCambiar={(puesto) => onCambiar(agente, fecha, turno, puesto)}
      />
    </div>
  )
}

function SelectorPuesto({
  agente,
  nombre,
  valor,
  puestos,
  puedeEditar,
  ocultarPuesto = false,
  onCambiar,
}: {
  agente: FichaPolicia
  nombre: string
  valor: string
  puestos: PuestoConfig[]
  puedeEditar: boolean
  ocultarPuesto?: boolean
  onCambiar: (puesto: string) => void
}) {
  const etiqueta =
    valor === NOMBRE_JORNADA_DISPONIBLE
      ? 'Jornada disponible'
      : valor || 'Sin puesto'
  if (!puedeEditar) {
    return (
      <p className="flex items-baseline justify-between gap-2 text-[11px] leading-5 text-slate-700">
        <span className="min-w-0 truncate font-semibold">{nombre}</span>
        {ocultarPuesto ? null : (
          <span className="shrink-0 font-medium text-slate-500">{etiqueta}</span>
        )}
      </p>
    )
  }
  const opciones = opcionesPuesto(agente, puestos, valor)
  return (
    <label className="grid grid-cols-[minmax(0,1fr)_9.5rem] items-center gap-1.5 text-[11px] leading-5 text-slate-700">
      <span className="min-w-0 truncate font-semibold">{nombre}</span>
      <select
        className={`h-6 w-full rounded border border-slate-200 bg-white px-1 text-[11px] ${FOCUS_RING}`}
        aria-label={`Puesto de ${nombre}`}
        value={valor}
        onChange={(event) => onCambiar(event.target.value)}
      >
        <option value="">Sin puesto</option>
        {valor === NOMBRE_JORNADA_DISPONIBLE ? (
          <option value={NOMBRE_JORNADA_DISPONIBLE}>Jornada disponible</option>
        ) : null}
        {opciones
          .filter((nombrePuesto) => nombrePuesto !== NOMBRE_JORNADA_DISPONIBLE)
          .map((nombrePuesto) => (
            <option key={nombrePuesto} value={nombrePuesto}>
              {nombrePuesto}
            </option>
          ))}
      </select>
    </label>
  )
}
