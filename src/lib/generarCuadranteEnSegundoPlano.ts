import {
  generarCuadranteMensualAsync,
  type CuadranteMensual,
  type generarCuadranteMensual,
} from '@/lib/generarCuadranteMensual'

type ArgsCuadrante = Parameters<typeof generarCuadranteMensual>

export type PeticionCuadranteWorker = { args: ArgsCuadrante }

export type RespuestaCuadranteWorker =
  | { ok: true; cuadrante: CuadranteMensual }
  | { ok: false; mensaje: string }

/** El worker no llegó a ejecutar el generador (no carga, chunk borrado tras un despliegue…). */
class WorkerNoDisponible extends Error {}

function generarEnWorker(args: ArgsCuadrante) {
  return new Promise<CuadranteMensual>((resolve, reject) => {
    let worker: Worker
    try {
      worker = new Worker(
        new URL('./cuadranteMensual.worker.ts', import.meta.url),
        { type: 'module' },
      )
    } catch (err) {
      reject(new WorkerNoDisponible(String(err)))
      return
    }
    worker.onmessage = (event: MessageEvent<RespuestaCuadranteWorker>) => {
      worker.terminate()
      if (event.data.ok) resolve(event.data.cuadrante)
      else reject(new Error(event.data.mensaje))
    }
    const noDisponible = (motivo: string) => {
      worker.terminate()
      reject(new WorkerNoDisponible(motivo))
    }
    worker.onerror = (event) => {
      event.preventDefault()
      noDisponible(event.message || 'error al cargar el worker')
    }
    worker.onmessageerror = () => noDisponible('respuesta no clonable')
    const peticion: PeticionCuadranteWorker = { args }
    worker.postMessage(peticion)
  })
}

/**
 * Mismo resultado que `generarCuadranteMensualAsync`, calculado en un Web
 * Worker para no congelar la pestaña (con 150 agentes y mínimos puede tardar
 * varios segundos). Si el worker no está disponible, se genera en el hilo
 * principal como antes.
 */
export async function generarCuadranteMensualEnSegundoPlano(
  ...args: ArgsCuadrante
): Promise<CuadranteMensual> {
  if (typeof Worker === 'undefined') {
    return generarCuadranteMensualAsync(...args)
  }
  try {
    return await generarEnWorker(args)
  } catch (err) {
    if (err instanceof WorkerNoDisponible) {
      return generarCuadranteMensualAsync(...args)
    }
    throw err
  }
}
