import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  query,
  setDoc,
  where,
  writeBatch,
} from 'firebase/firestore'
import { ensureFirebase, getDb } from '@/lib/firebase'
import {
  PUESTOS_INICIALES,
  clonarMinimosPuesto,
  crearMinimosSemana,
  normalizarAmbitoPuesto,
  normalizarOrdenPuesto,
  ordenarPuestos,
  type DiaSemana,
  type MinimosDia,
  type MinimosPuesto,
  type MinimosSemana,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import {
  PERMISOS_INICIALES,
  permisoRequiereSaldo,
  permisoSumaDiaTrabajo,
  type PermisoConfig,
} from '@/lib/permisos'
import {
  ordenarSolicitudes,
  type EstadoSolicitud,
  type Solicitud,
  type TipoSolicitud,
} from '@/lib/solicitudes'
import {
  idDocumentoCuadrante,
  parseCuadranteFirestore,
  type CuadranteMensualFirestore,
} from '@/lib/cuadranteFirestore'
import { LIMITACIONES_DEFECTO, leerLimitaciones } from '@/lib/limitaciones'
import {
  leerPreferenciaAnual,
  PREFERENCIA_DEFECTO,
} from '@/lib/preferenciasAnuales'
import {
  idDocumentoPlanAnual,
  parsePlanAnualFirestore,
  planDesdeFirestore,
  planParaFirestore,
} from '@/lib/planAnualFirestore'
import type { ObjetivosGlobales, PlanAnual } from '@/lib/generarPlanAnual'
import { ANIO_REFERENCIA_VACACIONES_DEFECTO } from '@/lib/vacaciones'
import { esFechaIso } from '@/lib/fechas'
import type {
  EventoOperativo,
  FichaPolicia,
  PreferenciaAnual,
  RolPolicia,
} from '@/types'
import {
  ESTILOS_TIPO_EVENTO,
  TIPOS_EVENTO_INICIALES,
  esCodigoTipoEvento,
  ordenarTiposEvento,
  tipoEventoEsSistema,
  type TipoEventoConfig,
} from '@/lib/tiposEvento'

const COLECCION_AGENTES = 'agentes'
const COLECCION_CUADRANTES = 'cuadrantes'
const COLECCION_CUADRANTES_JEFES = 'cuadrantesJefes'
const COLECCION_EVENTOS = 'eventos'
const COLECCION_PUESTOS = 'puestos'
const COLECCION_TIPOS_PERMISO = 'tiposPermiso'
const COLECCION_TIPOS_EVENTO = 'tiposEvento'
const COLECCION_SOLICITUDES = 'solicitudes'
const COLECCION_CONFIG = 'config'
const COLECCION_PLANES_ANUALES = 'planesAnuales'
const DOC_MINIMOS_SEMANA = 'minimosSemana'

const DIAS_SEMANA: DiaSemana[] = [1, 2, 3, 4, 5, 6, 7]

const ROLES: RolPolicia[] = [
  'RESPONSABLE',
  'JEFE_SERVICIO',
  'JEFE_EQUIPO',
  'POLICIA',
  'POLICIA_BOLSA',
]

const MESES_VACACIONES: FichaPolicia['mesAnclaVacaciones'][] = [
  'JUNIO',
  'JULIO',
  'SEPTIEMBRE',
  'AGOSTO',
]

async function requireDb() {
  const ready = await ensureFirebase()
  const firestore = getDb()
  if (!ready || !firestore) {
    throw new Error(
      'Firebase no está configurado. Define VITE_FIREBASE_* en Vercel (valores no vacíos) o .env.local en desarrollo, y redespliega.',
    )
  }
  return firestore
}

function esRolPolicia(valor: unknown): valor is RolPolicia {
  return typeof valor === 'string' && ROLES.includes(valor as RolPolicia)
}

function esMesVacaciones(
  valor: unknown,
): valor is FichaPolicia['mesAnclaVacaciones'] {
  return (
    typeof valor === 'string' &&
    MESES_VACACIONES.includes(valor as FichaPolicia['mesAnclaVacaciones'])
  )
}

function leerPreferencia(valor: unknown): PreferenciaAnual {
  return leerPreferenciaAnual(valor)
}

function leerPuestosExcluidos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is string => typeof item === 'string')
}

