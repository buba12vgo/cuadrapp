import { useState } from 'react'
import {
  EmailAuthProvider,
  reauthenticateWithCredential,
  updatePassword,
} from 'firebase/auth'
import { PageHeader } from '@/components/ui/PageHeader'
import { useAcceso } from '@/contexts/AccesoContext'
import { useAuth } from '@/contexts/AuthContext'
import { ETIQUETA_ROL_ACCESO } from '@/lib/acceso'
import { isDesignPreview } from '@/lib/designPreview'
import { mensajeErrorAuth } from '@/lib/usuariosAcceso'
import {
  ALERT_ERROR,
  ALERT_INFO,
  BLOQUE,
  BTN_PRIMARY,
  CAMPO,
  PAGE_SECTION,
  TITULO_BLOQUE,
} from '@/lib/uiStyles'

export function OpcionesPage() {
  const { user } = useAuth()
  const { perfil } = useAcceso()
  const [actual, setActual] = useState('')
  const [nueva, setNueva] = useState('')
  const [repetir, setRepetir] = useState('')
  const [error, setError] = useState<string | null>(null)
  const [ok, setOk] = useState<string | null>(null)
  const [guardando, setGuardando] = useState(false)

  const conContrasena = Boolean(
    user?.providerData.some((item) => item.providerId === 'password'),
  )

  async function cambiar(event: React.FormEvent) {
    event.preventDefault()
    setError(null)
    setOk(null)
    if (nueva.length < 8) {
      setError('La contraseña nueva necesita al menos 8 caracteres.')
      return
    }
    if (nueva !== repetir) {
      setError('Las dos contraseñas nuevas no coinciden.')
      return
    }
    if (isDesignPreview || !user?.email) {
      setOk('En producción el cambio se guarda en tu cuenta. Esta vista previa no tiene contraseña.')
      setActual('')
      setNueva('')
      setRepetir('')
      return
    }
    if (!conContrasena) {
      setError('Esta cuenta entra con Google. La contraseña no se cambia aquí.')
      return
    }
    setGuardando(true)
    try {
      const cred = EmailAuthProvider.credential(user.email, actual)
      await reauthenticateWithCredential(user, cred)
      await updatePassword(user, nueva)
      setActual('')
      setNueva('')
      setRepetir('')
      setOk('Contraseña actualizada.')
    } catch (err) {
      setError(mensajeErrorAuth(err))
    } finally {
      setGuardando(false)
    }
  }

  return (
    <section className={PAGE_SECTION}>
      <PageHeader
        title="Opciones"
        subtitle="Tu cuenta y la contraseña de acceso"
      />
      <div className="min-h-0 flex-1 overflow-auto">
        <div className="mx-auto flex max-w-lg flex-col gap-3">
          <section className={BLOQUE}>
            <h2 className={TITULO_BLOQUE}>Cuenta</h2>
            <dl className="grid grid-cols-[7rem_1fr] gap-y-1 text-sm">
              <dt className="text-slate-500">Nombre</dt>
              <dd className="font-medium">{perfil?.nombre ?? user?.displayName ?? '—'}</dd>
              <dt className="text-slate-500">Correo</dt>
              <dd>{perfil?.email ?? user?.email ?? '—'}</dd>
              <dt className="text-slate-500">Rol</dt>
              <dd>{perfil ? ETIQUETA_ROL_ACCESO[perfil.rol] : '—'}</dd>
              <dt className="text-slate-500">Placa</dt>
              <dd>{perfil?.numeroPlaca ?? '—'}</dd>
            </dl>
          </section>

          <section className={BLOQUE}>
            <h2 className={TITULO_BLOQUE}>Cambiar contraseña</h2>
            {perfil?.fijo ? (
              <p className={ALERT_INFO}>
                Superadmin y admin entran con Google. Esta contraseña es para los
                jefes y responsables a los que se les da un usuario de consulta.
              </p>
            ) : (
              <form className="flex flex-col gap-2" onSubmit={(event) => void cambiar(event)}>
                <label className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-slate-600">
                    Contraseña actual
                  </span>
                  <input
                    type="password"
                    autoComplete="current-password"
                    className={`${CAMPO} w-full`}
                    value={actual}
                    onChange={(event) => setActual(event.target.value)}
                    required={!isDesignPreview}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-slate-600">
                    Contraseña nueva
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={`${CAMPO} w-full`}
                    value={nueva}
                    onChange={(event) => setNueva(event.target.value)}
                    required
                    minLength={8}
                  />
                </label>
                <label className="flex flex-col gap-0.5">
                  <span className="text-sm font-semibold text-slate-600">
                    Repetir contraseña nueva
                  </span>
                  <input
                    type="password"
                    autoComplete="new-password"
                    className={`${CAMPO} w-full`}
                    value={repetir}
                    onChange={(event) => setRepetir(event.target.value)}
                    required
                    minLength={8}
                  />
                </label>
                <button type="submit" className={BTN_PRIMARY} disabled={guardando}>
                  {guardando ? 'Guardando…' : 'Guardar contraseña'}
                </button>
              </form>
            )}
            {ok ? <p className="text-sm text-emerald-800">{ok}</p> : null}
            {error ? <p className={ALERT_ERROR}>{error}</p> : null}
          </section>
        </div>
      </div>
    </section>
  )
}
