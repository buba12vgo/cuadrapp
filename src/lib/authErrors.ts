import { FirebaseError } from 'firebase/app'

function firebaseProjectConsoleUrl(projectId?: string): string | null {
  if (!projectId?.trim()) return null
  return `https://console.firebase.google.com/project/${projectId}/authentication/settings`
}

export function formatAuthError(
  error: unknown,
  options?: { projectId?: string },
): string {
  if (error instanceof FirebaseError) {
    if (error.code === 'auth/unauthorized-domain') {
      const host =
        typeof window !== 'undefined' ? window.location.hostname : 'este dominio'
      const consoleUrl = firebaseProjectConsoleUrl(options?.projectId)
      const consoleHint = consoleUrl
        ? ` Abre ${consoleUrl} y añade el dominio en «Dominios autorizados».`
        : ' Abre Firebase Console → Authentication → Configuración → Dominios autorizados.'
      return `El dominio «${host}» no está autorizado en Firebase.${consoleHint}`
    }

    if (error.code === 'auth/popup-closed-by-user') {
      return 'Se cerró la ventana de inicio de sesión antes de completar el acceso.'
    }

    if (error.code === 'auth/popup-blocked') {
      return 'El navegador bloqueó la ventana emergente. Permite ventanas emergentes para este sitio e inténtalo de nuevo.'
    }

    return error.message.replace(/^Firebase:\s*/i, '').trim()
  }

  if (error instanceof Error) return error.message
  return 'Error al iniciar sesión'
}