function leerCuposPermiso(valor: unknown): Record<string, number> | undefined {
  if (!valor || typeof valor !== 'object') return undefined
  const result: Record<string, number> = {}
  for (const [codigo, dias] of Object.entries(
    valor as Record<string, unknown>,
  )) {
    if (!codigo.trim()) continue
    if (typeof dias !== 'number' || !Number.isFinite(dias)) continue
    result[codigo.trim().toUpperCase()] = Math.min(
      366,
      Math.max(0, Math.round(dias)),
    )
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function leerCuposPermisoAnio(
  valor: unknown,
): Record<string, Record<string, number>> | undefined {
  if (!valor || typeof valor !== 'object') return undefined
  const result: Record<string, Record<string, number>> = {}
  for (const [anio, cupos] of Object.entries(valor as Record<string, unknown>)) {
    const leido = leerCuposPermiso(cupos)
    if (leido) result[anio] = leido
  }
  return Object.keys(result).length > 0 ? result : undefined
}

function agenteDesdeFirestore(
  docId: string,
  data: Record<string, unknown>,
): FichaPolicia {
  const numeroPlaca =
    typeof data.numeroPlaca === 'string' && data.numeroPlaca.trim()
      ? data.numeroPlaca.trim()
      : docId

  return {
    id: typeof data.id === 'string' && data.id.trim() ? data.id.trim() : docId,
    numeroPlaca,
    nombre: typeof data.nombre === 'string' ? data.nombre.trim() : '',
    apellidos: typeof data.apellidos === 'string' ? data.apellidos.trim() : '',
    rolBase: esRolPolicia(data.rolBase) ? data.rolBase : 'POLICIA',
    limitaciones: leerLimitaciones(data.limitaciones),
    preferenciaAnual: leerPreferencia(data.preferenciaAnual),
    puestosExcluidos: leerPuestosExcluidos(data.puestosExcluidos),
    mesAnclaVacaciones: esMesVacaciones(data.mesAnclaVacaciones)
      ? data.mesAnclaVacaciones
      : 'AGOSTO',
    anioReferenciaVacaciones:
      typeof data.anioReferenciaVacaciones === 'number' &&
      Number.isFinite(data.anioReferenciaVacaciones)
        ? Math.round(data.anioReferenciaVacaciones)
        : ANIO_REFERENCIA_VACACIONES_DEFECTO,
    cuposPermiso: leerCuposPermiso(data.cuposPermiso),
    cuposPermisoAnio: leerCuposPermisoAnio(data.cuposPermisoAnio),
  }
}

function agenteParaFirestore(agente: FichaPolicia): FichaPolicia {
  const numeroPlaca = agente.numeroPlaca.trim()
  if (!numeroPlaca) {
    throw new Error('El número de placa es obligatorio')
  }

  const docId = agente.id.trim() || numeroPlaca

  const payload: FichaPolicia = {
    id: docId,
    numeroPlaca,
    nombre: agente.nombre.trim(),
    apellidos: agente.apellidos.trim(),
    rolBase: agente.rolBase,
    limitaciones: { ...agente.limitaciones },
    preferenciaAnual: { ...agente.preferenciaAnual },
    puestosExcluidos: [...agente.puestosExcluidos],
    mesAnclaVacaciones: agente.mesAnclaVacaciones,
    anioReferenciaVacaciones: ANIO_REFERENCIA_VACACIONES_DEFECTO,
    cuposPermiso: agente.cuposPermiso,
    cuposPermisoAnio: agente.cuposPermisoAnio,
  }
  if (!payload.cuposPermiso) delete payload.cuposPermiso
  if (!payload.cuposPermisoAnio) delete payload.cuposPermisoAnio
  return payload
}

export function agenteNuevo(): FichaPolicia {
  return {
    id: '',
    numeroPlaca: '',
    nombre: '',
    apellidos: '',
    rolBase: 'POLICIA',
    limitaciones: { ...LIMITACIONES_DEFECTO },
    preferenciaAnual: { ...PREFERENCIA_DEFECTO },
    puestosExcluidos: [],
    mesAnclaVacaciones: 'AGOSTO',
    anioReferenciaVacaciones: ANIO_REFERENCIA_VACACIONES_DEFECTO,
  }
}

export async function getAgentes(): Promise<FichaPolicia[]> {
  const firestore = await requireDb()
  const snapshot = await getDocs(collection(firestore, COLECCION_AGENTES))
  const agentes = snapshot.docs.map((documento) =>
    agenteDesdeFirestore(documento.id, documento.data()),
  )
  return agentes.sort((a, b) =>
    a.numeroPlaca.localeCompare(b.numeroPlaca, 'es', { numeric: true }),
  )
}

const TIEMPO_ESCRITURA_MS = 15_000

function conTiempoLimite<T>(
  promesa: Promise<T>,
  ms = TIEMPO_ESCRITURA_MS,
): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      reject(
        new Error(
          'Firestore no confirmó la escritura a tiempo. El dato puede haberse guardado; recarga la página si no lo ves.',
        ),
      )
    }, ms)
    promesa.then(
      (valor) => {
        clearTimeout(id)
        resolve(valor)
      },
      (error: unknown) => {
        clearTimeout(id)
        reject(error)
      },
    )
  })
}

export async function saveAgente(agente: FichaPolicia): Promise<FichaPolicia> {
  const firestore = await requireDb()
  const payload = agenteParaFirestore(agente)
  await conTiempoLimite(
    setDoc(doc(firestore, COLECCION_AGENTES, payload.id), payload, {
      merge: true,
    }),
  )
  return payload
}

export async function deleteAgente(id: string): Promise<void> {
  const firestore = await requireDb()
  const docId = id.trim()
  if (!docId) throw new Error('Identificador de agente vacío')
  await conTiempoLimite(deleteDoc(doc(firestore, COLECCION_AGENTES, docId)))
}

