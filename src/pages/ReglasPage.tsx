import {
  CATEGORIA_LABEL,
  ESTADO_LABEL,
  ORDEN_CATEGORIAS,
  reglasPorCategoria,
  type EstadoRegla,
} from '@/lib/reglasCatalogo'

const ESTADO_ESTILO: Record<EstadoRegla, string> = {
  implementada: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  parcial: 'border-amber-200 bg-amber-50 text-amber-800',
  planificada: 'border-slate-200 bg-slate-100 text-slate-600',
}

const BLOQUE = 'border border-slate-200 bg-white'

export function ReglasPage() {
  const agrupadas = reglasPorCategoria()
  const total = [...agrupadas.values()].reduce(
    (suma, lista) => suma + lista.length,
    0,
  )
  const implementadas = [...agrupadas.values()]
    .flat()
    .filter((regla) => regla.estado === 'implementada').length

  return (
    <section className="flex h-full min-h-0 flex-col gap-3 overflow-auto p-3">
      <header className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-semibold tracking-tight">Reglas</h1>
          <p className="text-sm text-slate-500">
            {total} reglas documentadas · {implementadas} implementadas en la
            aplicación
          </p>
        </div>
      </header>

      <div className={`${BLOQUE} px-4 py-3 text-sm text-slate-700`}>
        <p>
          Catálogo de condicionantes de turnos, días, puestos y plantilla. Se
          actualiza al incorporar nuevas reglas en el código. Las marcadas como{' '}
          <span className="font-medium text-emerald-800">implementadas</span> ya
          tienen lógica o avisos en Cuadrapp; las{' '}
          <span className="font-medium text-slate-600">planificadas</span> están
          pendientes.
        </p>
      </div>

      <div className="flex flex-col gap-4">
        {ORDEN_CATEGORIAS.map((categoria) => {
          const reglas = agrupadas.get(categoria) ?? []
          if (reglas.length === 0) return null

          return (
            <section key={categoria} className={BLOQUE}>
              <header className="border-b border-slate-200 bg-slate-50 px-4 py-2.5">
                <h2 className="text-sm font-semibold text-slate-900">
                  {CATEGORIA_LABEL[categoria]}
                </h2>
                <p className="text-[11px] text-slate-500">
                  {reglas.length}{' '}
                  {reglas.length === 1 ? 'regla' : 'reglas'}
                </p>
              </header>
              <ul className="divide-y divide-slate-100">
                {reglas.map((regla) => (
                  <li key={regla.id} className="px-4 py-3">
                    <div className="flex flex-wrap items-start justify-between gap-2">
                      <h3 className="text-sm font-medium text-slate-900">
                        {regla.titulo}
                      </h3>
                      <span
                        className={`shrink-0 rounded border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${ESTADO_ESTILO[regla.estado]}`}
                      >
                        {ESTADO_LABEL[regla.estado]}
                      </span>
                    </div>
                    <p className="mt-1 text-sm text-slate-700">
                      {regla.descripcion}
                    </p>
                    {regla.detalle ? (
                      <p className="mt-1.5 text-xs text-slate-500">
                        {regla.detalle}
                      </p>
                    ) : null}
                    {regla.referencia ? (
                      <p className="mt-2 font-mono text-[10px] text-slate-400">
                        {regla.referencia}
                      </p>
                    ) : null}
                  </li>
                ))}
              </ul>
            </section>
          )
        })}
      </div>
    </section>
  )
}
