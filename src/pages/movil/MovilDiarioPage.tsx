import { ListaDiarioAgentes } from '@/components/ListaDiarioAgentes'
import { useMovilMes } from '@/pages/movil/movilMes'

export function MovilDiarioPage() {
  const { anio, mes } = useMovilMes()
  return <ListaDiarioAgentes anio={anio} mes={mes} />
}
