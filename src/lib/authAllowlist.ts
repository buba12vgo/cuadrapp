import type { User } from 'firebase/auth'

/** Única cuenta con acceso al admin. Sobrescribible con VITE_ADMIN_EMAIL. */
export const ADMIN_EMAIL = (
  import.meta.env.VITE_ADMIN_EMAIL || 'buba12@gmail.com'
)
  .trim()
  .toLowerCase()

export function isAllowedAdmin(user: User | null): boolean {
  if (!user?.emailVerified) return false
  const email = user.email?.trim().toLowerCase()
  return Boolean(email) && email === ADMIN_EMAIL
}

export function mensajeNoAutorizado() {
  return `Solo ${ADMIN_EMAIL} puede acceder.`
}
