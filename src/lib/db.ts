import {
  collection,
  deleteDoc,
  doc,
  getDoc,
  getDocs,
  setDoc,
  writeBatch,
} from 'firebase/firestore'
import { ensureFirebase, getDb } from '@/lib/firebase'
import {
  PUESTOS_INICIALES,
  clonarMinimosPuesto,
  crearMinimosSemana,
  type DiaSemana,
  type MinimosDia,
  type MinimosPuesto,
  type MinimosSemana,
  type PuestoConfig,
} from '@/lib/calendarioPuestos'
import {
  idDocumentoCuadrante,
  parseCuadranteFirestore,
  type CuadranteMensualFirestore,
} from '@/lib/cuadranteFirestore'
import type {
  EventoOperativo,
  FichaPolicia,
  Limitaciones,
  PreferenciaAnual,
  RolPolicia,
  TipoEvento,
} from '@/types'

const COLECCION_AGENTES = 'agentes'
const COLECCION_CUADRANTES = 'cuadrantes'
const COLECCION_EVENTOS = 'eventos'
const COLECCION_PUESTOS = 'puestos'
const COLECCION_CONFIG = 'config'
const DOC_MINIMOS_SEMANA = 'minimosSemana'

const TIPOS_EVENTO: TipoEvento[] = [
  'FESTIVO',
  'CRUCERO',
  'CONCIERTO',
  'OPERATIVA_ESPECIAL',
]
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
  'AGOSTO',
  'SEPTIEMBRE',
]

const LIMITACIONES_DEFECTO: Limitaciones = {
  soloManana: false,
  soloMananaNoche: false,
  exentoNoches: false,
}

const PREFERENCIA_DEFECTO: PreferenciaAnual = {
  objetivoM: 4,
  objetivoT: 4,
  objetivoN: 3,
}

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

function leerLimitaciones(valor: unknown): Limitaciones {
  if (!valor || typeof valor !== 'object') return { ...LIMITACIONES_DEFECTO }
  const raw = valor as Record<string, unknown>
  return {
    soloManana: raw.soloManana === true,
    soloMananaNoche: raw.soloMananaNoche === true,
    exentoNoches: raw.exentoNoches === true,
  }
}

function leerPreferencia(valor: unknown): PreferenciaAnual {
  if (!valor || typeof valor !== 'object') return { ...PREFERENCIA_DEFECTO }
  const raw = valor as Record<string, unknown>
  const leerMes = (n: unknown, defecto: number) => {
    if (typeof n !== 'number' || !Number.isFinite(n)) return defecto
    return Math.min(12, Math.max(0, Math.round(n)))
  }
  return {
    objetivoM: leerMes(raw.objetivoM, PREFERENCIA_DEFECTO.objetivoM),
    objetivoT: leerMes(raw.objetivoT, PREFERENCIA_DEFECTO.objetivoT),
    objetivoN: leerMes(raw.objetivoN, PREFERENCIA_DEFECTO.objetivoN),
  }
}

function leerPuestosExcluidos(valor: unknown): string[] {
  if (!Array.isArray(valor)) return []
  return valor.filter((item): item is string => typeof item === 'string')
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
  }
}

