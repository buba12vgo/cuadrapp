import { useState } from 'react'
import { ChevronLeft, ChevronRight } from 'lucide-react'
import { ListaDiarioAgentes } from '@/components/ListaDiarioAgentes'
import { PageHeader, ToolbarSection } from '@/components/ui/PageHeader'
import { BTN_GHOST, FOCUS_RING, PAGE_SECTION } from '@/lib/uiStyles'

const MESES = [
  'Enero',
  'Febrero',
  'Marzo',
  'Abril',
  'Mayo',
  'Junio',
  'Julio',
  'Agosto',
  'Septiembre',
  'Octubre',
  'Noviembre',
  'Diciembre',
] as const

const SELECT_TOOLBAR =
  `h-8 rounded-lg border border-slate-200 bg-white px-2 text-xs text-ink ${FOCUS_RING} focus:border-brand-400`

function mesAnterior(anio: number, mes: number) {
  if (mes <= 1) return { anio: anio - 1, mes: 12 }
  return { anio, mes: mes - 1 }
}

function mesSiguiente(anio: number, mes: number) {
  if (mes >= 12) return { anio: anio + 1, mes: 1 }
  return { anio, mes: mes + 1 }
}

export function DiarioAgentesPage() {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  return (
    <section className={`${PAGE_SECTION} gap-1.5 overflow-hidden`}>
      <PageHeader
        title="Diario agentes"
        subtitle="Puestos del día y cambios de asignación"
        toolbar={
          <ToolbarSection label="Periodo">
            <button
              type="button"
              className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
              aria-label="Mes anterior"
              onClick={() => {
                const prev = mesAnterior(anio, mes)
                setAnio(prev.anio)
                setMes(prev.mes)
              }}
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <select
              className={`${SELECT_TOOLBAR} w-[8.25rem]`}
              aria-label="Mes"
              value={mes}
              onChange={(event) => setMes(Number(event.target.value))}
            >
              {MESES.map((nombre, indice) => (
                <option key={nombre} value={indice + 1}>
                  {nombre}
                </option>
              ))}
            </select>
            <select
              className={`${SELECT_TOOLBAR} w-[4.75rem]`}
              aria-label="Año"
              value={anio}
              onChange={(event) => setAnio(Number(event.target.value) || anio)}
            >
              {Array.from({ length: 21 }, (_, i) => 2020 + i).map((valor) => (
                <option key={valor} value={valor}>
                  {valor}
                </option>
              ))}
            </select>
            <button
              type="button"
              className={`${BTN_GHOST} h-8 w-8 shrink-0 px-0`}
              aria-label="Mes siguiente"
              onClick={() => {
                const next = mesSiguiente(anio, mes)
                setAnio(next.anio)
                setMes(next.mes)
              }}
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </ToolbarSection>
        }
      />
      <ListaDiarioAgentes anio={anio} mes={mes} />
    </section>
  )
}
