import { createContext, useContext, useState, type ReactNode } from 'react'
import { MESES } from '@/lib/fechas'

type MovilMesValor = {
  anio: number
  mes: number
  nombreMes: string
  cambiarMes: (delta: number) => void
}

const MovilMesContext = createContext<MovilMesValor | null>(null)

export function MovilMesProvider({ children }: { children: ReactNode }) {
  const hoy = new Date()
  const [anio, setAnio] = useState(hoy.getFullYear())
  const [mes, setMes] = useState(hoy.getMonth() + 1)

  function cambiarMes(delta: number) {
    const fecha = new Date(anio, mes - 1 + delta, 1)
    setAnio(fecha.getFullYear())
    setMes(fecha.getMonth() + 1)
  }

  return (
    <MovilMesContext.Provider
      value={{ anio, mes, nombreMes: MESES[mes - 1] ?? '', cambiarMes }}
    >
      {children}
    </MovilMesContext.Provider>
  )
}

export function useMovilMes() {
  const valor = useContext(MovilMesContext)
  if (!valor) throw new Error('useMovilMes fuera del móvil')
  return valor
}

export { isoFecha as isoFechaMovil } from '@/lib/fechas'

const DIAS = ['Domingo', 'Lunes', 'Martes', 'Miércoles', 'Jueves', 'Viernes', 'Sábado'] as const
const DIAS_CORTOS = ['D', 'L', 'M', 'X', 'J', 'V', 'S'] as const

export function etiquetaDia(anio: number, mes: number, dia: number) {
  const fecha = new Date(anio, mes - 1, dia)
  return {
    largo: DIAS[fecha.getDay()] ?? '',
    corto: DIAS_CORTOS[fecha.getDay()] ?? '',
  }
}
