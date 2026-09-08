import { BADGE_OK, BADGE_PENDING } from '@/lib/uiStyles'

type Props = {
  guardando?: boolean
  guardadoOk?: boolean
}

export function SaveStatus({ guardando, guardadoOk }: Props) {
  if (guardando) {
    return <span className={BADGE_PENDING}>Guardando…</span>
  }
  if (guardadoOk) {
    return <span className={BADGE_OK}>Guardado</span>
  }
  return null
}
