import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import type { User } from 'firebase/auth'
import {
  isAllowedAdmin,
  signInWithGoogle,
  signOut as authSignOut,
  subscribeToAuthState,
} from '@/lib/auth'

type AuthContextValue = {
  user: User | null
  loading: boolean
  isAdmin: boolean
  authError: string | null
  clearAuthError: () => void
  signIn: () => Promise<void>
  signOut: () => Promise<void>
}

const AuthContext = createContext<AuthContextValue | null>(null)

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null)
  const [loading, setLoading] = useState(true)
  const [authError, setAuthError] = useState<string | null>(null)

  useEffect(() => {
    let unsubscribe: (() => void) | undefined
    let cancelado = false

    void subscribeToAuthState((firebaseUser) => {
      if (cancelado) return
      setUser(firebaseUser)
      setLoading(false)
    }).then((unsub) => {
      if (cancelado) {
        unsub()
        return
      }
      unsubscribe = unsub
    })

    return () => {
      cancelado = true
      unsubscribe?.()
    }
  }, [])

  const clearAuthError = useCallback(() => {
    setAuthError(null)
  }, [])

  const signIn = useCallback(async () => {
    setAuthError(null)
    try {
      await signInWithGoogle()
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión.',
      )
    }
  }, [])

  const signOut = useCallback(async () => {
    setAuthError(null)
    await authSignOut()
    setUser(null)
  }, [])

  const value = useMemo<AuthContextValue>(
    () => ({
      user,
      loading,
      isAdmin: isAllowedAdmin(user),
      authError,
      clearAuthError,
      signIn,
      signOut,
    }),
    [user, loading, authError, clearAuthError, signIn, signOut],
  )

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>
}

export function useAuth(): AuthContextValue {
  const context = useContext(AuthContext)
  if (!context) {
    throw new Error('useAuth debe usarse dentro de AuthProvider')
  }
  return context
}