const TAMANO_LOTE = 400

export async function saveAgentes(
  agentes: FichaPolicia[],
): Promise<FichaPolicia[]> {
  const firestore = await requireDb()
  const payloads = agentes.map(agenteParaFirestore)

  for (let inicio = 0; inicio < payloads.length; inicio += TAMANO_LOTE) {
    const lote = payloads.slice(inicio, inicio + TAMANO_LOTE)
    const batch = writeBatch(firestore)
    for (const payload of lote) {
      batch.set(doc(firestore, COLECCION_AGENTES, payload.id), payload, {
        merge: true,
      })
    }
    await conTiempoLimite(batch.commit(), 30_000)
  }

  return payloads
}

type ColeccionCuadrante =
  | typeof COLECCION_CUADRANTES
  | typeof COLECCION_CUADRANTES_JEFES

async function leerCuadranteDe(
  coleccion: ColeccionCuadrante,
  mes: number,
  anio: number,
): Promise<CuadranteMensualFirestore | null> {
  const firestore = await requireDb()
  const docId = idDocumentoCuadrante(anio, mes)
  const snapshot = await getDoc(doc(firestore, coleccion, docId))
  if (!snapshot.exists()) return null
  return parseCuadranteFirestore(snapshot.data())
}

async function escribirCuadranteEn(
  coleccion: ColeccionCuadrante,
  mes: number,
  anio: number,
  datosCuadrante: CuadranteMensualFirestore,
): Promise<void> {
  const firestore = await requireDb()
  const docId = idDocumentoCuadrante(anio, mes)
  await conTiempoLimite(
    setDoc(
      doc(firestore, coleccion, docId),
      {
        ...datosCuadrante,
        anio,
        mes,
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true },
    ),
  )
}

export function getCuadrante(mes: number, anio: number) {
  return leerCuadranteDe(COLECCION_CUADRANTES, mes, anio)
}

export async function getPlanesAnuales(agentes: FichaPolicia[]): Promise<{
  planes: Record<number, PlanAnual>
  objetivos: Record<number, ObjetivosGlobales>
}> {
  const firestore = await requireDb()
  const snapshot = await getDocs(
    collection(firestore, COLECCION_PLANES_ANUALES),
  )
  const planes: Record<number, PlanAnual> = {}
  const objetivos: Record<number, ObjetivosGlobales> = {}

  for (const documento of snapshot.docs) {
    const parsed = parsePlanAnualFirestore(documento.id, documento.data())
    if (!parsed) continue
    planes[parsed.anio] = planDesdeFirestore(parsed, agentes)
    if (parsed.objetivos) objetivos[parsed.anio] = parsed.objetivos
  }

  return { planes, objetivos }
}

export async function savePlanAnual(
  anio: number,
  plan: PlanAnual,
  objetivos: ObjetivosGlobales,
  agentes: FichaPolicia[],
): Promise<void> {
  const firestore = await requireDb()
  const docId = idDocumentoPlanAnual(anio)
  await conTiempoLimite(
    setDoc(
      doc(firestore, COLECCION_PLANES_ANUALES, docId),
      {
        anio,
        agentes: planParaFirestore(plan, agentes),
        objetivos: { M: objetivos.M, T: objetivos.T, N: objetivos.N },
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true },
    ),
  )
}

export function saveCuadrante(
  mes: number,
  anio: number,
  datosCuadrante: CuadranteMensualFirestore,
) {
  return escribirCuadranteEn(COLECCION_CUADRANTES, mes, anio, datosCuadrante)
}

export function getCuadranteJefes(mes: number, anio: number) {
  return leerCuadranteDe(COLECCION_CUADRANTES_JEFES, mes, anio)
}

export function saveCuadranteJefes(
  mes: number,
  anio: number,
  datosCuadrante: CuadranteMensualFirestore,
) {
  return escribirCuadranteEn(COLECCION_CUADRANTES_JEFES, mes, anio, datosCuadrante)
}

function leerMinimosPuesto(valor: unknown): MinimosPuesto | null {
  if (!valor || typeof valor !== 'object') return null
  const raw = valor as Record<string, unknown>
  const leer = (n: unknown) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return 0
    return Math.min(99, Math.max(0, Math.round(n)))
  }
  return { M: leer(raw.M), T: leer(raw.T), N: leer(raw.N) }
}

function leerModificadoresMinimos(
  valor: unknown,
): EventoOperativo['modificadoresMinimos'] {
  if (!valor || typeof valor !== 'object') return {}
  const result: EventoOperativo['modificadoresMinimos'] = {}
  for (const [puesto, turnos] of Object.entries(
    valor as Record<string, unknown>,
  )) {
    const leido = leerMinimosPuesto(turnos)
    if (leido) result[puesto] = leido
  }
  return result
}

