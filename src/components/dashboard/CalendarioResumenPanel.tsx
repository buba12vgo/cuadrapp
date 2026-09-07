import { CalendarDays, PartyPopper, Ship, Music } from 'lucide-react'
import { useMemo } from 'react'
import { DashboardSidebar } from '@/components/ui/DashboardLayout'
import {
  KpiCard,
  KpiGrid2,
  KpiHighlight,
  KpiSection,
} from '@/components/ui/DashboardKpi'
import type { EventoOperativo } from '@/types'

type Props = {
  eventos: EventoOperativo[]
  anio: number
  mes: number
}

export function CalendarioResumenPanel({ eventos, anio, mes }: Props) {
  const stats = useMemo(() => {
    const mesStr = `${anio}-${String(mes).padStart(2, '0')}`
    const delMes = eventos.filter((e) => e.fecha.startsWith(mesStr))
    const festivo = delMes.filter((e) => e.tipo === 'FESTIVO').length
    const crucero = delMes.filter((e) => e.tipo === 'CRUCERO').length
    const concierto = delMes.filter((e) => e.tipo === 'CONCIERTO').length
    const otros = delMes.length - festivo - crucero - concierto
    return { delMes: delMes.length, festivo, crucero, concierto, otros, total: eventos.length }
  }, [eventos, anio, mes])

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
            icon={PartyPopper}
            label="Festivos"
            title={stats.festivo}
          />
          <KpiHighlight
            variant="sky"
            icon={Ship}
            label="Cruceros"
            title={stats.crucero}
          />
          <KpiHighlight
            variant="amber"
            icon={Music}
            label="Conciertos"
            title={stats.concierto}
          />
          <KpiHighlight
            variant="violet"
            label="Otros"
            title={stats.otros}
          />
        </div>
      </KpiSection>
    </DashboardSidebar>
  )
}
