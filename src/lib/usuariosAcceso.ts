import { deleteApp, initializeApp, type FirebaseOptions } from 'firebase/app'
import {
  createUserWithEmailAndPassword,
  getAuth,
  signOut,
} from 'firebase/auth'
import {
  collection,
  doc,
  getDoc,
  getDocs,
  setDoc,
  updateDoc,
} from 'firebase/firestore'
import { normalizarEmail, type RolAcceso } from '@/lib/acceso'
import { getDb, getFirebaseApp } from '@/lib/firebase'

export type UsuarioAccesoDoc = {
  uid: string
  email: string
  rolAcceso: Extract<RolAcceso, 'CONSULTA_JEFES'>
  numeroPlaca: string
  agenteId: string
  nombre: string
  activo: boolean
  creadoEn: string
  puedeEditarEventos?: boolean
}

const COLECCION = 'usuarios'

const locales: UsuarioAccesoDoc[] = []

export function consultaPreviewPuedeEventos() {
  return locales.some((item) => item.puedeEditarEventos === true)
}

export function sembrarUsuarioPreview(usuario: UsuarioAccesoDoc) {
  const idx = locales.findIndex((item) => item.uid === usuario.uid)
  if (idx >= 0) return
  locales.push(usuario)
}

export function mensajeErrorAuth(error: unknown) {
  const code =
    error && typeof error === 'object' && 'code' in error
      ? String((error as { code: string }).code)
      : ''
  if (code === 'auth/email-already-in-use') {
    return 'Ese correo ya tiene una cuenta. Si es un jefe, entra con él o restablece la contraseña.'
  }
  if (code === 'auth/invalid-email') return 'El correo no es válido.'
  if (code === 'auth/weak-password' || code === 'auth/password-does-not-meet-requirements') {
    return 'La contraseña es demasiado corta. Usa al menos 8 caracteres.'
  }
  if (code === 'auth/invalid-credential' || code === 'auth/wrong-password' || code === 'auth/user-not-found') {
    return 'Correo o contraseña incorrectos.'
  }
  if (code === 'auth/too-many-requests') {
    return 'Demasiados intentos. Espera un momento y vuelve a probar.'
  }
  if (code === 'auth/operation-not-allowed' || code === 'auth/configuration-not-found') {
    return 'En Firebase Authentication hay que activar el proveedor Correo/contraseña.'
  }
  if (code === 'auth/requires-recent-login') {
    return 'Por seguridad, vuelve a entrar y cambia la contraseña enseguida.'
  }
  if (error instanceof Error && error.message) return error.message
  return 'No se pudo completar la operación.'
}

export async function leerUsuarioAcceso(uid: string): Promise<UsuarioAccesoDoc | null> {
  const local = locales.find((item) => item.uid === uid)
  if (local) return local
  const db = getDb()
  if (!db) return null
  const snap = await getDoc(doc(db, COLECCION, uid))
  if (!snap.exists()) return null
  return usuarioDesde(snap.id, snap.data())
}

export async function listarUsuariosAcceso(): Promise<UsuarioAccesoDoc[]> {
  const db = getDb()
  if (!db) return [...locales]
  const snap = await getDocs(collection(db, COLECCION))
  const remotos = snap.docs
    .map((item) => usuarioDesde(item.id, item.data()))
    .filter((item): item is UsuarioAccesoDoc => item != null)
  return remotos.sort((a, b) => a.nombre.localeCompare(b.nombre, 'es'))
}

export async function crearUsuarioConsulta(input: {
  email: string
  password: string
  numeroPlaca: string
  agenteId: string
  nombre: string
}): Promise<UsuarioAccesoDoc> {
  const email = normalizarEmail(input.email)
  if (!email.includes('@')) throw new Error('Indica un correo válido.')
  if (input.password.length < 8) {
    throw new Error('La contraseña temporal necesita al menos 8 caracteres.')
  }

  const db = getDb()
  const app = getFirebaseApp()
  if (!db || !app) {
    const docLocal: UsuarioAccesoDoc = {
      uid: `local-${input.agenteId}`,
      email,
      rolAcceso: 'CONSULTA_JEFES',
      numeroPlaca: input.numeroPlaca,
      agenteId: input.agenteId,
      nombre: input.nombre,
      activo: true,
      creadoEn: new Date().toISOString(),
    }
    const idx = locales.findIndex((item) => item.agenteId === input.agenteId)
    if (idx >= 0) locales[idx] = docLocal
    else locales.push(docLocal)
    return docLocal
  }

  const secundaria = initializeApp(app.options as FirebaseOptions, `alta-${Date.now()}`)
  const authAlta = getAuth(secundaria)
  try {
    const cred = await createUserWithEmailAndPassword(authAlta, email, input.password)
    const payload: UsuarioAccesoDoc = {
      uid: cred.user.uid,
      email,
      rolAcceso: 'CONSULTA_JEFES',
      numeroPlaca: input.numeroPlaca,
      agenteId: input.agenteId,
      nombre: input.nombre,
      activo: true,
      creadoEn: new Date().toISOString(),
    }
    await setDoc(doc(db, COLECCION, cred.user.uid), payload)
    await signOut(authAlta)
    return payload
  } finally {
    await deleteApp(secundaria)
  }
}

function usuarioDesde(uid: string, data: Record<string, unknown>): UsuarioAccesoDoc | null {
  const email = typeof data.email === 'string' ? normalizarEmail(data.email) : ''
  const nombre = typeof data.nombre === 'string' ? data.nombre.trim() : ''
  const numeroPlaca = typeof data.numeroPlaca === 'string' ? data.numeroPlaca.trim() : ''
  const agenteId = typeof data.agenteId === 'string' ? data.agenteId.trim() : ''
  if (!email || !numeroPlaca || data.rolAcceso !== 'CONSULTA_JEFES') return null
  return {
    uid,
    email,
    rolAcceso: 'CONSULTA_JEFES',
    numeroPlaca,
    agenteId,
    nombre,
    activo: data.activo !== false,
    creadoEn: typeof data.creadoEn === 'string' ? data.creadoEn : '',
    puedeEditarEventos: data.puedeEditarEventos === true,
  }
}

export async function guardarPermisoEventos(uid: string, puede: boolean) {
  const id = uid.trim()
  if (!id) throw new Error('Usuario sin identificador')
  const local = locales.find((item) => item.uid === id)
  if (local) {
    local.puedeEditarEventos = puede
    try {
      sessionStorage.setItem('cuadrapp.preview-eventos', puede ? '1' : '0')
    } catch {
      /* ignore */
    }
  }
  const db = getDb()
  if (!db) {
    if (!local) throw new Error('Ese jefe todavía no tiene usuario.')
    return
  }
  await updateDoc(doc(db, COLECCION, id), { puedeEditarEventos: puede })
}
