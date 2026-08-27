import { useEffect, useMemo, useState } from 'react'
import { iniciarArrastrePuesto } from '@/lib/asignacionPuestos'
import {
  guardarFiltroTurnoBolsa,
  guardarPuestosOcultos,
  leerFiltroTurnoBolsa,
  leerPuestosOcultos,
  type FiltroTurnoBolsa,
} from '@/lib/bolsaPuestosPreferencias'
import { usePuestosData } from '@/lib/puestosStore'

const CLASE_PASTILLA =
  'cursor-grab border border-slate-400 bg-slate-100 px-1.5 py-1 text-[10px] font-bold text-slate-800 shadow-sm active:cursor-grabbing hover:bg-slate-200 hover:ring-2 hover:ring-slate-500'

const TURNOS_FILTRO: Array<{ valor: FiltroTurnoBolsa; label: string }> = [
  { valor: 'TODOS', label: 'Todos' },
  { valor: 'M', label: 'M' },
  { valor: 'T', label: 'T' },
  { valor: 'N', label: 'N' },
]

export function BolsaPuestosPanel({
  filtroTurno,
  onFiltroTurno,
}: {
  filtroTurno: FiltroTurnoBolsa
  onFiltroTurno: (filtro: FiltroTurnoBolsa) => void
}) {
  const [puestos] = usePuestosData()
  const [ocultos, setOcultos] = useState<Set<string>>(
    () => new Set(leerPuestosOcultos()),
  )

  useEffect(() => {
    guardarPuestosOcultos([...ocultos])
  }, [ocultos])

  const visibles = useMemo(
    () => puestos.filter((puesto) => !ocultos.has(puesto.codigo)),
    [puestos, ocultos],
  )
  const escondidos = useMemo(
    () => puestos.filter((puesto) => ocultos.has(puesto.codigo)),
    [puestos, ocultos],
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

  return (
    <aside className="flex w-44 shrink-0 flex-col border-l border-slate-500 bg-slate-50">
      <h2 className="border-b border-slate-300 px-2 py-1.5 text-[10px] font-bold uppercase tracking-wide text-slate-700">
        Bolsa de puestos
      </h2>
      <div className="flex gap-0.5 border-b border-slate-200 p-1.5">
        {TURNOS_FILTRO.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            className={`h-6 flex-1 text-[10px] font-bold ${
              filtroTurno === opcion.valor
                ? 'bg-slate-900 text-white'
                : 'border border-slate-300 bg-white text-slate-700 hover:bg-slate-100'
            }`}
            onClick={() => elegirTurno(opcion.valor)}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      <p className="border-b border-slate-200 px-2 py-1 text-[9px] leading-tight text-slate-500">
        {filtroTurno === 'TODOS'
          ? 'Arrastra a cabecera (mes) o celda (día). Si el mínimo del puesto ya está cubierto, se busca otro; nunca se deja el día vacío.'
          : `Filtro ${filtroTurno}: cabecera y celdas de ese turno.`}
      </p>
      <ul className="flex min-h-0 flex-1 flex-col gap-1.5 overflow-auto p-2">
        {visibles.map((puesto) => (
          <li key={puesto.codigo} className="flex items-start gap-1">
            <input
              type="checkbox"
              className="mt-1.5 shrink-0"
              checked
              aria-label={`Ocultar ${puesto.nombre}`}
              title="Ocultar de la bolsa"
              onChange={() => alternar(puesto.codigo)}
            />
            <button
              type="button"
              draggable
              className={`${CLASE_PASTILLA} min-w-0 flex-1 text-left`}
              title={puesto.nombre}
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
        ))}
        {visibles.length === 0 ? (
          <li className="px-0.5 text-[10px] text-slate-500">
            No hay puestos visibles.
          </li>
        ) : null}
        {escondidos.length > 0 ? (
          <li className="mt-1 border-t border-slate-200 pt-1.5">
            <p className="mb-1 text-[9px] font-bold tracking-wide text-slate-500 uppercase">
              Ocultos
            </p>
            <ul className="flex flex-col gap-1">
              {escondidos.map((puesto) => (
                <li key={puesto.codigo}>
                  <label className="flex cursor-pointer items-center gap-1 text-[10px] text-slate-500">
                    <input
                      type="checkbox"
                      className="shrink-0"
                      checked={false}
                      aria-label={`Mostrar ${puesto.nombre}`}
                      onChange={() => alternar(puesto.codigo)}
                    />
                    <span className="font-mono">{puesto.abreviatura}</span>
                    <span className="truncate">{puesto.nombre}</span>
                  </label>
                </li>
              ))}
            </ul>
          </li>
        ) : null}
      </ul>
    </aside>
  )
}

export function filtroTurnoInicial(): FiltroTurnoBolsa {
  return leerFiltroTurnoBolsa()
}
