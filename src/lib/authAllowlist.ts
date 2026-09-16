import type { User } from 'firebase/auth'

/** Única cuenta con acceso al admin en producción. Sobrescribible con VITE_ADMIN_EMAIL. */
export const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL || 'buba12@gmail.com'
)
  .trim()
  .toLowerCase()

/** Usuario local del agente Cursor (`npm run dev:preview`). No existe en Firebase. */
export const AGENT_EMAIL = 'cursor@cuadrapp.local'
export const AGENT_UID = 'cursor-agent'
export const AGENT_DISPLAY_NAME = 'Cursor'

export function isAgentUser(user: User | null): boolean {
  const email = user?.email?.trim().toLowerCase()
  return Boolean(email) && email === AGENT_EMAIL
}

export function isAllowedAdmin(user: User | null): boolean {
  if (!user?.email) return false
  const email = user.email.trim().toLowerCase()
  if (email === ADMIN_EMAIL && user.emailVerified) return true
  if (import.meta.env.DEV && isAgentUser(user)) return true
  return false
}

export function mensajeNoAutorizado() {
  return `Solo ${ADMIN_EMAIL} puede acceder.`
}
