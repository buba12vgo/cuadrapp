import type { User } from 'firebase/auth'

/**
 * Correos con acceso al admin (Google, verificados).
 * Lista separada por comas en VITE_ADMIN_EMAILS, o uno solo en VITE_ADMIN_EMAIL.
 */
const RAW_ADMIN_EMAILS =
  import.meta.env.VITE_ADMIN_EMAILS ||
  import.meta.env.VITE_ADMIN_EMAIL ||
  'buba12@gmail.com,jony.mivi@gmail.com'

export const ADMIN_EMAILS: string[] = String(RAW_ADMIN_EMAILS)
  .split(/[,;\s]+/)
  .map((email) => email.trim().toLowerCase())
  .filter(Boolean)

/** Primer correo de la lista (mensajes y compatibilidad). */
export const ADMIN_EMAIL = ADMIN_EMAILS[0] ?? 'buba12@gmail.com'

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
  if (import.meta.env.DEV && isAgentUser(user)) return true
  if (!user.emailVerified) return false
  return ADMIN_EMAILS.includes(email)
}

export function mensajeNoAutorizado() {
  if (ADMIN_EMAILS.length <= 1) {
    return `Solo ${ADMIN_EMAIL} puede acceder.`
  }
  return `Solo estas cuentas pueden acceder: ${ADMIN_EMAILS.join(', ')}.`
}
