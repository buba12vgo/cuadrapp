import { useCallback, useEffect, useRef, useState } from 'react'
import type { PerfilAcceso } from '@/lib/acceso'
import type { FichaPolicia } from '@/types'

/** Ficha del usuario: primero por id vinculado y, si no, por placa. */
export function agenteDelPerfil(
  agentes: FichaPolicia[],
  perfil: Pick<PerfilAcceso, 'agenteId' | 'numeroPlaca'> | null,
): FichaPolicia | null {
  if (!perfil) return null
  if (perfil.agenteId) {
    const porId = agentes.find((agente) => agente.id === perfil.agenteId)
    if (porId) return porId
  }
  const placa = perfil.numeroPlaca?.trim()
  if (!placa) return null
  return agentes.find((agente) => agente.numeroPlaca.trim() === placa) ?? null
}

/** El agente de la sesión si está en la lista; si no, el primero. */
export function idAgentePreferido(
  candidatos: FichaPolicia[],
  preferido: FichaPolicia | null,
) {
  if (preferido && candidatos.some((agente) => agente.id === preferido.id)) {
    return preferido.id
  }
  return candidatos[0]?.id ?? ''
}

/**
 * Empieza en el agente de la sesión. Si la ficha llega después, corrige
 * la selección mientras la persona no haya elegido otra a mano.
 */
export function useSeleccionAgente(
  candidatos: FichaPolicia[],
  preferido: FichaPolicia | null,
  listo = true,
) {
  const [agenteId, setAgenteId] = useState('')
  const manual = useRef(false)
  const clave = candidatos.map((agente) => agente.id).join('\0')
  const preferidoId = preferido?.id ?? ''

  useEffect(() => {
    if (!listo) return
    const sigue = candidatos.some((agente) => agente.id === agenteId)
    if (manual.current && sigue) return
    const siguiente = idAgentePreferido(candidatos, preferido)
    if (siguiente !== agenteId) setAgenteId(siguiente)
  }, [listo, clave, preferidoId, agenteId, candidatos, preferido])

  const elegir = useCallback((id: string) => {
    manual.current = true
    setAgenteId(id)
  }, [])

  return { agenteId, elegir }
}
