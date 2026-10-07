import { createServer } from 'vite'

const server = await createServer({
  server: { middlewareMode: true },
  appType: 'custom',
  logLevel: 'error',
})

const cuposMod = await server.ssrLoadModule('/src/lib/cuposPermiso.ts')
const tiposMod = await server.ssrLoadModule('/src/lib/tiposEvento.ts')
const calMod = await server.ssrLoadModule('/src/lib/calendarioPuestos.ts')
const etiqMod = await server.ssrLoadModule('/src/lib/etiquetasEvento.ts')
const accesoMod = await server.ssrLoadModule('/src/lib/acceso.ts')

const {
  CODIGO_DIAS_ANO_ANTERIOR,
  cuposAnioConRollover,
  snapshotDaaPendiente,
  leerCuposPermisoAnio,
  saldoTipoPermiso,
} = cuposMod
const {
  CODIGO_OPERATIVA_ESPECIAL,
  TIPOS_EVENTO_INICIALES,
  esTipoEventoSistema,
  estiloTipoEvento,
} = tiposMod
const {
  TIPO_DIA_NORMAL,
  opcionesTipoDiaEditor,
  tipoEditorDesdeEvento,
  tipoEventoDesdeEditor,
} = calMod
const { etiquetaDeTipo } = etiqMod
const { puedeVer, puedeEscribir } = accesoMod

const fallos = []

const agenteVacio = {
  id: 'a',
  numeroPlaca: '1',
  nombre: 'Ana',
  apellidos: 'Test',
  rolBase: 'POLICIA',
  limitaciones: { M: true, T: true, N: true },
  preferenciaAnual: { objetivoM: 4, objetivoT: 4, objetivoN: 3 },
  puestosExcluidos: [],
  mesAnclaVacaciones: 'JUNIO',
}

if (!snapshotDaaPendiente(agenteVacio, 2026)) {
  fallos.push('DAA vacio deberia estar pendiente')
}

const conManual = {
  ...agenteVacio,
  cuposPermisoAnio: cuposAnioConRollover(agenteVacio, 2026, 9),
}
if (snapshotDaaPendiente(conManual, 2026)) {
  fallos.push('DAA manual no deberia pitarse')
}
if (leerCuposPermisoAnio(conManual, 2026)[CODIGO_DIAS_ANO_ANTERIOR] !== 9) {
  fallos.push('cupo DAA manual')
}

const conCero = {
  ...agenteVacio,
  cuposPermisoAnio: cuposAnioConRollover(agenteVacio, 2026, 0),
}
if (snapshotDaaPendiente(conCero, 2026)) {
  fallos.push('DAA 0 tambien es snapshot')
}

const permisoDaa = {
  codigo: CODIGO_DIAS_ANO_ANTERIOR,
  nombre: 'Días del Año Anterior',
  abreviatura: 'DAA',
  diasAnuales: 0,
}
const saldo = saldoTipoPermiso(conManual, permisoDaa, 2026, {
  porTipo: {},
  jornadaDisponible: 0,
})
if (saldo.cupo !== 9) fallos.push(`saldo DAA ${saldo.cupo}`)

if (!esTipoEventoSistema(CODIGO_OPERATIVA_ESPECIAL)) {
  fallos.push('operativa especial es sistema')
}
if (esTipoEventoSistema('FERIA')) fallos.push('feria no es sistema')

const opciones = opcionesTipoDiaEditor(TIPOS_EVENTO_INICIALES)
if (!opciones.some((o) => o.codigo === TIPO_DIA_NORMAL)) {
  fallos.push('falta Normal')
}
if (opciones.some((o) => o.codigo === CODIGO_OPERATIVA_ESPECIAL)) {
  fallos.push('operativa no sale en el desplegable')
}
if (!opciones.some((o) => o.codigo === 'CRUCERO')) fallos.push('falta Crucero')

const extras = opcionesTipoDiaEditor(TIPOS_EVENTO_INICIALES, 'FERIA')
if (!extras.some((o) => o.codigo === 'FERIA')) fallos.push('tipo borrado sigue en select')

if (tipoEventoDesdeEditor(TIPO_DIA_NORMAL) !== CODIGO_OPERATIVA_ESPECIAL) {
  fallos.push('normal -> operativa')
}
if (tipoEditorDesdeEvento({ tipo: 'FERIA' }) !== 'FERIA') {
  fallos.push('editor conserva tipo nuevo')
}

const feria = estiloTipoEvento({
  codigo: 'FERIA',
  nombre: 'Feria',
  emoji: '🎡',
  color: 'violeta',
})
if (feria.texto !== 'Feria' || !feria.clase.includes('violet')) {
  fallos.push('estilo feria')
}
if (etiquetaDeTipo('CRUCERO', TIPOS_EVENTO_INICIALES).texto !== 'Crucero') {
  fallos.push('etiqueta crucero')
}
if (etiquetaDeTipo('FERIA', [ { codigo: 'FERIA', nombre: 'Feria', emoji: '🎡', color: 'verde' } ]).texto !== 'Feria') {
  fallos.push('etiqueta catalogo')
}

if (!puedeVer('ADMIN', 'tipos-evento') || !puedeEscribir('SUPERADMIN', 'tipos-evento')) {
  fallos.push('acceso admin tipos')
}
if (puedeVer('CONSULTA_JEFES', 'tipos-evento')) fallos.push('consulta no ve tipos')

await server.close()
if (fallos.length) {
  console.error(fallos.join('\n'))
  process.exit(1)
}
console.log('OK daa y tipos de evento')