function eventoDesdeFirestore(
  docId: string,
  data: Record<string, unknown>,
): EventoOperativo | null {
  const fecha = esFechaIso(data.fecha) ? data.fecha : null
  const tipo =
    typeof data.tipo === 'string' ? data.tipo.trim().toUpperCase() : ''
  if (!fecha || !esCodigoTipoEvento(tipo)) return null

  return {
    id:
      typeof data.id === 'string' && data.id.trim()
        ? data.id.trim()
        : docId || `ev-${fecha}`,
    fecha,
    tipo,
    descripcion:
      typeof data.descripcion === 'string' ? data.descripcion.trim() : '',
    modificadoresMinimos: leerModificadoresMinimos(data.modificadoresMinimos),
  }
}

function eventoParaFirestore(evento: EventoOperativo): EventoOperativo {
  const fecha = evento.fecha.trim()
  if (!esFechaIso(fecha)) {
    throw new Error('La fecha del evento no es válida')
  }
  const tipo = evento.tipo.trim().toUpperCase()
  if (!esCodigoTipoEvento(tipo)) {
    throw new Error('El tipo del evento no es válido')
  }
  const id = evento.id.trim() || `ev-${fecha}`
  const modificadoresMinimos: EventoOperativo['modificadoresMinimos'] = {}
  for (const [puesto, turnos] of Object.entries(evento.modificadoresMinimos)) {
    modificadoresMinimos[puesto] = clonarMinimosPuesto(turnos)
  }
  return {
    id,
    fecha,
    tipo,
    descripcion: evento.descripcion.trim(),
    modificadoresMinimos,
  }
}

export async function getEventos(): Promise<EventoOperativo[]> {
  const firestore = await requireDb()
  const snapshot = await getDocs(collection(firestore, COLECCION_EVENTOS))
  const eventos: EventoOperativo[] = []
  for (const documento of snapshot.docs) {
    const evento = eventoDesdeFirestore(documento.id, documento.data())
    if (evento) eventos.push(evento)
  }
  return eventos.sort((a, b) => a.fecha.localeCompare(b.fecha))
}

export async function saveEvento(
  evento: EventoOperativo,
): Promise<EventoOperativo> {
  const firestore = await requireDb()
  const payload = eventoParaFirestore(evento)
  await conTiempoLimite(
    setDoc(doc(firestore, COLECCION_EVENTOS, payload.id), payload, {
      merge: true,
    }),
  )
  return payload
}

export async function deleteEvento(eventoId: string): Promise<void> {
  const firestore = await requireDb()
  const id = eventoId.trim()
  if (!id) throw new Error('Identificador de evento vacío')
  await conTiempoLimite(deleteDoc(doc(firestore, COLECCION_EVENTOS, id)))
}

function puestoDesdeFirestore(
  docId: string,
  data: Record<string, unknown>,
): PuestoConfig | null {
  const codigo =
    typeof data.codigo === 'string' && data.codigo.trim()
      ? data.codigo.trim().toUpperCase()
      : docId.trim().toUpperCase()
  const nombre =
    typeof data.nombre === 'string' ? data.nombre.trim() : ''
  const abreviatura =
    typeof data.abreviatura === 'string'
      ? data.abreviatura.trim().toUpperCase()
      : ''
  if (!codigo || !nombre || !abreviatura) return null
  return {
    codigo,
    nombre,
    abreviatura,
    ambito: normalizarAmbitoPuesto(data.ambito),
    orden: normalizarOrdenPuesto(data.orden),
  }
}

function puestoParaFirestore(puesto: PuestoConfig): PuestoConfig {
  const codigo = puesto.codigo.trim().toUpperCase()
  const nombre = puesto.nombre.trim()
  const abreviatura = puesto.abreviatura.trim().toUpperCase()
  if (!codigo) throw new Error('El código del puesto es obligatorio')
  if (!nombre) throw new Error('El nombre del puesto es obligatorio')
  if (!abreviatura) throw new Error('La abreviatura del puesto es obligatoria')
  return {
    codigo,
    nombre,
    abreviatura,
    ambito: normalizarAmbitoPuesto(puesto.ambito),
    orden: normalizarOrdenPuesto(puesto.orden),
  }
}

export async function getPuestos(): Promise<PuestoConfig[]> {
  const firestore = await requireDb()
  const snapshot = await getDocs(collection(firestore, COLECCION_PUESTOS))
  const puestos: PuestoConfig[] = []
  for (const documento of snapshot.docs) {
    const puesto = puestoDesdeFirestore(documento.id, documento.data())
    if (puesto) puestos.push(puesto)
  }
  return ordenarPuestos(puestos)
}

export async function savePuesto(puesto: PuestoConfig): Promise<PuestoConfig> {
  const firestore = await requireDb()
  const payload = puestoParaFirestore(puesto)
  await conTiempoLimite(
    setDoc(doc(firestore, COLECCION_PUESTOS, payload.codigo), payload, {
      merge: true,
    }),
  )
  return payload
}

export async function deletePuesto(codigo: string): Promise<void> {
  const firestore = await requireDb()
  const id = codigo.trim().toUpperCase()
  if (!id) throw new Error('Código de puesto vacío')
  await conTiempoLimite(deleteDoc(doc(firestore, COLECCION_PUESTOS, id)))
}

