import { initializeApp, type FirebaseApp } from 'firebase/app'
import { getAuth, type Auth } from 'firebase/auth'
import { getFirestore, type Firestore } from 'firebase/firestore'
import { isFirebaseConfigured as isBuildTimeConfigured } from './firebaseEnv'

export type FirebaseWebConfig = {
  apiKey: string
  authDomain: string
  projectId: string
  storageBucket: string
  messagingSenderId: string
  appId: string
}

const buildTimeConfig: FirebaseWebConfig = {
  apiKey: import.meta.env.VITE_FIREBASE_API_KEY || '',
  authDomain: import.meta.env.VITE_FIREBASE_AUTH_DOMAIN || '',
  projectId: import.meta.env.VITE_FIREBASE_PROJECT_ID || '',
  storageBucket: import.meta.env.VITE_FIREBASE_STORAGE_BUCKET || '',
  messagingSenderId: import.meta.env.VITE_FIREBASE_MESSAGING_SENDER_ID || '',
  appId: import.meta.env.VITE_FIREBASE_APP_ID || '',
}

type FirebaseState = {
  app: FirebaseApp | null
  auth: Auth | null
  db: Firestore | null
}

const state: FirebaseState = {
  app: null,
  auth: null,
  db: null,
}

if (isBuildTimeConfigured) {
  state.app = initializeApp(buildTimeConfig)
  state.auth = getAuth(state.app)
  state.db = getFirestore(state.app)
}

let initPromise: Promise<boolean> | null = null

/** @deprecated Use getDb() — kept for compatibility */
export const firebaseApp = state.app
/** @deprecated Use getAuthClient() */
export const auth = state.auth
/** @deprecated Use getDb() */
export const db = state.db

export function getFirebaseApp() {
  return state.app
}

export function getAuthClient() {
  return state.auth
}

export function getDb() {
  return state.db
}

/** True when build-time Vite env had Firebase keys. Runtime may still recover via /api. */
export const isFirebaseConfigured = isBuildTimeConfigured

export function isFirebaseReady() {
  return Boolean(state.db)
}

export async function ensureFirebase(): Promise<boolean> {
  if (state.db) return true
  if (initPromise) return initPromise

  initPromise = (async () => {
    try {
      const res = await fetch('/api/firebase-config', { cache: 'no-store' })
      const body = (await res.json()) as {
        ok?: boolean
        config?: FirebaseWebConfig
      }
      if (!res.ok || !body.ok || !body.config?.apiKey || !body.config.projectId) {
        return false
      }
      state.app = initializeApp(body.config)
      state.auth = getAuth(state.app)
      state.db = getFirestore(state.app)
      return true
    } catch {
      return false
    }
  })()

  return initPromise
}