function agenteParaFirestore(agente: FichaPolicia): FichaPolicia {
  const numeroPlaca = agente.numeroPlaca.trim()
  if (!numeroPlaca) {
    throw new Error('El número de placa es obligatorio')
  }

  const docId = agente.id.trim() || numeroPlaca

  return {
    id: docId,
    numeroPlaca,
    nombre: agente.nombre.trim(),
    apellidos: agente.apellidos.trim(),
    rolBase: agente.rolBase,
    limitaciones: { ...agente.limitaciones },
    preferenciaAnual: { ...agente.preferenciaAnual },
    puestosExcluidos: [...agente.puestosExcluidos],
    mesAnclaVacaciones: agente.mesAnclaVacaciones,
  }
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

export async function getCuadrante(
  mes: number,
  anio: number,
): Promise<CuadranteMensualFirestore | null> {
  const firestore = await requireDb()
  const docId = idDocumentoCuadrante(anio, mes)
  const snapshot = await getDoc(doc(firestore, COLECCION_CUADRANTES, docId))
  if (!snapshot.exists()) return null
  return parseCuadranteFirestore(snapshot.data())
}

export async function saveCuadrante(
  mes: number,
  anio: number,
  datosCuadrante: CuadranteMensualFirestore,
): Promise<void> {
  const firestore = await requireDb()
  const docId = idDocumentoCuadrante(anio, mes)
  await conTiempoLimite(
    setDoc(
      doc(firestore, COLECCION_CUADRANTES, docId),
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

function esTipoEvento(valor: unknown): valor is TipoEvento {
  return typeof valor === 'string' && TIPOS_EVENTO.includes(valor as TipoEvento)
}

function eventoDesdeFirestore(
  docId: string,
  data: Record<string, unknown>,
): EventoOperativo | null {
  const fecha =
    typeof data.fecha === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(data.fecha)
      ? data.fecha
      : null
  if (!fecha || !esTipoEvento(data.tipo)) return null

  return {
    id:
      typeof data.id === 'string' && data.id.trim()
        ? data.id.trim()
        : docId || `ev-${fecha}`,
    fecha,
    tipo: data.tipo,
    descripcion:
      typeof data.descripcion === 'string' ? data.descripcion.trim() : '',
    modificadoresMinimos: leerModificadoresMinimos(data.modificadoresMinimos),
  }
}

function eventoParaFirestore(evento: EventoOperativo): EventoOperativo {
  const fecha = evento.fecha.trim()
  if (!/^\d{4}-\d{2}-\d{2}$/.test(fecha)) {
    throw new Error('La fecha del evento no es válida')
  }
  const id = evento.id.trim() || `ev-${fecha}`
  const modificadoresMinimos: EventoOperativo['modificadoresMinimos'] = {}
  for (const [puesto, turnos] of Object.entries(evento.modificadoresMinimos)) {
    modificadoresMinimos[puesto] = clonarMinimosPuesto(turnos)
  }
  return {
    id,
    fecha,
    tipo: evento.tipo,
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
  return { codigo, nombre, abreviatura }
}

function puestoParaFirestore(puesto: PuestoConfig): PuestoConfig {
  const codigo = puesto.codigo.trim().toUpperCase()
  const nombre = puesto.nombre.trim()
  const abreviatura = puesto.abreviatura.trim().toUpperCase()
  if (!codigo) throw new Error('El código del puesto es obligatorio')
  if (!nombre) throw new Error('El nombre del puesto es obligatorio')
  if (!abreviatura) throw new Error('La abreviatura del puesto es obligatoria')
  return { codigo, nombre, abreviatura }
}

export async function getPuestos(): Promise<PuestoConfig[]> {
  const firestore = await requireDb()
  const snapshot = await getDocs(collection(firestore, COLECCION_PUESTOS))
  const puestos: PuestoConfig[] = []
  for (const documento of snapshot.docs) {
    const puesto = puestoDesdeFirestore(documento.id, documento.data())
    if (puesto) puestos.push(puesto)
  }
  return puestos.sort((a, b) =>
    a.nombre.localeCompare(b.nombre, 'es', { sensitivity: 'base' }),
  )
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

/** Carga puestos + mínimos + eventos; siembra puestos/mínimos si están vacíos. */
export async function cargarConfigOperativa(): Promise<{
  puestos: PuestoConfig[]
  minimosSemana: MinimosSemana
  eventos: EventoOperativo[]
}> {
  const puestos = await seedPuestosSiVacios()
  const [minimosSemana, eventos] = await Promise.all([
    seedMinimosSiVacios(puestos),
    getEventos(),
  ])
  return { puestos, minimosSemana, eventos }
}

export type { CuadranteMensualFirestore } from '@/lib/cuadranteFirestore'