export async function seedPuestosSiVacios(
  puestos: PuestoConfig[] = PUESTOS_INICIALES,
): Promise<PuestoConfig[]> {
  const existentes = await getPuestos()
  if (existentes.length > 0) return existentes

  const firestore = await requireDb()
  const batch = writeBatch(firestore)
  const lista = puestos.map(puestoParaFirestore)
  for (const puesto of lista) {
    batch.set(doc(firestore, COLECCION_PUESTOS, puesto.codigo), puesto, {
      merge: true,
    })
  }
  await conTiempoLimite(batch.commit())
  return lista
}

function normalizarDiasAnuales(valor: unknown, codigo: string) {
  if (typeof valor === 'number' && Number.isFinite(valor)) {
    return Math.min(366, Math.max(0, Math.round(valor)))
  }
  return codigo === 'ASUNTOS_PROPIOS' ? 6 : 0
}

function permisoDesdeFirestore(
  docId: string,
  data: Record<string, unknown>,
): PermisoConfig | null {
  const codigo =
    typeof data.codigo === 'string' && data.codigo.trim()
      ? data.codigo.trim().toUpperCase()
      : docId.trim().toUpperCase()
  const nombre =
    typeof data.nombre === 'string' ? data.nombre.trim() : ''
  const abreviatura =
    typeof data.abreviatura === 'string'
      ? data.abreviatura.trim().toUpperCase()
      : ''
  if (!codigo || !nombre || !abreviatura) return null
  return {
    codigo,
    nombre,
    abreviatura,
    diasAnuales: normalizarDiasAnuales(data.diasAnuales, codigo),
    visible: data.visible !== false,
    requiereSaldo:
      typeof data.requiereSaldo === 'boolean' ? data.requiereSaldo : undefined,
    sumaDiaTrabajo:
      typeof data.sumaDiaTrabajo === 'boolean' ? data.sumaDiaTrabajo : undefined,
  }
}

function permisoParaFirestore(permiso: PermisoConfig): PermisoConfig {
  const codigo = permiso.codigo.trim().toUpperCase()
  const nombre = permiso.nombre.trim()
  const abreviatura = permiso.abreviatura.trim().toUpperCase()
  if (!codigo) throw new Error('El código del permiso es obligatorio')
  if (!nombre) throw new Error('El nombre del permiso es obligatorio')
  return {
    codigo,
    nombre,
    abreviatura,
    diasAnuales: normalizarDiasAnuales(permiso.diasAnuales, codigo),
    visible: permiso.visible !== false,
    requiereSaldo: permisoRequiereSaldo(permiso),
    sumaDiaTrabajo: permisoSumaDiaTrabajo(permiso),
  }
}

export async function getTiposPermiso(): Promise<PermisoConfig[]> {
  const firestore = await requireDb()
  const snapshot = await getDocs(collection(firestore, COLECCION_TIPOS_PERMISO))
  const permisos: PermisoConfig[] = []
  for (const documento of snapshot.docs) {
    const permiso = permisoDesdeFirestore(documento.id, documento.data())
    if (permiso) permisos.push(permiso)
  }
  return permisos.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  )
}

export async function saveTipoPermiso(
  permiso: PermisoConfig,
): Promise<PermisoConfig> {
  const firestore = await requireDb()
  const payload = permisoParaFirestore(permiso)
  await conTiempoLimite(
    setDoc(doc(firestore, COLECCION_TIPOS_PERMISO, payload.codigo), payload, {
      merge: true,
    }),
  )
  return payload
}

export async function deleteTipoPermiso(codigo: string): Promise<void> {
  const firestore = await requireDb()
  const id = codigo.trim().toUpperCase()
  if (!id) throw new Error('Código de permiso vacío')
  await conTiempoLimite(
    deleteDoc(doc(firestore, COLECCION_TIPOS_PERMISO, id)),
  )
}

export async function seedTiposPermisoSiVacios(
  permisos: PermisoConfig[] = PERMISOS_INICIALES,
): Promise<PermisoConfig[]> {
  const existentes = await getTiposPermiso()
  const porCodigo = new Map(existentes.map((permiso) => [permiso.codigo, permiso]))
  const faltantes = permisos.filter((permiso) => !porCodigo.has(permiso.codigo))
  const aParchear = existentes.filter((existente) => {
    const inicial = permisos.find((item) => item.codigo === existente.codigo)
    if (!inicial) return existente.diasAnuales == null
    return existente.diasAnuales == null && inicial.diasAnuales != null
  })
  if (faltantes.length === 0 && aParchear.length === 0) return existentes

  const firestore = await requireDb()
  const batch = writeBatch(firestore)
  const listaFaltantes = faltantes.map(permisoParaFirestore)
  for (const permiso of listaFaltantes) {
    batch.set(
      doc(firestore, COLECCION_TIPOS_PERMISO, permiso.codigo),
      permiso,
      { merge: true },
    )
  }
  const parcheados = aParchear.map((existente) => {
    const inicial = permisos.find((item) => item.codigo === existente.codigo)
    return permisoParaFirestore({
      ...existente,
      diasAnuales: inicial?.diasAnuales ?? existente.diasAnuales ?? 0,
    })
  })
  for (const permiso of parcheados) {
    batch.set(
      doc(firestore, COLECCION_TIPOS_PERMISO, permiso.codigo),
      permiso,
      { merge: true },
    )
  }
  await conTiempoLimite(batch.commit())
  const porCodigoFinal = new Map(
    [...existentes, ...listaFaltantes, ...parcheados].map((permiso) => [
      permiso.codigo,
      permiso,
    ]),
  )
  return [...porCodigoFinal.values()].sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  )
}

