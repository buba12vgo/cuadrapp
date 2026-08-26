const KEYS = {
  apiKey: ['VITE_FIREBASE_API_KEY', 'FIREBASE_API_KEY'],
  authDomain: ['VITE_FIREBASE_AUTH_DOMAIN', 'FIREBASE_AUTH_DOMAIN'],
  projectId: ['VITE_FIREBASE_PROJECT_ID', 'FIREBASE_PROJECT_ID'],
  storageBucket: ['VITE_FIREBASE_STORAGE_BUCKET', 'FIREBASE_STORAGE_BUCKET'],
  messagingSenderId: [
    'VITE_FIREBASE_MESSAGING_SENDER_ID',
    'FIREBASE_MESSAGING_SENDER_ID',
  ],
  appId: ['VITE_FIREBASE_APP_ID', 'FIREBASE_APP_ID'],
}

function readEnv(names) {
  for (const name of names) {
    const value = process.env[name]?.trim()
    if (value) return value
  }
  return ''
}

export default function handler(req, res) {
  const config = {
    apiKey: readEnv(KEYS.apiKey),
    authDomain: readEnv(KEYS.authDomain),
    projectId: readEnv(KEYS.projectId),
    storageBucket: readEnv(KEYS.storageBucket),
    messagingSenderId: readEnv(KEYS.messagingSenderId),
    appId: readEnv(KEYS.appId),
  }

  const present = Object.fromEntries(
    Object.entries(config).map(([key, value]) => [key, Boolean(value)]),
  )
  const configured = Boolean(config.apiKey && config.projectId)

  res.setHeader('Cache-Control', 'no-store')

  if (!configured) {
    res.status(503).json({
      ok: false,
      present,
      note: 'Variables Firebase vacías o ausentes en este deployment de Vercel.',
    })
    return
  }

  // Firebase web config is public by design (security lives in Auth/Firestore rules).
  res.status(200).json({ ok: true, config, present })
}
