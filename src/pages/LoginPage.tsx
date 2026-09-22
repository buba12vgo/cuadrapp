import { useState } from 'react'
import { CalendarDays } from 'lucide-react'
import { Navigate } from 'react-router-dom'
import { useAcceso } from '@/contexts/AccesoContext'
import { useAuth } from '@/contexts/AuthContext'
import { BTN_PRIMARY, BTN_SECONDARY, CAMPO, PAGE_SUBTITLE, PAGE_TITLE } from '@/lib/uiStyles'

export function LoginPage() {
  const { user, loading, signInWithGoogle, signInWithEmail, restablecerContrasena, error, firebaseReady } =
    useAuth()
  const acceso = useAcceso()
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [aviso, setAviso] = useState<string | null>(null)
  const [enviando, setEnviando] = useState(false)

  if (!loading && !acceso.loading && user && acceso.perfil) {
    return <Navigate to={acceso.inicio} replace />
  }

  const puedeGoogle = firebaseReady && !loading && !enviando

  async function entrarConCorreo(event: React.FormEvent) {
    event.preventDefault()
    setAviso(null)
    setEnviando(true)
    try {
      await signInWithEmail(email, password)
    } finally {
      setEnviando(false)
    }
  }

  async function olvidarContrasena() {
    setAviso(null)
    setEnviando(true)
    try {
      await restablecerContrasena(email)
      setAviso('Te hemos enviado un enlace para elegir una contraseña nueva.')
    } catch {
      /* el error de auth ya está en el contexto */
    } finally {
      setEnviando(false)
    }
  }

  return (
    <div className="relative flex min-h-svh flex-col items-center justify-center overflow-hidden bg-canvas px-4 py-8">
      <div
        className="pointer-events-none absolute inset-0 opacity-80"
        aria-hidden
        style={{
          background:
            'radial-gradient(ellipse 80% 50% at 50% -20%, color-mix(in srgb, var(--color-brand-500) 18%, transparent), transparent), radial-gradient(ellipse 50% 36% at 100% 100%, color-mix(in srgb, var(--color-brand-600) 10%, transparent), transparent)',
        }}
      />
      <div className="relative w-full max-w-sm rounded-xl border border-line bg-surface p-6 shadow-card-lg">
        <div className="mb-4 flex flex-col items-center gap-2">
          <span className="flex h-12 w-12 items-center justify-center rounded-2xl bg-brand-600 text-white">
            <CalendarDays className="h-6 w-6" aria-hidden />
          </span>
          <h1 className={`${PAGE_TITLE} text-center text-lg`}>Cuadrapp</h1>
          <p className={`${PAGE_SUBTITLE} text-center`}>
            Cuadrantes de la Policía Portuaria
          </p>
        </div>
        {loading ? (
          <p className={`${PAGE_SUBTITLE} text-center`}>Preparando autenticación…</p>
        ) : null}
        {!firebaseReady && !loading ? (
          <p className="mt-3 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-800">
            Firebase no está configurado. Revisa VITE_FIREBASE_* en el despliegue.
          </p>
        ) : (
          <div className="flex flex-col gap-3">
            <button
              type="button"
              disabled={!puedeGoogle}
              onClick={() => void signInWithGoogle()}
              className={`${BTN_PRIMARY} w-full justify-center py-2.5`}
            >
              Continuar con Google
            </button>
            <p className="text-center text-xs text-muted">
              Superadmin y admin entran con su cuenta Google.
            </p>
            <div className="flex items-center gap-2 text-xs text-muted">
              <span className="h-px flex-1 bg-line" />
              o correo del jefe
              <span className="h-px flex-1 bg-line" />
            </div>
            <form className="flex flex-col gap-2" onSubmit={(event) => void entrarConCorreo(event)}>
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">Correo</span>
                <input
                  type="email"
                  autoComplete="username"
                  className={`${CAMPO} w-full`}
                  value={email}
                  onChange={(event) => setEmail(event.target.value)}
                  required
                />
              </label>
              <label className="flex flex-col gap-0.5">
                <span className="text-sm font-semibold text-slate-600">Contraseña</span>
                <input
                  type="password"
                  autoComplete="current-password"
                  className={`${CAMPO} w-full`}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  required
                />
              </label>
              <button
                type="submit"
                className={`${BTN_SECONDARY} w-full justify-center`}
                disabled={!puedeGoogle}
              >
                {enviando ? 'Entrando…' : 'Entrar'}
              </button>
              <button
                type="button"
                className="text-sm font-semibold text-brand-700 hover:underline disabled:opacity-40"
                disabled={!puedeGoogle || !email.trim()}
                onClick={() => void olvidarContrasena()}
              >
                He olvidado la contraseña
              </button>
            </form>
          </div>
        )}
        {aviso ? (
          <p className="mt-3 text-center text-sm text-emerald-800">{aviso}</p>
        ) : null}
        {error ? (
          <p className="mt-3 text-center text-sm text-red-600">{error}</p>
        ) : null}
      </div>
    </div>
  )
}