function tipoEventoDesdeFirestore(
  docId: string,
  data: Record<string, unknown>,
): TipoEventoConfig | null {
  const codigo =
    typeof data.codigo === 'string' && data.codigo.trim()
      ? data.codigo.trim().toUpperCase()
      : docId.trim().toUpperCase()
  const nombre = typeof data.nombre === 'string' ? data.nombre.trim() : ''
  const abreviatura =
    typeof data.abreviatura === 'string'
      ? data.abreviatura.trim().toUpperCase()
      : ''
  if (!esCodigoTipoEvento(codigo) || !nombre || !abreviatura) return null
  const estiloId =
    typeof data.estiloId === 'string' &&
    ESTILOS_TIPO_EVENTO.some((item) => item.id === data.estiloId)
      ? data.estiloId
      : 'slate'
  const ordenRaw = data.orden
  const orden =
    typeof ordenRaw === 'number' && Number.isFinite(ordenRaw)
      ? Math.min(999, Math.max(0, Math.round(ordenRaw)))
      : 0
  const inicial = TIPOS_EVENTO_INICIALES.find((item) => item.codigo === codigo)
  return {
    codigo,
    nombre,
    abreviatura,
    estiloId,
    esFestivo:
      typeof data.esFestivo === 'boolean'
        ? data.esFestivo
        : codigo === 'FESTIVO',
    visible: data.visible !== false,
    orden,
    sistema: data.sistema === true || inicial?.sistema === true,
  }
}

function tipoEventoParaFirestore(tipo: TipoEventoConfig): TipoEventoConfig {
  const codigo = tipo.codigo.trim().toUpperCase()
  const nombre = tipo.nombre.trim()
  const abreviatura = tipo.abreviatura.trim().toUpperCase()
  if (!esCodigoTipoEvento(codigo)) {
    throw new Error('El código del tipo de evento no es válido')
  }
  if (!nombre) throw new Error('El nombre del tipo de evento es obligatorio')
  if (!abreviatura) {
    throw new Error('La abreviatura del tipo de evento es obligatoria')
  }
  const estiloId = ESTILOS_TIPO_EVENTO.some((item) => item.id === tipo.estiloId)
    ? tipo.estiloId
    : 'slate'
  return {
    codigo,
    nombre,
    abreviatura,
    estiloId,
    esFestivo: tipo.esFestivo === true,
    visible: tipo.visible !== false,
    orden: Math.min(999, Math.max(0, Math.round(tipo.orden || 0))),
    sistema: tipoEventoEsSistema(tipo),
  }
}

export async function getTiposEventoDb(): Promise<TipoEventoConfig[]> {
  const firestore = await requireDb()
  const snapshot = await getDocs(collection(firestore, COLECCION_TIPOS_EVENTO))
  const tipos: TipoEventoConfig[] = []
  for (const documento of snapshot.docs) {
    const tipo = tipoEventoDesdeFirestore(documento.id, documento.data())
    if (tipo) tipos.push(tipo)
  }
  return ordenarTiposEvento(tipos)
}

export async function saveTipoEvento(
  tipo: TipoEventoConfig,
): Promise<TipoEventoConfig> {
  const firestore = await requireDb()
  const payload = tipoEventoParaFirestore(tipo)
  await conTiempoLimite(
    setDoc(doc(firestore, COLECCION_TIPOS_EVENTO, payload.codigo), payload, {
      merge: true,
    }),
  )
  return payload
}

export async function deleteTipoEvento(codigo: string): Promise<void> {
  const firestore = await requireDb()
  const id = codigo.trim().toUpperCase()
  if (!id) throw new Error('Código de tipo de evento vacío')
  const inicial = TIPOS_EVENTO_INICIALES.find((item) => item.codigo === id)
  if (inicial && tipoEventoEsSistema(inicial)) {
    throw new Error('Este tipo de evento no se puede eliminar')
  }
  await conTiempoLimite(
    deleteDoc(doc(firestore, COLECCION_TIPOS_EVENTO, id)),
  )
}

