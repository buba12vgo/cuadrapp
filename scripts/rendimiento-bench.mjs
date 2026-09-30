// Banco de rendimiento con una plantilla sintética del tamaño máximo esperado.
// Uso: node [--expose-gc] scripts/rendimiento-bench.mjs [agentes=150] [repeticiones=3]
// PLANTILLA=aleatoria usa limitaciones/preferencias variadas: con mínimos que la
// plantilla no alcanza a cubrir recorre la ruta más cara del generador.
import { createServer } from 'vite'

const N = Number(process.argv[2] ?? 150)
const REPS = Number(process.argv[3] ?? 3)
const SOLO = process.env.SOLO ?? ''
const ANIO = 2026
const MES = 7

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const cargar = (ruta) => server.ssrLoadModule(ruta)
const { generarPlanAnual, OBJETIVOS_PLAN_DEFECTO } = await cargar('/src/lib/generarPlanAnual.ts')
const { generarCuadranteMensual, generarCuadranteMensualAsync } = await cargar(
  '/src/lib/generarCuadranteMensual.ts',
)
const { PUESTOS_INICIALES, crearMinimosSemana, minimosParaFecha, mockEventosCalendario } =
  await cargar('/src/lib/calendarioPuestos.ts')
const { PERMISOS_INICIALES } = await cargar('/src/lib/permisos.ts')
const { agentesOperativosCuadrante } = await cargar('/src/lib/rolesCuadrante.ts')
const { completarAsignacionesMes } = await cargar('/src/lib/completarAsignaciones.ts')
const { cuadranteParaFirestore, cuadranteDesdeFirestore } = await cargar(
  '/src/lib/cuadranteFirestore.ts',
)
const { diasDelMes } = await cargar('/src/lib/convenio.ts')
const { isoFecha } = await cargar('/src/lib/fechas.ts')

const MESES_VAC = ['JUNIO', 'JULIO', 'AGOSTO', 'SEPTIEMBRE']
function rol(i) {
  if (i < 4) return 'RESPONSABLE'
  if (i < 16) return 'JEFE_SERVICIO'
  if (i < 34) return 'JEFE_EQUIPO'
  if (i < N - 10) return 'POLICIA'
  return 'POLICIA_BOLSA'
}
function plantillaFija() {
  return Array.from({ length: N }, (_, i) => ({
    id: `ag-${i}`,
    numeroPlaca: String(1000 + i),
    nombre: `Agente${i}`,
    apellidos: 'Prueba',
    rolBase: rol(i),
    limitaciones: { M: true, T: i % 7 !== 0, N: i % 5 !== 0 },
    preferenciaAnual: { objetivoM: 4, objetivoT: 4, objetivoN: 3 },
    puestosExcluidos: i % 9 === 0 ? ['LONJAS'] : [],
    mesAnclaVacaciones: MESES_VAC[i % 4],
    anioReferenciaVacaciones: ANIO,
  }))
}
function plantillaAleatoria() {
  let s = 300 + N
  const rnd = () => ((s = (s * 1103515245 + 12345) % 2147483648) / 2147483648)
  const roles = ['RESPONSABLE', 'JEFE_SERVICIO', 'JEFE_EQUIPO', 'POLICIA', 'POLICIA', 'POLICIA', 'POLICIA_BOLSA']
  return Array.from({ length: N }, (_, i) => ({
    id: `ag-${i}`,
    numeroPlaca: String(1000 + i),
    nombre: `A${i}`,
    apellidos: 'P',
    rolBase: roles[Math.floor(rnd() * roles.length)],
    limitaciones: { M: rnd() > 0.05, T: rnd() > 0.2, N: rnd() > 0.25 },
    preferenciaAnual: {
      objetivoM: Math.floor(rnd() * 8),
      objetivoT: Math.floor(rnd() * 6),
      objetivoN: Math.floor(rnd() * 5),
    },
    puestosExcluidos: [],
    mesAnclaVacaciones: MESES_VAC[Math.floor(rnd() * 4)],
    anioReferenciaVacaciones: ANIO,
  }))
}
const agentes = process.env.PLANTILLA === 'aleatoria' ? plantillaAleatoria() : plantillaFija()

async function medir(nombre, fn) {
  const tiempos = []
  let resultado
  for (let r = 0; r < REPS; r++) {
    const t0 = performance.now()
    resultado = await fn()
    tiempos.push(performance.now() - t0)
  }
  tiempos.sort((a, b) => a - b)
  console.log(
    `${nombre.padEnd(42)} mediana ${tiempos[Math.floor(REPS / 2)].toFixed(1).padStart(9)} ms   (min ${tiempos[0].toFixed(1)})`,
  )
  return resultado
}

console.log(
  `Plantilla ${process.env.PLANTILLA ?? 'fija'}: ${N} agentes · ${MES}/${ANIO} · ${REPS} repeticiones\n`,
)
globalThis.gc?.()
const heap0 = process.memoryUsage().heapUsed

const plan = await medir('generarPlanAnual', () =>
  generarPlanAnual(agentes, OBJETIVOS_PLAN_DEFECTO, ANIO, {}, { grupo: 'OPERATIVO' }).plan,
)
if (SOLO === 'plan') {
  await server.close()
  process.exit(0)
}
const operativos = agentesOperativosCuadrante(agentes)
const ids = operativos.map((a) => a.id)
const puestos = PUESTOS_INICIALES
const minimosSemana = crearMinimosSemana(puestos)
const eventos = mockEventosCalendario ?? []
const nDias = diasDelMes(ANIO, MES)

if (SOLO === 'cuadrante-perfil') {
  generarCuadranteMensual(plan, ids, ANIO, MES, eventos, { minimosSemana, puestos })
  await server.close()
  process.exit(0)
}
const cuadrante = await medir(`generarCuadranteMensual (${ids.length} operativos)`, () =>
  generarCuadranteMensual(plan, ids, ANIO, MES, eventos, { minimosSemana, puestos }),
)
await medir('generarCuadranteMensualAsync', () =>
  generarCuadranteMensualAsync(plan, ids, ANIO, MES, eventos, { minimosSemana, puestos }),
)
const { asignaciones } = await medir('completarAsignacionesMes', () =>
  completarAsignacionesMes({
    cuadrante,
    asignaciones: {},
    agentes: operativos,
    puestos,
    minimosDeFecha: (fecha) => minimosParaFecha(fecha, eventos, minimosSemana, puestos),
    anio: ANIO,
    mes: MES,
    nDias,
    isoFecha,
  }),
)
const opciones = { puestos, permisos: PERMISOS_INICIALES }
const doc = await medir('cuadranteParaFirestore', () =>
  cuadranteParaFirestore(cuadrante, asignaciones, operativos, ANIO, MES, nDias, opciones),
)
await medir('cuadranteDesdeFirestore', () =>
  cuadranteDesdeFirestore(doc, operativos, ANIO, MES, nDias, opciones),
)
console.log(`\nDocumento de cuadrante: ${(JSON.stringify(doc).length / 1024).toFixed(1)} KB`)
if (globalThis.gc) {
  globalThis.gc()
  const retenido = (process.memoryUsage().heapUsed - heap0) / 1024 / 1024
  console.log(`Heap retenido tras GC: ${retenido.toFixed(1)} MB`)
}
await server.close()
