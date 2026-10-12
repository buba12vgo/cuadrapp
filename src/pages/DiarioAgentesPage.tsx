import { ListaDiarioAgentes } from '@/components/ListaDiarioAgentes'
import { PageHeader } from '@/components/ui/PageHeader'
import { PAGE_SECTION } from '@/lib/uiStyles'

export function DiarioAgentesPage() {
  return (
    <section className={`${PAGE_SECTION} gap-1.5 overflow-hidden`}>
      <PageHeader
        title="Diario agentes"
        subtitle="Puestos del día y cambios de asignación"
      />
      <ListaDiarioAgentes />
    </section>
  )
}