export async function seedTiposEventoSiVacios(
  tipos: TipoEventoConfig[] = TIPOS_EVENTO_INICIALES,
): Promise<TipoEventoConfig[]> {
  const existentes = await getTiposEventoDb()
  const porCodigo = new Map(existentes.map((tipo) => [tipo.codigo, tipo]))
  const faltantes = tipos.filter((tipo) => !porCodigo.has(tipo.codigo))
  if (faltantes.length === 0) return ordenarTiposEvento(existentes)

  const firestore = await requireDb()
  const batch = writeBatch(firestore)
  const listaFaltantes = faltantes.map(tipoEventoParaFirestore)
  for (const tipo of listaFaltantes) {
    batch.set(
      doc(firestore, COLECCION_TIPOS_EVENTO, tipo.codigo),
      tipo,
      { merge: true },
    )
  }
  await conTiempoLimite(batch.commit())
  return ordenarTiposEvento([...existentes, ...listaFaltantes])
}

/** Firestore guarda mínimos indexados por código de puesto. */
function minimosSemanaAFirestore(
  semana: MinimosSemana,
  puestos: PuestoConfig[],
): Record<string, Record<string, MinimosPuesto>> {
  const dias: Record<string, Record<string, MinimosPuesto>> = {}
  for (const dia of DIAS_SEMANA) {
    const porCodigo: Record<string, MinimosPuesto> = {}
    for (const puesto of puestos) {
      porCodigo[puesto.codigo] = clonarMinimosPuesto(
        semana[dia][puesto.nombre] ?? { M: 0, T: 0, N: 0 },
      )
    }
    dias[String(dia)] = porCodigo
  }
  return dias
}

function minimosSemanaDesdeFirestore(
  data: Record<string, unknown>,
  puestos: PuestoConfig[],
): MinimosSemana {
  const base = crearMinimosSemana(puestos)
  const diasRaw =
    data.dias && typeof data.dias === 'object'
      ? (data.dias as Record<string, unknown>)
      : data

  for (const dia of DIAS_SEMANA) {
    const diaRaw = diasRaw[String(dia)]
    if (!diaRaw || typeof diaRaw !== 'object') continue
    const porCodigo = diaRaw as Record<string, unknown>
    const diaMin: MinimosDia = { ...base[dia] }
    for (const puesto of puestos) {
      const leido =
        leerMinimosPuesto(porCodigo[puesto.codigo]) ??
        leerMinimosPuesto(porCodigo[puesto.nombre])
      if (leido) diaMin[puesto.nombre] = leido
    }
    base[dia] = diaMin
  }
  return base
}

export async function getMinimosSemana(
  puestos: PuestoConfig[],
): Promise<MinimosSemana | null> {
  const firestore = await requireDb()
  const snapshot = await getDoc(
    doc(firestore, COLECCION_CONFIG, DOC_MINIMOS_SEMANA),
  )
  if (!snapshot.exists()) return null
  return minimosSemanaDesdeFirestore(snapshot.data(), puestos)
}

export async function saveMinimosSemana(
  semana: MinimosSemana,
  puestos: PuestoConfig[],
): Promise<MinimosSemana> {
  const firestore = await requireDb()
  const dias = minimosSemanaAFirestore(semana, puestos)
  await conTiempoLimite(
    setDoc(
      doc(firestore, COLECCION_CONFIG, DOC_MINIMOS_SEMANA),
      {
        dias,
        actualizadoEn: new Date().toISOString(),
      },
      { merge: true },
    ),
  )
  return semana
}

export async function seedMinimosSiVacios(
  puestos: PuestoConfig[],
): Promise<MinimosSemana> {
  const existentes = await getMinimosSemana(puestos)
  if (existentes) return existentes
  const semana = crearMinimosSemana(puestos)
  await saveMinimosSemana(semana, puestos)
  return semana
}

/** Lectura sin sembrar. La consulta no puede escribir puestos, mínimos ni tipos. */
export async function cargarConfigOperativaSoloLectura(): Promise<{
  puestos: PuestoConfig[]
  minimosSemana: MinimosSemana
  eventos: EventoOperativo[]
  tiposPermiso: PermisoConfig[]
  tiposEvento: TipoEventoConfig[]
}> {
  const [puestos, tiposPermiso, tiposEvento] = await Promise.all([
    getPuestos(),
    getTiposPermiso(),
    getTiposEventoDb(),
  ])
  const [minimosSemana, eventos] = await Promise.all([
    getMinimosSemana(puestos),
    getEventos(),
  ])
  return {
    puestos,
    minimosSemana: minimosSemana ?? crearMinimosSemana(puestos),
    eventos,
    tiposPermiso,
    tiposEvento,
  }
}

/** Carga puestos + mínimos + eventos + tipos de permiso; siembra si vacíos. */
export async function cargarConfigOperativa(): Promise<{
  puestos: PuestoConfig[]
  minimosSemana: MinimosSemana
  eventos: EventoOperativo[]
  tiposPermiso: PermisoConfig[]
  tiposEvento: TipoEventoConfig[]
}> {
  const [puestos, tiposPermiso, tiposEvento] = await Promise.all([
    seedPuestosSiVacios(),
    seedTiposPermisoSiVacios(),
    seedTiposEventoSiVacios(),
  ])
  const [minimosSemana, eventos] = await Promise.all([
    seedMinimosSiVacios(puestos),
    getEventos(),
  ])
  return { puestos, minimosSemana, eventos, tiposPermiso, tiposEvento }
}

