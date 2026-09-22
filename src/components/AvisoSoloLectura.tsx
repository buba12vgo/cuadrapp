import { ALERT_INFO } from '@/lib/uiStyles'

export function AvisoSoloLectura({ texto }: { texto?: string }) {
  return (
    <p className={ALERT_INFO}>
      {texto ??
        'Solo consulta. Puedes ver esta pantalla; los cambios los hace quien tenga permiso de edición.'}
    </p>
  )
}
