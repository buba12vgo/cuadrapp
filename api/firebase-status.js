const KEYS = [
  'VITE_FIREBASE_API_KEY',
  'VITE_FIREBASE_AUTH_DOMAIN',
  'VITE_FIREBASE_PROJECT_ID',
  'VITE_FIREBASE_STORAGE_BUCKET',
  'VITE_FIREBASE_MESSAGING_SENDER_ID',
  'VITE_FIREBASE_APP_ID',
]

export default function handler(req, res) {
  const present = Object.fromEntries(
    KEYS.map((key) => [key, Boolean(process.env[key]?.trim())]),
  )
  const configured = KEYS.every((key) => present[key])

  res.setHeader('Cache-Control', 'no-store')
  res.status(configured ? 200 : 503).json({
    configured,
    present,
    note: configured
      ? 'Env OK en runtime. Si la UI sigue fallando, redespliega sin build cache.'
      : 'Variables ausentes o vacías en este deployment. Edita cada VITE_FIREBASE_* en Vercel y pega el valor desde Firebase Console (debe empezar por AIza… la API key).',
  })
}
