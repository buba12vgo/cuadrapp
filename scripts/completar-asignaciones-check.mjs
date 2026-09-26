import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const mod = await server.ssrLoadModule('/src/lib/completarAsignaciones.ts')
const { completarAsignacionesMes, patrullasSobrante } = mod

const puestos = [
  { codigo: 'CONTROL', nombre: 'Centro de Control', abreviatura: 'CTR', ambito: 'OPERATIVO' },
  { codigo: 'LONJAS', nombre: 'Lonjas', abreviatura: 'LNJ', ambito: 'OPERATIVO' },
  { codigo: 'PMU', nombre: 'Patrulla Muelles', abreviatura: 'PMU', ambito: 'OPERATIVO' },
  { codigo: 'PAR', nombre: 'Patrulla Arenal', abreviatura: 'PAR', ambito: 'OPERATIVO' },
  { codigo: 'PBO', nombre: 'Patrulla Bouzas', abreviatura: 'PBO', ambito: 'OPERATIVO' },
]

function agente(id, placa, excluidos = []) {
  return {
    id,
    numeroPlaca: placa,
    nombre: id,
    apellidos: '',
    rolBase: 'POLICIA',
    limitaciones: { M: true, T: true, N: true },
    preferenciaAnual: { objetivoM: 4, objetivoT: 4, objetivoN: 3 },
    puestosExcluidos: excluidos,
    mesAnclaVacaciones: 'JUNIO',
    anioReferenciaVacaciones: 2026,
  }
}

const minimos = {
  'Centro de Control': { M: 1, T: 0, N: 0 },
  Lonjas: { M: 1, T: 0, N: 0 },
  'Patrulla Muelles': { M: 0, T: 0, N: 0 },
  'Patrulla Arenal': { M: 0, T: 0, N: 0 },
  'Patrulla Bouzas': { M: 0, T: 0, N: 0 },
}

const agentes = [
  agente('a', '10'),
  agente('b', '20', ['LONJAS']),
  agente('c', '30', ['CONTROL']),
  agente('d', '40'),
  agente('e', '50', ['PMU', 'PAR', 'PBO', 'CONTROL', 'LONJAS']),
]

const cuadrante = {
  a: ['M'],
  b: ['M'],
  c: ['M'],
  d: ['M'],
  e: ['M'],
}

const resultado = completarAsignacionesMes({
  cuadrante,
  asignaciones: {
    '2026-09-01': { M: { a: 'Lonjas' } },
  },
  agentes,
  puestos,
  minimosDeFecha: () => minimos,
  anio: 2026,
  mes: 9,
  nDias: 1,
  isoFecha: (anio, mes, dia) =>
    `${anio}-${String(mes).padStart(2, '0')}-${String(dia).padStart(2, '0')}`,
})

const turno = resultado.asignaciones['2026-09-01'].M
const fallos = []
if (turno.a !== 'Lonjas') fallos.push(`a debía seguir en Lonjas, tiene ${turno.a}`)
if (turno.b !== 'Centro de Control') {
  fallos.push(`b debía cubrir Control (no puede Lonjas), tiene ${turno.b}`)
}
const sobrantes = [turno.c, turno.d].sort()
const esperado = ['Patrulla Arenal', 'Patrulla Muelles']
if (sobrantes.join('|') !== esperado.join('|')) {
  fallos.push(`sobrantes ${sobrantes.join(', ')}`)
}
if (turno.e) fallos.push(`e no tiene puesto habilitado y quedó en ${turno.e}`)
if (resultado.sinPuesto !== 1) fallos.push(`sinPuesto ${resultado.sinPuesto}`)
if (resultado.asignadas !== 3) fallos.push(`asignadas ${resultado.asignadas}`)

const nombres = patrullasSobrante(puestos).map((p) => p.nombre)
if (nombres.join('|') !== 'Patrulla Muelles|Patrulla Arenal|Patrulla Bouzas') {
  fallos.push(`orden patrullas ${nombres.join(', ')}`)
}

await server.close()
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('OK', JSON.stringify(turno))
