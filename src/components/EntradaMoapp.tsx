import { useEffect, useState } from 'react'

const claveEntrada = 'moapp-entrada'
const palabra = ['M', 'ō', 'a', 'P', 'P'] as const
const frase = ['Cuadrantes', 'y', 'personal', 'de', 'la', 'Policía', 'Portuaria'] as const
const duracionMs = 5200
const duracionReducidaMs = 1600
const fundidoMs = 560
const fundidoReducidoMs = 280

function yaVista() {
  try {
    return sessionStorage.getItem(claveEntrada) === '1'
  } catch {
    return false
  }
}

function marcarVista() {
  try {
    sessionStorage.setItem(claveEntrada, '1')
  } catch {
    /* el modo privado puede bloquear el almacenamiento */
  }
}

function prefiereReducir() {
  return window.matchMedia('(prefers-reduced-motion: reduce)').matches
}

export function EntradaMoapp() {
  const [visible, setVisible] = useState(() => !yaVista())
  const [sale, setSale] = useState(false)

  useEffect(() => {
    if (!visible || sale) return
    const espera = window.setTimeout(() => setSale(true), prefiereReducir() ? duracionReducidaMs : duracionMs)
    return () => window.clearTimeout(espera)
  }, [visible, sale])

  useEffect(() => {
    if (!sale) return
    marcarVista()
    const fin = window.setTimeout(() => setVisible(false), prefiereReducir() ? fundidoReducidoMs : fundidoMs)
    return () => window.clearTimeout(fin)
  }, [sale])

  if (!visible) return null

  return (
    <div className={`moapp-entrada${sale ? ' is-salida' : ''}`}>
      <div className="moapp-entrada-escena">
        <div className="moapp-entrada-marca">
          <span className="moapp-entrada-halo" aria-hidden="true" />
          <span className="moapp-entrada-halo is-tarde" aria-hidden="true" />
          <span className="moapp-entrada-aliento" aria-hidden="true" />
          <svg className="moapp-entrada-cometa" viewBox="0 0 100 100" aria-hidden="true">
            <circle cx="50" cy="50" r="46" pathLength="1" />
          </svg>
          <button type="button" className="moapp-entrada-logo" onClick={() => setSale(true)} aria-label="Saltar la intro">
            <img src="/moapp-mark.png" alt="" />
          </button>
        </div>
        <h1 className="moapp-entrada-nombre">
          {palabra.map((letra, indice) => (
            <span key={`${letra}-${indice}`} className="moapp-entrada-letra" style={{ animationDelay: `${0.95 + indice * 0.09}s` }}>
              {letra}
            </span>
          ))}
        </h1>
        <span className="moapp-entrada-linea" aria-hidden="true" />
        <p className="moapp-entrada-frase">
          {frase.map((trozo, indice) => (
            <span key={trozo} className="moapp-entrada-palabra" style={{ animationDelay: `${1.95 + indice * 0.06}s` }}>
              {trozo}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
