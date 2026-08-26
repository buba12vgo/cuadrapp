export type FirebaseStatus = {
  configured: boolean
  present: Record<string, boolean>
  note: string
}

export async function fetchFirebaseStatus(): Promise<FirebaseStatus | null> {
  try {
    const res = await fetch('/api/firebase-status', { cache: 'no-store' })
    return (await res.json()) as FirebaseStatus
  } catch {
    return null
  }
}

export function formatFirebaseStatus(status: FirebaseStatus): string {
  const vacias = Object.entries(status.present)
    .filter(([, ok]) => !ok)
    .map(([key]) => key.replace('VITE_FIREBASE_', ''))

  if (vacias.length === 0) {
    return `${status.note} (build sin claves: redespliega sin cache).`
  }

  return `En este deploy Vercel tiene vacías: ${vacias.join(', ')}. ${status.note}`
}
