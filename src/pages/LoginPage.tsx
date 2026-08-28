import { useEffect } from 'react'
import { Navigate } from 'react-router-dom'
import { getAdminEmail } from '@/lib/auth'
import { useAuth } from '@/context/AuthContext'

export function LoginPage() {
  const { user, loading, isAdmin, authError, clearAuthError, signIn } = useAuth()

  useEffect(() => {
    clearAuthError()
  }, [clearAuthError])

  if (loading) {
    return (
      <div className="flex min-h-svh items-center justify-center bg-slate-50 text-slate-600">
        <p className="text-sm">Comprobando sesión…</p>
      </div>
    )
  }

  if (user && isAdmin) {
    return <Navigate to="/admin/agentes" replace />
  }

  return (
    <div className="flex min-h-svh items-center justify-center bg-slate-50 px-4">
      <div className="w-full max-w-sm rounded-xl border border-slate-200 bg-white p-8 shadow-sm">
        <p className="text-center text-lg font-semibold tracking-tight text-slate-900">
          Cuadrapp
        </p>
        <p className="mt-2 text-center text-sm text-slate-600">
          Acceso de administración
        </p>
        <p className="mt-4 text-center text-xs text-slate-500">
          Solo <span className="font-medium">{getAdminEmail()}</span> puede
          entrar de momento.
        </p>

        <button
          type="button"
          onClick={() => void signIn()}
          className="mt-6 flex w-full items-center justify-center gap-2 rounded-lg bg-slate-900 px-4 py-2.5 text-sm font-medium text-white transition hover:bg-slate-800"
        >
          <GoogleIcon />
          Entrar con Google
        </button>

        {authError ? (
          <p className="mt-4 rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-800">
            {authError}
          </p>
        ) : null}
      </div>
    </div>
  )
}

function GoogleIcon() {
  return (
    <svg aria-hidden="true" className="h-4 w-4" viewBox="0 0 24 24">
      <path
        fill="#4285F4"
        d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92c-.26 1.37-1.04 2.53-2.21 3.31v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.09z"
      />
      <path
        fill="#34A853"
        d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z"
      />
      <path
        fill="#FBBC05"
        d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z"
      />
      <path
        fill="#EA4335"
        d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z"
      />
    </svg>
  )
}
