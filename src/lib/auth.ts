import {
  GoogleAuthProvider,
  onAuthStateChanged,
  signInWithPopup,
  signOut as firebaseSignOut,
  type User,
} from 'firebase/auth'
import { ensureFirebase, getAuthClient } from './firebase'

const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL || 'buba12@gmail.com'
).toLowerCase()

export function getAdminEmail(): string {
  return ADMIN_EMAIL
}

export function isAllowedAdmin(user: User | null): boolean {
  if (!user?.email) return false
  return user.email.toLowerCase() === ADMIN_EMAIL
}

export async function signInWithGoogle(): Promise<User> {
  const ready = await ensureFirebase()
  if (!ready) {
    throw new Error('Firebase no configurado. Revisa las variables de entorno.')
  }

  const auth = getAuthClient()
  if (!auth) {
    throw new Error('Firebase Auth no disponible.')
  }

  const provider = new GoogleAuthProvider()
  provider.setCustomParameters({ prompt: 'select_account' })
  const result = await signInWithPopup(auth, provider)

  if (!isAllowedAdmin(result.user)) {
    await firebaseSignOut(auth)
    throw new Error(
      `Solo ${ADMIN_EMAIL} puede acceder como administrador.`,
    )
  }

  return result.user
}

export async function signOut(): Promise<void> {
  const auth = getAuthClient()
  if (auth) {
    await firebaseSignOut(auth)
  }
}

export async function subscribeToAuthState(
  callback: (user: User | null) => void,
): Promise<() => void> {
  const ready = await ensureFirebase()
  const auth = getAuthClient()

  if (!ready || !auth) {
    callback(null)
    return () => {}
  }

  return onAuthStateChanged(auth, async (user) => {
    if (user && !isAllowedAdmin(user)) {
      await firebaseSignOut(auth)
      callback(null)
      return
    }
    callback(user)
  })
}
