import { useEffect, useState } from 'react'

const claveEntrada = 'moapp-entrada'
const palabra = ['M', 'o', 'a', 'P', 'P'] as const
const frase = ['Cuadrantes', 'y', 'personal', 'de', 'la', 'Policía', 'Portuaria'] as const
const duracionMs = 5200
const duracionReducidaMs = 1600
const fundidoMs = 560
const fundidoReducidoMs = 280
const trazos = ['M14 23.5h36', 'M14 32h36', 'M14 40.5h36', 'M25 15v34', 'M39 15v34'] as const

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
            <svg viewBox="0 0 64 64" aria-hidden="true">
              <rect className="moapp-placa" width="64" height="64" rx="16" />
              <g className="moapp-rejilla" fill="none" stroke="#E8F1F6" strokeWidth="2.2" strokeLinecap="round">
                {trazos.map((d, indice) => (
                  <path key={d} d={d} pathLength="1" style={{ animationDelay: `${0.42 + indice * 0.12}s` }} />
                ))}
              </g>
              <rect className="moapp-celda" x="25.6" y="32.7" width="12.8" height="7" rx="1.2" />
            </svg>
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
              {trozo}{' '}
            </span>
          ))}
        </p>
      </div>
    </div>
  )
}
