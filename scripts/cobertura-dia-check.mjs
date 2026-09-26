import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const mod = await server.ssrLoadModule('/src/lib/coberturaDia.ts')
const { nivelSemaforo, resumenDiaServicio } = mod

const fallos = []
if (nivelSemaforo(5, 3) !== 'verde') fallos.push('verde')
if (nivelSemaforo(4, 3) !== 'ambar') fallos.push('ambar')
if (nivelSemaforo(3, 3) !== 'rojo') fallos.push('justo')
if (nivelSemaforo(2, 3) !== 'rojo') fallos.push('falta')

const puestos = [
  { codigo: 'CTR', nombre: 'Centro de Control', abreviatura: 'CTR', ambito: 'OPERATIVO' },
  { codigo: 'LNJ', nombre: 'Lonjas', abreviatura: 'LNJ', ambito: 'OPERATIVO' },
]
function agente(id, placa) {
  return {
    id,
    numeroPlaca: placa,
    nombre: id,
    apellidos: 'Test',
    rolBase: 'POLICIA',
    limitaciones: { M: true, T: true, N: true },
    preferenciaAnual: { objetivoM: 4, objetivoT: 4, objetivoN: 3 },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'JUNIO',
    anioReferenciaVacaciones: 2026,
  }
}
const agentes = [agente('a', '1'), agente('b', '2'), agente('c', '3'), agente('d', '4')]
const cuadrante = {
  a: ['M'],
  b: ['M'],
  c: ['M'],
  d: ['T'],
}
const resumen = resumenDiaServicio({
  cuadrante,
  asignaciones: {
    '2026-09-01': {
      M: { a: 'Centro de Control', b: 'Centro de Control' },
    },
  },
  agentes,
  puestos,
  minimos: {
    'Centro de Control': { M: 1, T: 0, N: 0 },
    Lonjas: { M: 1, T: 0, N: 0 },
  },
  fecha: '2026-09-01',
  dia: 1,
})
if (resumen.trabajando !== 4) fallos.push(`trabajando ${resumen.trabajando}`)
if (resumen.minimo !== 2) fallos.push(`minimo ${resumen.minimo}`)
if (resumen.nivel !== 'verde') fallos.push(`nivel ${resumen.nivel}`)
const control = resumen.lineas.find((l) => l.puesto === 'Centro de Control' && l.turno === 'M')
if (!control || control.personas.length !== 2) fallos.push('control')
if (resumen.sinPuesto.length !== 2) fallos.push(`sin puesto ${resumen.sinPuesto.length}`)

await server.close()
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('OK', resumen.nivel, resumen.sobrante)
