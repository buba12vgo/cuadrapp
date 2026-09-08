import {
  CATEGORIA_LABEL,
  ESTADO_LABEL,
  ORDEN_CATEGORIAS,
  reglasPorCategoria,
  type EstadoRegla,
} from '@/lib/reglasCatalogo'
import { ReglasResumenPanel } from '@/components/dashboard/ReglasResumenPanel'
import {
  DashboardBody,
  DashboardMain,
  DashboardMainScroll,
} from '@/components/ui/DashboardLayout'
import { PageHeader } from '@/components/ui/PageHeader'
import { BLOQUE, PAGE_SECTION } from '@/lib/uiStyles'

const ESTADO_ESTILO: Record<EstadoRegla, string> = {
  implementada: 'border-emerald-200 bg-emerald-50 text-emerald-800',
  parcial: 'border-amber-200 bg-amber-50 text-amber-800',
  planificada: 'border-slate-200 bg-slate-100 text-slate-600',
}

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
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Reglas"
        subtitle={`${total} reglas documentadas · ${implementadas} implementadas`}
      />

      <DashboardBody>
        <DashboardMain>
          <DashboardMainScroll className="flex flex-col gap-2 p-1.5">
            <div className={`${BLOQUE} text-sm leading-relaxed text-slate-700`}>
              <p>
                Catálogo de condicionantes de turnos, días, puestos y plantilla.
                Las <span className="font-medium text-emerald-800">implementadas</span>{' '}
                ya tienen lógica en Cuadrapp.
              </p>
            </div>

            {ORDEN_CATEGORIAS.map((categoria) => {
              const reglas = agrupadas.get(categoria) ?? []
              if (reglas.length === 0) return null

              return (
                <section key={categoria} className={BLOQUE}>
                  <header className="mb-1.5 border-b border-slate-100 pb-1">
                    <h2 className="text-sm font-semibold text-slate-900">
                      {CATEGORIA_LABEL[categoria]}
                    </h2>
                    <p className="text-sm text-slate-500">
                      {reglas.length} {reglas.length === 1 ? 'regla' : 'reglas'}
                    </p>
                  </header>
                  <ul className="divide-y divide-slate-100">
                    {reglas.map((regla) => (
                      <li key={regla.id} className="py-1.5 first:pt-0 last:pb-0">
                        <div className="flex flex-wrap items-start justify-between gap-1.5">
                          <h3 className="text-sm font-medium text-slate-900">
                            {regla.titulo}
                          </h3>
                          <span
                            className={`shrink-0 rounded border px-1.5 py-0.5 text-sm font-semibold uppercase tracking-wide ${ESTADO_ESTILO[regla.estado]}`}
                          >
                            {ESTADO_LABEL[regla.estado]}
                          </span>
                        </div>
                        <p className="mt-0.5 text-sm text-slate-700">
                          {regla.descripcion}
                        </p>
                        {regla.detalle ? (
                          <p className="mt-1 text-sm text-slate-500">
                            {regla.detalle}
                          </p>
                        ) : null}
                        {regla.referencia ? (
                          <p className="mt-1 font-mono text-sm text-slate-400">
                            {regla.referencia}
                          </p>
                        ) : null}
                      </li>
                    ))}
                  </ul>
                </section>
              )
            })}
          </DashboardMainScroll>
        </DashboardMain>
        <ReglasResumenPanel />
      </DashboardBody>
    </section>
  )
}
