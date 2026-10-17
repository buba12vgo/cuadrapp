/** Duración mínima de la portada al abrir la app. */
export const DURACION_ENTRADA_MS = 5_500

export const CLAVE_ENTRADA = 'cuadrapp.entrada-vista'

type Almacen = Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>

function almacenSesion(): Almacen | null {
  try {
    if (typeof sessionStorage === 'undefined') return null
    return sessionStorage
  } catch {
    return null
  }
}

export function entradaYaVista(almacen: Almacen | null = almacenSesion()) {
  try {
    return almacen?.getItem(CLAVE_ENTRADA) === '1'
  } catch {
    return false
  }
}

export function marcarEntradaVista(almacen: Almacen | null = almacenSesion()) {
  try {
    almacen?.setItem(CLAVE_ENTRADA, '1')
  } catch {
    /* private mode / storage lleno */
  }
}

export function olvidarEntradaVista(almacen: Almacen | null = almacenSesion()) {
  try {
    almacen?.removeItem(CLAVE_ENTRADA)
  } catch {
    /* ignore */
  }
}
