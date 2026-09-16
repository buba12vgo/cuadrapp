function configured() {
  return Boolean(process.env.STITCH_API_KEY?.trim())
}

export default function handler(req, res) {
  res.setHeader('Cache-Control', 'no-store')
  if (req.method !== 'GET') {
    res.status(405).json({ ok: false, error: 'method_not_allowed' })
    return
  }

  res.status(200).json({
    ok: true,
    configured: configured(),
    designSystem: 'Puerto',
    note: configured()
      ? 'STITCH_API_KEY presente en el servidor. Ejecuta npm run stitch:sync en local para generar pantallas.'
      : 'Añade STITCH_API_KEY en el entorno del servidor (nunca VITE_) para sincronizar con Google Stitch.',
  })
}
