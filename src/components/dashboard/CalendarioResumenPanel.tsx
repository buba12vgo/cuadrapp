import { CalendarDays, Flag } from 'lucide-react'
import { useMemo } from 'react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import {
  KpiCard,
  KpiGrid2,
  KpiHighlight,
  KpiSection,
} from '@/components/ui/DashboardKpi'
import { tipoEventoEsFestivo } from '@/lib/tiposEvento'
import { useTiposEvento } from '@/lib/tiposEventoStore'
import type { EventoOperativo } from '@/types'

type Props = {
  eventos: EventoOperativo[]
  anio: number
  mes: number
}

export function CalendarioResumenPanel({ eventos, anio, mes }: Props) {
  const [tipos] = useTiposEvento()
  const stats = useMemo(() => {
    const mesStr = `${anio}-${String(mes).padStart(2, '0')}`
    const delMes = eventos.filter((e) => e.fecha.startsWith(mesStr))
    const porTipo = new Map<string, number>()
    let festivo = 0
    for (const evento of delMes) {
      porTipo.set(evento.tipo, (porTipo.get(evento.tipo) ?? 0) + 1)
      if (tipoEventoEsFestivo(evento.tipo, tipos)) festivo += 1
    }
    const detalle = [...porTipo.entries()]
      .sort((a, b) => b[1] - a[1])
      .slice(0, 4)
    return { delMes: delMes.length, festivo, detalle, total: eventos.length }
  }, [eventos, anio, mes, tipos])

  return (
    <DashboardSidebar>
      <KpiGrid2>
        <KpiCard icon={CalendarDays} label="Mes" value={stats.delMes} />
        <KpiCard icon={CalendarDays} label="Total" value={stats.total} />
      </KpiGrid2>
      <KpiSection title="Tipos (mes)">
        <div className="grid grid-cols-2 gap-1.5">
          <KpiHighlight
            variant="emerald"
            icon={Flag}
            label="Festivos"
            title={stats.festivo}
          />
          {stats.detalle.map(([codigo, n]) => (
            <KpiHighlight
              key={codigo}
              variant="sky"
              label={tipos.find((tipo) => tipo.codigo === codigo)?.nombre ?? codigo}
              title={n}
            />
          ))}
        </div>
      </KpiSection>
    </DashboardSidebar>
  )
}
