import type { SaldoPermiso } from '@/lib/cuposPermiso'

function textoTotal(saldo: SaldoPermiso) {
  return saldo.cupo == null ? 'Sin tope' : String(saldo.cupo)
}

function textoPendiente(saldo: SaldoPermiso) {
  return saldo.restan == null ? '—' : String(saldo.restan)
}

/** Permisos con cupo o con días ya disfrutados. */
export function permisosConSaldo(saldos: SaldoPermiso[]) {
  return saldos.filter((saldo) => saldo.cupo != null || saldo.usados > 0)
}

export function TablaPermisosAgente({ saldos }: { saldos: SaldoPermiso[] }) {
  const filas = permisosConSaldo(saldos)
  const total = filas.reduce((suma, saldo) => suma + (saldo.cupo ?? 0), 0)
  const disfrutados = filas.reduce((suma, saldo) => suma + saldo.usados, 0)
  const pendientes = filas.reduce(
    (suma, saldo) => suma + (saldo.restan == null ? 0 : saldo.restan),
    0,
  )

  if (filas.length === 0) {
    return (
      <p className="text-sm text-slate-500">Este agente no tiene permisos con cupo.</p>
    )
  }

  return (
    <table className="w-full text-sm">
      <thead>
        <tr className="text-left text-[11px] font-bold uppercase tracking-wide text-slate-400">
          <th className="pb-2 font-bold">Permiso</th>
          <th className="pb-2 text-right font-bold">Totales</th>
          <th className="pb-2 text-right font-bold">Disfrutados</th>
          <th className="pb-2 text-right font-bold">Pendientes</th>
        </tr>
      </thead>
      <tbody>
        {filas.map((saldo) => (
          <tr key={saldo.codigo} className="border-t border-slate-100">
            <td className="py-2 pr-2">
              <span className="font-semibold text-slate-900">{saldo.nombre}</span>
              <span className="ml-1.5 font-mono text-xs text-slate-400">
                {saldo.abreviatura}
              </span>
            </td>
            <td className="py-2 text-right font-semibold tabular-nums text-slate-800">
              {textoTotal(saldo)}
            </td>
            <td className="py-2 text-right tabular-nums text-slate-700">{saldo.usados}</td>
            <td
              className={`py-2 text-right font-semibold tabular-nums ${
                saldo.restan != null && saldo.restan < 0
                  ? 'text-rose-700'
                  : 'text-emerald-800'
              }`}
            >
              {textoPendiente(saldo)}
            </td>
          </tr>
        ))}
      </tbody>
      <tfoot>
        <tr className="border-t-2 border-slate-200 text-slate-950">
          <th className="py-2 text-left text-xs font-extrabold uppercase">Suma</th>
          <td className="py-2 text-right font-extrabold tabular-nums">{total}</td>
          <td className="py-2 text-right font-extrabold tabular-nums">{disfrutados}</td>
          <td className="py-2 text-right font-extrabold tabular-nums">{pendientes}</td>
        </tr>
      </tfoot>
    </table>
  )
}
