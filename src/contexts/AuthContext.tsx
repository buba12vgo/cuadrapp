import {
  createContext,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { ensureFirebase, getAuthClient } from '@/lib/firebase'
import { isAllowedAdmin, mensajeNoAutorizado } from '@/lib/authAllowlist'

const AUTH_INIT_TIMEOUT_MS = 8_000

type AuthContextValue = {
  user: User | null
  loading: boolean
  firebaseReady: boolean
  signInWithGoogle: () => Promise<void>
  signOut: () => Promise<void>
  error: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [firebaseReady, setFirebaseReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let cancelled = false
    let unsubscribe: (() => void) | undefined
    let settled = false

    const finishLoading = () => {
      if (cancelled || settled) return
      settled = true
      setLoading(false)
    }

    const timeout = window.setTimeout(() => {
      console.warn('[auth] Tiempo de espera agotado al comprobar la sesión')
      finishLoading()
    }, AUTH_INIT_TIMEOUT_MS)

    void (async () => {
      try {
        const ready = await ensureFirebase()
        if (cancelled) return
        setFirebaseReady(ready)
        if (!ready) {
          finishLoading()
          return
        }

        const auth = getAuthClient()
        if (!auth) {
          finishLoading()
          return
        }

        unsubscribe = onAuthStateChanged(
          auth,
          (u) => {
            if (cancelled) return
            if (u && !isAllowedAdmin(u)) {
              void firebaseSignOut(auth)
                .catch((err) => {
                  console.error('[auth] No se pudo cerrar sesión no autorizada', err)
                })
                .finally(() => {
                  if (cancelled) return
                  setUser(null)
                  setError(mensajeNoAutorizado())
                  finishLoading()
                })
              return
            }
            setUser(u)
            finishLoading()
          },
          (authError) => {
            console.error('[auth] onAuthStateChanged error', authError)
            if (!cancelled) {
              setError(authError.message)
            }
            finishLoading()
          },
        )
      } catch (err) {
        console.error('[auth] Error al inicializar', err)
        if (!cancelled) {
          setError(err instanceof Error ? err.message : 'Error al inicializar auth')
        }
        finishLoading()
      }
    })()

    return () => {
      cancelled = true
      window.clearTimeout(timeout)
      unsubscribe?.()
    }
  }, [])

  const signInWithGoogle = async () => {
    setError(null)
    const ready = await ensureFirebase()
    if (!ready) {
      setError('Firebase no está configurado.')
      return
    }
    const auth = getAuthClient()
    if (!auth) return
    try {
      const provider = new GoogleAuthProvider()
      provider.setCustomParameters({ prompt: 'select_account' })
      const result = await signInWithPopup(auth, provider)
      if (!isAllowedAdmin(result.user)) {
        await firebaseSignOut(auth)
        setUser(null)
        setError(mensajeNoAutorizado())
      }
    } catch (e) {
      const msg = e instanceof Error ? e.message : 'Error al iniciar sesión'
      setError(msg)
    }
  }

  const signOut = async () => {
    const auth = getAuthClient()
    if (!auth) return
    await firebaseSignOut(auth)
  }

  return (
    <AuthContext.Provider
      value={{ user, loading, firebaseReady, signInWithGoogle, signOut, error }}
    >
      {children}
    </AuthContext.Provider>
  )
}

export function useAuth() {
  const ctx = useContext(AuthContext)
  if (!ctx) throw new Error('useAuth must be used within AuthProvider')
  return ctx
}
