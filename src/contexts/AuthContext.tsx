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
    let unsubscribe: (() => void) | undefined

    void (async () => {
      const ready = await ensureFirebase()
      setFirebaseReady(ready)
      if (!ready) {
        setLoading(false)
        return
      }
      const auth = getAuthClient()
      if (!auth) {
        setLoading(false)
        return
      }
      unsubscribe = onAuthStateChanged(auth, (u) => {
        setUser(u)
        setLoading(false)
      })
    })()

    return () => unsubscribe?.()
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
      await signInWithPopup(auth, provider)
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
