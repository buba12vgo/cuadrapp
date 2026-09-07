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
import { usePuestosData } from '@/lib/puestosStore'
import { BLOQUE, TITULO_BLOQUE } from '@/lib/uiStyles'

const CLASE_PASTILLA =
  'cursor-grab rounded border border-slate-200 bg-slate-50 px-1.5 py-0.5 text-[9px] font-bold text-slate-800 shadow-sm active:cursor-grabbing hover:border-slate-300 hover:bg-white'

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
    <div className={BLOQUE}>
      <div className={`${TITULO_BLOQUE} mb-1 flex items-center gap-1`}>
        <Briefcase className="h-2.5 w-2.5" />
        Bolsa de puestos
      </div>
      <div className="mb-1.5 flex gap-0.5">
        {TURNOS_FILTRO.map((opcion) => (
          <button
            key={opcion.valor}
            type="button"
            className={`h-6 flex-1 rounded-md text-[9px] font-bold ${
              filtroTurno === opcion.valor
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-700 hover:bg-slate-50'
            }`}
            onClick={() => elegirTurno(opcion.valor)}
          >
            {opcion.label}
          </button>
        ))}
      </div>
      <p className="mb-1.5 text-[8px] leading-tight text-slate-500">
        {filtroTurno === 'TODOS'
          ? 'Arrastra a cabecera o celda.'
          : `Filtro ${filtroTurno} activo.`}
      </p>
      <ul className="flex max-h-52 flex-col gap-1 overflow-auto">
        {visibles.map((puesto) => (
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
          <li className="text-[9px] text-slate-500">No hay puestos visibles.</li>
        ) : null}
        {escondidos.length > 0 ? (
          <li className="mt-1 border-t border-slate-100 pt-1">
            <p className="mb-0.5 text-[8px] font-bold uppercase text-slate-500">
              Ocultos
            </p>
            <ul className="flex flex-col gap-0.5">
              {escondidos.map((puesto) => (
                <li key={puesto.codigo}>
                  <label className="flex cursor-pointer items-center gap-1 text-[9px] text-slate-500">
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
