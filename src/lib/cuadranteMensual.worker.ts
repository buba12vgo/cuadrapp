import { generarCuadranteMensual } from '@/lib/generarCuadranteMensual'
import type {
  PeticionCuadranteWorker,
  RespuestaCuadranteWorker,
} from '@/lib/generarCuadranteEnSegundoPlano'

const ambito = self as unknown as {
  onmessage: ((event: MessageEvent<PeticionCuadranteWorker>) => void) | null
  postMessage: (mensaje: RespuestaCuadranteWorker) => void
}

ambito.onmessage = (event) => {
  try {
    ambito.postMessage({
      ok: true,
      cuadrante: generarCuadranteMensual(...event.data.args),
    })
  } catch (err) {
    ambito.postMessage({
      ok: false,
      mensaje:
        err instanceof Error
          ? err.message
          : 'No se pudo autogenerar el cuadrante mensual',
    })
  }
}
