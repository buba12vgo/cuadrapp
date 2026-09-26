import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})
const mod = await server.ssrLoadModule('/src/lib/solicitudes.ts')
const permisos = await server.ssrLoadModule('/src/lib/permisos.ts')
const {
  contextoCobertura,
  aplicarPermisoEnCuadrante,
  ordenarSolicitudes,
  opcionesCambioDia,
  aplicarCambioDiaEnCuadrante,
  cambioDiaValidado,
  etiquetaEstadoSolicitud,
} = mod
const { permisoRequiereSaldo, PERMISOS_INICIALES } = permisos

const fallos = []
function igual(nombre, valor, esperado) {
  const a = JSON.stringify(valor)
  const b = JSON.stringify(esperado)
  if (a !== b) fallos.push(`${nombre}: ${a} !== ${b}`)
}

const asuntos = PERMISOS_INICIALES.find((item) => item.codigo === 'ASUNTOS_PROPIOS')
const it = PERMISOS_INICIALES.find((item) => item.codigo === 'IT')
igual('asuntos exige saldo', permisoRequiereSaldo(asuntos), true)
igual('it no exige saldo', permisoRequiereSaldo(it), false)
igual(
  'legado con tope exige saldo',
  permisoRequiereSaldo({ codigo: 'X', nombre: 'X', abreviatura: 'X', diasAnuales: 3 }),
  true,
)
igual(
  'legado sin tope no exige',
  permisoRequiereSaldo({ codigo: 'Y', nombre: 'Y', abreviatura: 'Y', diasAnuales: 0 }),
  false,
)

const cuadrante = {
  a: ['M', 'D'],
  b: ['M', 'D'],
  c: ['T', 'D'],
}
const asignaciones = {
  '2026-09-26': {
    M: { a: 'Centro de Control', b: 'Lonjas' },
    T: { c: 'Berbés Acceso' },
  },
}
const nombres = new Map([
  ['a', { placa: '1', nombre: 'Ana' }],
  ['b', { placa: '2', nombre: 'Bea' }],
  ['c', { placa: '3', nombre: 'Cid' }],
])
const contexto = contextoCobertura({
  cuadrante,
  asignaciones,
  fecha: '2026-09-26',
  dia: 1,
  agenteId: 'a',
  nombres,
})
igual('puesto libre', contexto.puestoLibre, 'Centro de Control')
igual(
  'candidatos del mismo turno',
  contexto.candidatos.map((item) => item.id),
  ['b'],
)

const aplicado = aplicarPermisoEnCuadrante({
  cuadrante,
  asignaciones,
  fecha: '2026-09-26',
  dia: 1,
  agenteId: 'a',
  permisoNombre: 'Asuntos propios',
  coberturaId: 'b',
})
igual('dia en permiso', aplicado.cuadrante.a[0], 'P')
igual('permiso anotado', aplicado.asignaciones['2026-09-26'].P.a, 'Asuntos propios')
igual('puesto cubierto', aplicado.asignaciones['2026-09-26'].M.b, 'Centro de Control')
igual('origen sin puesto de mañana', aplicado.asignaciones['2026-09-26'].M.a, undefined)

const orden = ordenarSolicitudes([
  { fecha: '2026-09-02', creadaEn: '2026-09-01T10:00:00.000Z', id: 'tarde' },
  { fecha: '2026-09-01', creadaEn: '2026-09-01T12:00:00.000Z', id: 'dia1-tarde' },
  { fecha: '2026-09-01', creadaEn: '2026-09-01T08:00:00.000Z', id: 'dia1-pronto' },
])
igual(
  'orden dia y solicitud',
  orden.map((item) => item.id),
  ['dia1-pronto', 'dia1-tarde', 'tarde'],
)

const cambio = {
  a: ['M', 'D', 'T'],
  b: ['D', 'M', 'D'],
  c: ['D', 'T', 'D'],
  d: ['M', 'M', 'D'],
}
const asignacionCambio = {
  '2026-09-01': { M: { a: 'Centro de Control', d: 'Lonjas' } },
  '2026-09-02': { M: { b: 'Berbés', d: 'Retén' }, T: { c: 'Lonjas' } },
}
const nombresCambio = new Map([
  ['a', { placa: '1', nombre: 'Ana' }],
  ['b', { placa: '2', nombre: 'Bea' }],
  ['c', { placa: '3', nombre: 'Cid' }],
  ['d', { placa: '4', nombre: 'Dio' }],
])
const opciones = opcionesCambioDia({
  cuadrante: cambio,
  asignaciones: asignacionCambio,
  anio: 2026,
  mes: 9,
  diaLibre: 1,
  agenteId: 'a',
  nombres: nombresCambio,
})
igual(
  'solo mismo turno y descanso',
  opciones.map((item) => `${item.dia}:${item.agenteId}`),
  ['2:b'],
)

const trasCambio = aplicarCambioDiaEnCuadrante({
  cuadrante: cambio,
  asignaciones: asignacionCambio,
  agenteId: 'a',
  companeroId: 'b',
  fechaLibre: '2026-09-01',
  fechaCompensa: '2026-09-02',
})
igual('ana libra el 1', trasCambio.cuadrante.a[0], 'D')
igual('bea cubre el 1', trasCambio.cuadrante.b[0], 'M')
igual('ana compensa el 2', trasCambio.cuadrante.a[1], 'M')
igual('bea libra el 2', trasCambio.cuadrante.b[1], 'D')
igual('puesto del 1 pasa a bea', trasCambio.asignaciones['2026-09-01'].M.b, 'Centro de Control')
igual('puesto del 2 pasa a ana', trasCambio.asignaciones['2026-09-02'].M.a, 'Berbés')

const base = {
  id: 's',
  agenteId: 'a',
  placa: '1',
  nombreAgente: 'Ana',
  fecha: '2026-09-01',
  creadaEn: '2026-09-01T10:00:00.000Z',
}
igual(
  'cambio sin validar',
  etiquetaEstadoSolicitud({
    ...base,
    tipo: 'CAMBIO_DIA',
    estado: 'PENDIENTE',
    validacionCompanero: 'PENDIENTE',
  }),
  'Pendiente de validación',
)
igual(
  'cambio validado sigue pendiente',
  etiquetaEstadoSolicitud({
    ...base,
    tipo: 'CAMBIO_DIA',
    estado: 'PENDIENTE',
    validacionCompanero: 'VALIDADA',
  }),
  'Pendiente',
)
igual(
  'rechazo del compañero',
  etiquetaEstadoSolicitud({
    ...base,
    tipo: 'CAMBIO_DIA',
    estado: 'RECHAZADA',
    validacionCompanero: 'RECHAZADA',
  }),
  'Rechazada por el compañero',
)
igual('permiso no espera validación', cambioDiaValidado({ tipo: 'PERMISO' }), true)
igual(
  'cambio sin validar no lo resuelve el superadmin',
  cambioDiaValidado({ tipo: 'CAMBIO_DIA', validacionCompanero: 'PENDIENTE' }),
  false,
)
igual(
  'cambio validado lo resuelve el superadmin',
  cambioDiaValidado({ tipo: 'CAMBIO_DIA', validacionCompanero: 'VALIDADA' }),
  true,
)

await server.close()
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('solicitudes-check ok')
