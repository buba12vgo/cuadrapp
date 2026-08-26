import { collection, doc, getDoc, getDocs, setDoc } from 'firebase/firestore'
import { ensureFirebase, getDb } from '@/lib/firebase'
import {
  idDocumentoCuadrante,
  parseCuadranteFirestore,
  type CuadranteMensualFirestore,
} from '@/lib/cuadranteFirestore'
import type {
  FichaPolicia,
  Limitaciones,
  PreferenciaAnual,
  RolPolicia,
} from '@/types'

const COLECCION_AGENTES = 'agentes'
const COLECCION_CUADRANTES = 'cuadrantes'

const ROLES: RolPolicia[] = [
  'RESPONSABLE',
  'JEFE_SERVICIO',
  'JEFE_EQUIPO',
  'POLICIA',
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

function conTiempoLimite<T>(promesa: Promise<T>): Promise<T> {
  return new Promise((resolve, reject) => {
    const id = setTimeout(() => {
      reject(
        new Error(
          'Firestore no confirmó la escritura a tiempo. El dato puede haberse guardado; recarga la página si no lo ves.',
        ),
      )
    }, TIEMPO_ESCRITURA_MS)
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

export type { CuadranteMensualFirestore } from '@/lib/cuadranteFirestore'
