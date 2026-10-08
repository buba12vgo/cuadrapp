import { esFinDeSemana } from '@/lib/convenio'
import { esFestivo } from '@/lib/festivos'
import { isoFecha } from '@/lib/fechas'
import { tipoEventoEsFestivo, type TipoEventoConfig } from '@/lib/tiposEvento'
import { getTiposEvento } from '@/lib/tiposEventoStore'
import type { EventoOperativo } from '@/types'

/** Festivo oficial o evento cuyo tipo está marcado como festivo. */
export function diaEsFestivoOperativo(
  anio: number,
  mes: number,
  dia: number,
  eventos: EventoOperativo[] = [],
  tipos: TipoEventoConfig[] = getTiposEvento(),
) {
  if (esFestivo(anio, mes, dia)) return true
  if (eventos.length === 0) return false
  const fecha = isoFecha(anio, mes, dia)
  return eventos.some(
    (evento) =>
      evento.fecha === fecha && tipoEventoEsFestivo(evento.tipo, tipos),
  )
}

/** Fin de semana o festivo operativo (oficial + tipos de evento festivos). */
export function diaEsEspecial(
  anio: number,
  mes: number,
  dia: number,
  eventos: EventoOperativo[] = [],
  tipos: TipoEventoConfig[] = getTiposEvento(),
) {
  return (
    esFinDeSemana(anio, mes, dia) ||
    diaEsFestivoOperativo(anio, mes, dia, eventos, tipos)
  )
}
