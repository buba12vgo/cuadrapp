import { useEffect, useMemo, useState } from 'react'
import { Briefcase } from 'lucide-react'
import { iniciarArrastrePuesto } from '@/lib/asignacionPuestos'
import {
  guardarFiltroTurnoBolsa,
  guardarPuestosOcultos,
  leerFiltroTurnoBolsa,
  leerPuestosOcultos,
  type FiltroTurnoBolsa,
} from '@/lib/bolsaPuestosPreferencias'
import {
  AMBITO_PUESTO_LABEL,
  type AmbitoPuesto,
} from '@/lib/calendarioPuestos'
import { usePuestosData } from '@/lib/puestosStore'
import { BLOQUE, TITULO_BLOQUE } from '@/lib/uiStyles'

const CLASE_PASTILLA =
  'cursor-grab rounded-lg border border-line bg-slate-50 px-1.5 py-0.5 text-sm font-bold text-slate-800 shadow-card active:cursor-grabbing hover:border-brand-200 hover:bg-white'

const CLASE_PASTILLA_SELECCIONADA =
  'cursor-grab rounded-lg border border-brand-500 bg-brand-50 px-1.5 py-0.5 text-sm font-bold text-brand-900 shadow-card ring-2 ring-brand-400 active:cursor-grabbing'

const TURNOS_FILTRO: Array<{ valor: FiltroTurnoBolsa; label: string }> = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'M', label: 'M' },
  { valor: 'T', label: 'T' },
  { valor: 'N', label: 'N' },
]

export function BolsaPuestosPanel({
  filtroTurno,
  onFiltroTurno,
  ambito = 'OPERATIVO',
  puestoSeleccionado = null,
  onSeleccionarPuesto,
  mostrarFiltroTurno = true,
}: {
  filtroTurno: FiltroTurnoBolsa
  onFiltroTurno: (filtro: FiltroTurnoBolsa) => void
  ambito?: AmbitoPuesto
  puestoSeleccionado?: string | null
  onSeleccionarPuesto?: (puesto: string | null) => void
  mostrarFiltroTurno?: boolean
}) {
  const [puestos] = usePuestosData()
  const [ocultos, setOcultos] = useState<Set<string>>(
    () => new Set(leerPuestosOcultos()),
  )

  useEffect(() => {
    guardarPuestosOcultos([...ocultos])
  }, [ocultos])

  const delAmbito = useMemo(
    () => puestos.filter((puesto) => puesto.ambito === ambito),
    [puestos, ambito],
  )

  const visibles = useMemo(
    () => delAmbito.filter((puesto) => !ocultos.has(puesto.codigo)),
    [delAmbito, ocultos],
  )
  const escondidos = useMemo(
    () => delAmbito.filter((puesto) => ocultos.has(puesto.codigo)),
    [delAmbito, ocultos],
  )

  function alternar(codigo: string) {
    setOcultos((actual) => {
      const siguiente = new Set(actual)
      if (siguiente.has(codigo)) siguiente.delete(codigo)
      else siguiente.add(codigo)
      return siguiente
    })
  }

  function elegirTurno(filtro: FiltroTurnoBolsa) {
    onFiltroTurno(filtro)
    guardarFiltroTurnoBolsa(filtro)
  }

  function clicPuesto(nombre: string) {
    if (!onSeleccionarPuesto) return
    onSeleccionarPuesto(puestoSeleccionado === nombre ? null : nombre)
  }

  return (
    <div className={BLOQUE}>
      <div className={`${TITULO_BLOQUE} mb-1 flex items-center gap-1`}>
        <Briefcase className="h-2.5 w-2.5" />
        Bolsa · {AMBITO_PUESTO_LABEL[ambito]}
      </div>
      {mostrarFiltroTurno ? (
        <div className="mb-1.5 flex gap-0.5">
          {TURNOS_FILTRO.map((opcion) => (
            <button
              key={opcion.valor}
              type="button"
              className={`h-6 flex-1 rounded-lg text-sm font-bold ${
                filtroTurno === opcion.valor
                  ? 'bg-brand-600 text-white'
                  : 'border border-line bg-white text-slate-700 hover:bg-brand-50'
              }`}
              onClick={() => elegirTurno(opcion.valor)}
            >
              {opcion.label}
            </button>
          ))}
        </div>
      ) : null}
      <p className="mb-1.5 text-sm leading-tight text-slate-500">
        {onSeleccionarPuesto
          ? 'Arrastra o selecciona y pulsa una celda.'
          : filtroTurno === 'TODOS'
            ? 'Arrastra a cabecera o celda.'
            : `Filtro ${filtroTurno} activo.`}
      </p>
      <ul className="flex max-h-52 flex-col gap-1 overflow-auto">
        {visibles.map((puesto) => {
          const seleccionado = puestoSeleccionado === puesto.nombre
          return (
            <li key={puesto.codigo} className="flex items-start gap-1">
              <input
                type="checkbox"
                className="mt-0.5 shrink-0"
                checked
                aria-label={`Ocultar ${puesto.nombre}`}
                onChange={() => alternar(puesto.codigo)}
              />
              <button
                type="button"
                draggable
                className={`${
                  seleccionado ? CLASE_PASTILLA_SELECCIONADA : CLASE_PASTILLA
                } min-w-0 flex-1 text-left`}
                title={puesto.nombre}
                aria-pressed={seleccionado}
                onClick={() => clicPuesto(puesto.nombre)}
                onDragStart={(event) =>
                  iniciarArrastrePuesto(event, puesto.nombre)
                }
              >
                <span className="font-mono">{puesto.abreviatura}</span>
                <span className="mt-0.5 block truncate font-normal text-slate-600">
                  {puesto.nombre}
                </span>
              </button>
            </li>
          )
        })}
        {visibles.length === 0 ? (
          <li className="text-sm text-slate-500">
            No hay puestos de {AMBITO_PUESTO_LABEL[ambito].toLowerCase()}.
            Créalos en Puestos.
          </li>
        ) : null}
        {escondidos.length > 0 ? (
          <li className="mt-1 border-t border-slate-100 pt-1">
            <p className="mb-0.5 text-sm font-bold uppercase text-slate-500">
              Ocultos
            </p>
            <ul className="flex flex-col gap-0.5">
              {escondidos.map((puesto) => (
                <li key={puesto.codigo}>
                  <label className="flex cursor-pointer items-center gap-1 text-sm text-slate-500">
                    <input
                      type="checkbox"
                      checked={false}
                      onChange={() => alternar(puesto.codigo)}
                    />
                    <span className="font-mono">{puesto.abreviatura}</span>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </div>
  )
}

export function filtroTurnoInicial(): FiltroTurnoBolsa {
  return leerFiltroTurnoBolsa()
}
