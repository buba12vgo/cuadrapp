import { CalendarClock } from 'lucide-react'
import { iniciarArrastrePuesto } from '@/lib/asignacionPuestos'
import {
  ABREV_JORNADA_DISPONIBLE,
  NOMBRE_JORNADA_DISPONIBLE,
} from '@/lib/jornadaDisponible'
import { BLOQUE, TITULO_BLOQUE } from '@/lib/uiStyles'

const CLASE_PASTILLA =
  'cursor-grab rounded-lg border border-violet-200 bg-violet-50 px-1.5 py-0.5 text-sm font-bold text-violet-950 shadow-card active:cursor-grabbing hover:border-violet-300 hover:bg-white'

const CLASE_PASTILLA_SELECCIONADA =
  'cursor-grab rounded-lg border border-violet-500 bg-violet-100 px-1.5 py-0.5 text-sm font-bold text-violet-950 shadow-card ring-2 ring-violet-400 active:cursor-grabbing'

export function JornadaDisponibleChip({
  seleccionado = false,
  onSeleccionar,
}: {
  seleccionado?: boolean
  onSeleccionar?: (nombre: string | null) => void
}) {
  function clic() {
    if (!onSeleccionar) return
    onSeleccionar(seleccionado ? null : NOMBRE_JORNADA_DISPONIBLE)
  }

  return (
    <div className={BLOQUE}>
      <div className={`${TITULO_BLOQUE} mb-1 flex items-center gap-1`}>
        <CalendarClock className="h-2.5 w-2.5" />
        Jornada Disponible
      </div>
      <p className="mb-1.5 text-sm leading-tight text-slate-500">
        Marca una jornada M/T/N. Se cobra y genera un libre por disponibilidad.
      </p>
      <button
        type="button"
        draggable
        className={`${
          seleccionado ? CLASE_PASTILLA_SELECCIONADA : CLASE_PASTILLA
        } w-full text-left`}
        title={NOMBRE_JORNADA_DISPONIBLE}
        aria-pressed={seleccionado}
        onClick={clic}
        onDragStart={(event) =>
          iniciarArrastrePuesto(event, NOMBRE_JORNADA_DISPONIBLE)
        }
      >
        <span className="font-mono">{ABREV_JORNADA_DISPONIBLE}</span>
        <span className="mt-0.5 block truncate font-normal text-violet-800/80">
          {NOMBRE_JORNADA_DISPONIBLE}
        </span>
      </button>
    </div>
  )
}
