import { CLASE_SEMAFORO, ETIQUETA_SEMAFORO, type ResumenDiaServicio } from '@/lib/coberturaDia'
import type { Turno } from '@/types'

const TURNO_LABEL: Record<'M' | 'T' | 'N', string> = {
  M: 'Mañana',
  T: 'Tarde',
  N: 'Noche',
}

function textoSobrante(sobrante: number) {
  if (sobrante > 0) return `+${sobrante}`
  return String(sobrante)
}

export function DiaCoberturaPanel({
  titulo,
  turnoPropio,
  resumen,
}: {
  titulo: string
  turnoPropio: Turno | null
  resumen: ResumenDiaServicio
}) {
  const turnos = (['M', 'T', 'N'] as const).filter((turno) =>
    resumen.lineas.some((linea) => linea.turno === turno),
  )

  return (
    <div className="flex flex-col gap-3">
      <div>
        <p className="text-sm font-bold text-ink">{titulo}</p>
        <p className="mt-1 flex flex-wrap items-center gap-2 text-xs text-slate-600">
          <span
            className={`inline-block h-2.5 w-2.5 rounded-full ${CLASE_SEMAFORO[resumen.nivel]}`}
            title={ETIQUETA_SEMAFORO[resumen.nivel]}
          />
          <span>{ETIQUETA_SEMAFORO[resumen.nivel]}</span>
          <span className="font-semibold text-slate-800">
            {resumen.trabajando} trabajando · mínimo {resumen.minimo} ·{' '}
            {textoSobrante(resumen.sobrante)}
          </span>
        </p>
        {turnoPropio ? (
          <p className="mt-1 text-xs text-slate-500">
            Tu servicio: <strong className="text-slate-800">{etiquetaTurno(turnoPropio)}</strong>
          </p>
        ) : null}
      </div>

      {turnos.length === 0 ? (
        <p className="text-sm text-slate-500">Este día no hay mínimos ni puestos asignados.</p>
      ) : (
        turnos.map((turno) => (
          <section key={turno}>
            <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
              {TURNO_LABEL[turno]}
            </h3>
            <ul className="flex flex-col gap-2">
              {resumen.lineas
                .filter((linea) => linea.turno === turno)
                .map((linea) => {
                  const corto = linea.personas.length < linea.minimo
                  return (
                    <li
                      key={`${linea.turno}-${linea.puesto}`}
                      className="rounded-lg border border-slate-200 bg-slate-50 px-2 py-1.5"
                    >
                      <p className="flex items-baseline justify-between gap-2 text-sm">
                        <span className="font-semibold text-slate-800">
                          <span className="font-mono text-xs text-slate-500">
                            {linea.abreviatura}
                          </span>{' '}
                          {linea.puesto}
                        </span>
                        <span
                          className={`shrink-0 text-xs font-bold tabular-nums ${
                            corto ? 'text-rose-700' : 'text-emerald-700'
                          }`}
                        >
                          {linea.personas.length}/{linea.minimo}
                        </span>
                      </p>
                      {linea.personas.length === 0 ? (
                        <p className="mt-0.5 text-xs text-slate-500">Nadie asignado</p>
                      ) : (
                        <ul className="mt-0.5">
                          {linea.personas.map((persona) => (
                            <li key={persona.id} className="text-xs text-slate-700">
                              <span className="font-mono font-semibold">{persona.placa}</span>{' '}
                              {persona.nombre}
                            </li>
                          ))}
                        </ul>
                      )}
                    </li>
                  )
                })}
            </ul>
          </section>
        ))
      )}

      {resumen.jornadaDisponible.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Jornada disponible
          </h3>
          <ul>
            {resumen.jornadaDisponible.map((persona) => (
              <li key={`${persona.turno}-${persona.id}`} className="text-xs text-slate-700">
                <span className="font-mono font-semibold">{persona.placa}</span> {persona.nombre}{' '}
                <span className="text-slate-400">({persona.turno})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}

      {resumen.sinPuesto.length > 0 ? (
        <section>
          <h3 className="mb-1 text-xs font-bold uppercase tracking-wide text-slate-500">
            Sin puesto
          </h3>
          <ul>
            {resumen.sinPuesto.map((persona) => (
              <li key={`${persona.turno}-${persona.id}`} className="text-xs text-slate-700">
                <span className="font-mono font-semibold">{persona.placa}</span> {persona.nombre}{' '}
                <span className="text-slate-400">({persona.turno})</span>
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  )
}

function etiquetaTurno(turno: Turno) {
  if (turno === 'M') return 'Mañana'
  if (turno === 'T') return 'Tarde'
  if (turno === 'N') return 'Noche'
  if (turno === 'MT') return 'Mañana y tarde'
  if (turno === 'P' || turno === 'L') return 'Permiso'
  if (turno === 'V') return 'Vacaciones'
  return 'Descanso'
}
