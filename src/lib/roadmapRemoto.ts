import { doc, getDoc, setDoc } from 'firebase/firestore'
import { ensureFirebase, getDb } from '@/lib/firebase'

const COLECCION = 'roadmap'
const DOCUMENTO = 'tablero'

/** null si no hay Firebase o el documento aún no existe. */
export async function leerRoadmapRemoto(): Promise<unknown[] | null> {
  const listo = await ensureFirebase()
  const db = getDb()
  if (!listo || !db) return null
  const snapshot = await getDoc(doc(db, COLECCION, DOCUMENTO))
  if (!snapshot.exists()) return null
  const tareas = snapshot.data().tareas
  return Array.isArray(tareas) ? tareas : null
}

export async function guardarRoadmapRemoto(tareas: unknown[]) {
  const listo = await ensureFirebase()
  const db = getDb()
  if (!listo || !db) return
  await setDoc(doc(db, COLECCION, DOCUMENTO), {
    tareas,
    actualizadoEn: new Date().toISOString(),
  })
}