const TIPOS_SOLICITUD = new Set<TipoSolicitud>([
  'PERMISO',
  'CAMBIO_DIA',
  'CAMBIO_MES',
  'VACACIONES',
])

const ESTADOS_SOLICITUD = new Set<EstadoSolicitud>([
  'PENDIENTE',
  'ACEPTADA',
  'RECHAZADA',
])

function texto(valor: unknown) {
  return typeof valor === 'string' ? valor.trim() : ''
}

function solicitudDesdeFirestore(
  id: string,
  data: Record<string, unknown>,
): Solicitud | null {
  const tipo = data.tipo
  const estado = data.estado
  const agenteId = texto(data.agenteId)
  const fecha = texto(data.fecha)
  const creadaEn = texto(data.creadaEn)
  if (!TIPOS_SOLICITUD.has(tipo as TipoSolicitud)) return null
  if (!ESTADOS_SOLICITUD.has(estado as EstadoSolicitud)) return null
  if (!agenteId || !esFechaIso(fecha) || !creadaEn) return null
  const solicitud: Solicitud = {
    id,
    tipo: tipo as TipoSolicitud,
    estado: estado as EstadoSolicitud,
    agenteId,
    placa: texto(data.placa),
    nombreAgente: texto(data.nombreAgente),
    fecha,
    creadaEn,
  }
  const fechaFin = texto(data.fechaFin)
  const mesDestino = texto(data.mesDestino)
  const detalle = texto(data.detalle)
  const permisoCodigo = texto(data.permisoCodigo)
  const permisoNombre = texto(data.permisoNombre)
  const resueltaEn = texto(data.resueltaEn)
  const cobertura = texto(data.cobertura)
  const coberturaNombre = texto(data.coberturaNombre)
  const companeroId = texto(data.companeroId)
  const companeroNombre = texto(data.companeroNombre)
  const turno = texto(data.turno)
  const turnoDestino = texto(data.turnoDestino)
  const motivoRechazo = texto(data.motivoRechazo)
  const validacion = texto(data.validacionCompanero)
  if (fechaFin) solicitud.fechaFin = fechaFin
  if (mesDestino) solicitud.mesDestino = mesDestino
  if (detalle) solicitud.detalle = detalle
  if (permisoCodigo) solicitud.permisoCodigo = permisoCodigo
  if (permisoNombre) solicitud.permisoNombre = permisoNombre
  if (resueltaEn) solicitud.resueltaEn = resueltaEn
  if (cobertura) solicitud.cobertura = cobertura
  if (coberturaNombre) solicitud.coberturaNombre = coberturaNombre
  if (companeroId) solicitud.companeroId = companeroId
  if (companeroNombre) solicitud.companeroNombre = companeroNombre
  if (turno) solicitud.turno = turno
  if (turnoDestino) solicitud.turnoDestino = turnoDestino
  if (motivoRechazo) solicitud.motivoRechazo = motivoRechazo
  if (validacion === 'PENDIENTE' || validacion === 'VALIDADA' || validacion === 'RECHAZADA') {
    solicitud.validacionCompanero = validacion
  }
  return solicitud
}

function solicitudesDe(snapshot: { docs: Array<{ id: string; data: () => Record<string, unknown> }> }) {
  const lista: Solicitud[] = []
  for (const documento of snapshot.docs) {
    const solicitud = solicitudDesdeFirestore(documento.id, documento.data())
    if (solicitud) lista.push(solicitud)
  }
  return lista
}

export async function listarSolicitudes(agenteId?: string): Promise<Solicitud[]> {
  const firestore = await requireDb()
  const base = collection(firestore, COLECCION_SOLICITUDES)
  if (!agenteId) {
    return ordenarSolicitudes(solicitudesDe(await getDocs(base)))
  }
  const [propias, comoCompanero] = await Promise.all([
    getDocs(query(base, where('agenteId', '==', agenteId))),
    getDocs(query(base, where('companeroId', '==', agenteId))),
  ])
  const porId = new Map<string, Solicitud>()
  for (const solicitud of [...solicitudesDe(propias), ...solicitudesDe(comoCompanero)]) {
    porId.set(solicitud.id, solicitud)
  }
  return ordenarSolicitudes([...porId.values()])
}

export async function guardarSolicitud(solicitud: Solicitud): Promise<Solicitud> {
  const firestore = await requireDb()
  const id = solicitud.id.trim()
  if (!id) throw new Error('La solicitud no tiene identificador')
  const payload = solicitudDesdeFirestore(id, { ...solicitud })
  if (!payload) throw new Error('La solicitud no es válida')
  await conTiempoLimite(
    setDoc(doc(firestore, COLECCION_SOLICITUDES, id), payload, { merge: true }),
  )
  return payload
}

export type { CuadranteMensualFirestore } from '@/lib/cuadranteFirestore'
