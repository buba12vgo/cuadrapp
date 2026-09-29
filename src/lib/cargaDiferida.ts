const CLAVE_RECARGA = 'cuadrapp.recarga-modulo'
/** Si el fallo se repite dentro de esta ventana tras recargar, no es una versión vieja: se muestra el error. */
const VENTANA_RECARGA_MS = 30_000

/** Mensajes de Chrome, Firefox y Safari cuando un `import()` o su precarga no llega. */
const ERROR_CARGA_MODULO =
  /Failed to fetch dynamically imported module|error loading dynamically imported module|Importing a module script failed|Unable to preload CSS|Expected a JavaScript/i

export function esErrorCargaModulo(error: unknown) {
  const mensaje = error instanceof Error ? error.message : String(error)
  return ERROR_CARGA_MODULO.test(mensaje)
}

function recargarUnaVez() {
  if (typeof navigator !== 'undefined' && navigator.onLine === false) return false
  try {
    const ultima = Number(sessionStorage.getItem(CLAVE_RECARGA) ?? 0)
    if (Date.now() - ultima < VENTANA_RECARGA_MS) return false
    sessionStorage.setItem(CLAVE_RECARGA, String(Date.now()))
  } catch {
    return false
  }
  window.location.reload()
  return true
}

/**
 * Tras un despliegue, una pestaña abierta pide chunks con el hash anterior,
 * que ya no existen. Recargar trae el index.html nuevo con los hashes vigentes.
 */
export async function importarModulo<T>(cargar: () => Promise<T>): Promise<T> {
  try {
    return await cargar()
  } catch (error) {
    if (esErrorCargaModulo(error) && recargarUnaVez()) {
      return new Promise<T>(() => {})
    }
    throw error
  }
}
