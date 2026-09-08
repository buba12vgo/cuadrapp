import { BADGE_OK, BADGE_PENDING } from '@/lib/uiStyles'

type Props = {
  guardando?: boolean
  guardadoOk?: boolean
  pendiente?: boolean
}

export function SaveStatus({ guardando, guardadoOk, pendiente }: Props) {
  if (guardando) {
    return <span className={BADGE_PENDING}>Guardando…</span>
  }
  if (pendiente) {
    return <span className={BADGE_PENDING}>Pendiente</span>
  }
  if (guardadoOk) {
    return <span className={BADGE_OK}>Guardado</span>
  }
  return null
}
