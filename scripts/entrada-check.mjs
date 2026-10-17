import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const {
  CLAVE_ENTRADA,
  DURACION_ENTRADA_MS,
  entradaYaVista,
  marcarEntradaVista,
  olvidarEntradaVista,
} = await server.ssrLoadModule('/src/lib/entrada.ts')

const fallos = []
function igual(nombre, valor, esperado) {
  const a = JSON.stringify(valor)
  const b = JSON.stringify(esperado)
  if (a !== b) fallos.push(`${nombre}: ${a} !== ${b}`)
}

if (DURACION_ENTRADA_MS < 5_000) {
  fallos.push(`duración demasiado corta: ${DURACION_ENTRADA_MS}`)
}

const memoria = new Map()
const almacen = {
  getItem: (clave) => (memoria.has(clave) ? memoria.get(clave) : null),
  setItem: (clave, valor) => {
    memoria.set(clave, String(valor))
  },
  removeItem: (clave) => {
    memoria.delete(clave)
  },
}

igual('sin ver', entradaYaVista(almacen), false)
marcarEntradaVista(almacen)
igual('clave', memoria.get(CLAVE_ENTRADA), '1')
igual('ya vista', entradaYaVista(almacen), true)
olvidarEntradaVista(almacen)
igual('olvidada', entradaYaVista(almacen), false)

await server.close()
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('entrada-check ok')
