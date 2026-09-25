import { useState } from 'react'

/**
 * Teléfono o tablet. No mira el ancho de la ventana: un escritorio
 * estrecho sigue en la versión web.
 */
export function esDispositivoMovil() {
  if (typeof navigator === 'undefined') return false
  const ua = navigator.userAgent || ''
  if (/Android|iPhone|iPod|iPad|webOS|BlackBerry|IEMobile|Opera Mini|Mobile/i.test(ua)) {
    return true
  }
  const nav = navigator as Navigator & { platform?: string }
  return nav.platform === 'MacIntel' && navigator.maxTouchPoints > 1
}

export function useEsMovil() {
  const [movil] = useState(esDispositivoMovil)
  return movil
}
