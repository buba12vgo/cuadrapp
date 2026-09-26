import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const puestosMod = await server.ssrLoadModule('/src/lib/asignacionPuestos.ts')
const coberturaMod = await server.ssrLoadModule('/src/lib/coberturaDia.ts')
const accesoMod = await server.ssrLoadModule('/src/lib/acceso.ts')
const { asignarPuestoEnCelda, puestoEnCelda, puestosPermitidosParaAgente } = puestosMod
const { resumenDiaServicio } = coberturaMod
const { puedeVer, puedeEscribir } = accesoMod

const fallos = []
const puestos = [
  { codigo: 'CTR', nombre: 'Centro de Control', abreviatura: 'CTR', ambito: 'OPERATIVO' },
  { codigo: 'LNJ', nombre: 'Lonjas', abreviatura: 'LNJ', ambito: 'OPERATIVO' },
]
function agente(id, placa, excluidos = []) {
  return {
    id,
    numeroPlaca: placa,
    nombre: id,
    apellidos: 'Test',
    rolBase: 'POLICIA',
    limitaciones: { M: true, T: true, N: true },
    preferenciaAnual: { objetivoM: 4, objetivoT: 4, objetivoN: 3 },
    puestosExcluidos: excluidos,
    mesAnclaVacaciones: 'JUNIO',
    anioReferenciaVacaciones: 2026,
  }
}
const a = agente('a', '1')
const b = agente('b', '2', ['LNJ'])
const agentes = [a, b]
const cuadrante = { a: ['M'], b: ['M'] }
const minimos = {
  'Centro de Control': { M: 1, T: 0, N: 0 },
  Lonjas: { M: 1, T: 0, N: 0 },
}
let asignaciones = {
  '2026-09-01': { M: { a: 'Centro de Control' } },
}
let resumen = resumenDiaServicio({
  cuadrante,
  asignaciones,
  agentes,
  puestos,
  minimos,
  fecha: '2026-09-01',
  dia: 1,
})
const lonjas = resumen.lineas.find((l) => l.puesto === 'Lonjas' && l.turno === 'M')
if (!lonjas || !(lonjas.minimo > 0 && lonjas.personas.length < lonjas.minimo)) {
  fallos.push('lonjas deberia estar sin cubrir')
}
const control = resumen.lineas.find((l) => l.puesto === 'Centro de Control' && l.turno === 'M')
if (!control || control.personas.length !== 1) fallos.push('control inicial')

const movido = asignarPuestoEnCelda(asignaciones, b, '2026-09-01', 'M', 'Lonjas', puestos)
if (movido.ok) fallos.push('b no puede ir a Lonjas')
const permitidos = puestosPermitidosParaAgente(b, puestos, 'OPERATIVO')
if (permitidos.includes('Lonjas')) fallos.push('selector incluye Lonjas')
if (!permitidos.includes('Centro de Control')) fallos.push('falta Centro de Control')

const ok = asignarPuestoEnCelda(asignaciones, a, '2026-09-01', 'M', 'Lonjas', puestos)
if (!ok.ok) fallos.push(ok.error ?? 'no movio')
asignaciones = ok.asignaciones
resumen = resumenDiaServicio({
  cuadrante,
  asignaciones,
  agentes,
  puestos,
  minimos,
  fecha: '2026-09-01',
  dia: 1,
})
const lonjas2 = resumen.lineas.find((l) => l.puesto === 'Lonjas' && l.turno === 'M')
const control2 = resumen.lineas.find((l) => l.puesto === 'Centro de Control' && l.turno === 'M')
const celda = puestoEnCelda(asignaciones, '2026-09-01', 'a', 'M', puestos)
if (!celda || celda.abreviatura !== 'LNJ' || celda.nombre !== 'Lonjas') {
  fallos.push(`puesto en dia ${JSON.stringify(celda)}`)
}
if (puestoEnCelda(asignaciones, '2026-09-01', 'a', 'D', puestos)) {
  fallos.push('descanso no lleva puesto')
}
if (!lonjas2 || lonjas2.personas.length !== 1) fallos.push('lonjas tras mover')
if (!control2 || control2.personas.length !== 0 || control2.minimo !== 1) {
  fallos.push('control queda descubierto')
}

for (const rol of ['SUPERADMIN', 'ADMIN']) {
  if (!puedeVer(rol, 'diario-agentes') || !puedeEscribir(rol, 'diario-agentes')) {
    fallos.push(`acceso ${rol}`)
  }
  if (!puedeVer(rol, 'cuadrante-jefes') || !puedeVer(rol, 'calendario-jefes')) {
    fallos.push(`jefes ${rol}`)
  }
}
const jefatura = { esJefatura: true }
if (!puedeVer('CONSULTA_JEFES', 'diario-agentes', jefatura)) fallos.push('jefe ve diario')
if (!puedeEscribir('CONSULTA_JEFES', 'diario-agentes', jefatura)) fallos.push('jefe edita diario')
if (!puedeVer('CONSULTA_JEFES', 'cuadrante-jefes', jefatura)) fallos.push('jefe ve cuadrante')
if (!puedeVer('CONSULTA_JEFES', 'calendario-jefes', jefatura)) fallos.push('jefe ve calendario')
if (!puedeVer('CONSULTA_JEFES', 'diario-agentes')) fallos.push('agente ve diario')
if (puedeEscribir('CONSULTA_JEFES', 'diario-agentes')) fallos.push('agente edita diario')
if (puedeVer('CONSULTA_JEFES', 'cuadrante-jefes')) fallos.push('agente ve cuadrante')
if (puedeVer('CONSULTA_JEFES', 'calendario-jefes')) fallos.push('agente ve calendario')
if (!puedeVer('CONSULTA_JEFES', 'calendario')) fallos.push('agente ve eventos')
if (puedeEscribir('CONSULTA_JEFES', 'calendario')) fallos.push('agente edita eventos')
if (!puedeEscribir('CONSULTA_JEFES', 'calendario', { puedeEditarEventos: true })) {
  fallos.push('jefe con permiso edita eventos')
}

await server.close()
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('OK diario agentes')
