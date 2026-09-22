import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useState,
  type ReactNode,
} from 'react'
import {
  GoogleAuthProvider,
  onAuthStateChanged,
  sendPasswordResetEmail,
  signInWithEmailAndPassword,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { ensureFirebase, getAuthClient } from '@/lib/firebase'
import { AGENT_DISPLAY_NAME, AGENT_EMAIL, AGENT_UID } from '@/lib/authAllowlist'
import { mensajeErrorAuth } from '@/lib/usuariosAcceso'
import { isDesignPreview } from '@/lib/designPreview'

const AUTH_INIT_TIMEOUT_MS = 8_000

const previewUser = {
  uid: AGENT_UID,
  email: AGENT_EMAIL,
  emailVerified: true,
  displayName: AGENT_DISPLAY_NAME,
  photoURL: null,
} as User

type AuthContextValue = {
  user: User | null
  loading: boolean
  firebaseReady: boolean
  signInWithGoogle: () => Promise<void>
  signInWithEmail: (email: string, password: string) => Promise<void>
  restablecerContrasena: (email: string) => Promise<void>
  signOut: () => Promise<void>
  notificar: (mensaje: string) => void
  error: string | null
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [firebaseReady, setFirebaseReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    if (isDesignPreview) {
      setUser(previewUser)
      setFirebaseReady(false)
      setLoading(false)
      return
    }

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
            setUser(u)
            if (u) setError(null)
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

  const signInWithGoogle = useCallback(async () => {
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
      await signInWithPopup(auth, provider)
    } catch (e) {
      setError(mensajeErrorAuth(e))
    }
  }, [])

  const signInWithEmail = useCallback(async (email: string, password: string) => {
    setError(null)
    const ready = await ensureFirebase()
    if (!ready) {
      setError('Firebase no está configurado.')
      return
    }
    const auth = getAuthClient()
    if (!auth) return
    try {
      await signInWithEmailAndPassword(auth, email.trim(), password)
    } catch (e) {
      setError(mensajeErrorAuth(e))
    }
  }, [])

  const restablecerContrasena = useCallback(async (email: string) => {
    setError(null)
    const ready = await ensureFirebase()
    if (!ready) {
      setError('Firebase no está configurado.')
      return
    }
    const auth = getAuthClient()
    if (!auth) return
    const limpio = email.trim()
    if (!limpio) {
      setError('Indica el correo para enviarte el enlace.')
      return
    }
    try {
      await sendPasswordResetEmail(auth, limpio)
    } catch (e) {
      setError(mensajeErrorAuth(e))
      throw e
    }
  }, [])

  const signOut = useCallback(async () => {
    const auth = getAuthClient()
    if (!auth) return
    await firebaseSignOut(auth)
  }, [])

  const notificar = useCallback((mensaje: string) => {
    setError(mensaje)
  }, [])

  return (
    <AuthContext.Provider
      value={{
        user,
        loading,
        firebaseReady,
        signInWithGoogle,
        signInWithEmail,
        restablecerContrasena,
        signOut,
        notificar,
        error,
      }}
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
