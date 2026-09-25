export type RolAcceso = 'SUPERADMIN' | 'ADMIN' | 'CONSULTA_JEFES'

export type Ambito =
  | 'agentes'
  | 'puestos'
  | 'permisos'
  | 'permisos-agentes'
  | 'minimos'
  | 'plan-anual'
  | 'cuadrante-mensual'
  | 'cuadrante-jefes'
  | 'calendario-jefes'
  | 'calendario'
  | 'listados'
  | 'reglas'
  | 'usuarios'
  | 'opciones'

export type PerfilAcceso = {
  rol: RolAcceso
  email: string
  uid: string | null
  numeroPlaca: string | null
  nombre: string
  fijo: boolean
  /** Consulta de jefes autorizada a crear eventos del calendario. */
  puedeEditarEventos?: boolean
}

export const ETIQUETA_ROL_ACCESO: Record<RolAcceso, string> = {
  SUPERADMIN: 'Superadmin',
  ADMIN: 'Admin',
  CONSULTA_JEFES: 'Consulta jefes',
}

type CuentaFija = {
  email: string
  rol: RolAcceso
  numeroPlaca: string
  nombre: string
}

/**
 * Cuentas Google fijas. jony.mivi@gmail.com es el alias que ya estaba
 * en producción; jonymivi@gmail.com es el que usa Jonathan.
 */
const CUENTAS_FIJAS: CuentaFija[] = [
  {
    email: 'buba12@gmail.com',
    rol: 'SUPERADMIN',
    numeroPlaca: '102',
    nombre: 'Rubén Francisco Román Durán',
  },
  {
    email: 'jonymivi@gmail.com',
    rol: 'ADMIN',
    numeroPlaca: '108',
    nombre: 'Jonathan Miguez Vila',
  },
  {
    email: 'jony.mivi@gmail.com',
    rol: 'ADMIN',
    numeroPlaca: '108',
    nombre: 'Jonathan Miguez Vila',
  },
]

const RUTA_AMBITO: Record<string, Ambito> = {
  '/admin/agentes': 'agentes',
  '/admin/puestos': 'puestos',
  '/admin/permisos': 'permisos',
  '/admin/permisos-agentes': 'permisos-agentes',
  '/admin/minimos': 'minimos',
  '/admin/plan-anual': 'plan-anual',
  '/admin/cuadrante-mensual': 'cuadrante-mensual',
  '/admin/cuadrante-jefes': 'cuadrante-jefes',
  '/admin/calendario-jefes': 'calendario-jefes',
  '/admin/calendario': 'calendario',
  '/admin/listados': 'listados',
  '/admin/reglas': 'reglas',
  '/admin/usuarios': 'usuarios',
  '/admin/opciones': 'opciones',
}

const ESCRITURA_ADMIN = new Set<Ambito>([
  'agentes',
  'permisos',
  'cuadrante-jefes',
  'calendario-jefes',
  'calendario',
  'usuarios',
])

let rolActivo: RolAcceso | null = null

export function fijarRolAccesoActivo(rol: RolAcceso | null) {
  rolActivo = rol
}

export function escrituraPermitida(ambito: Ambito) {
  if (!rolActivo) return false
  return puedeEscribir(rolActivo, ambito)
}

export function normalizarEmail(email: string) {
  return email.trim().toLowerCase()
}

export function perfilFijo(email: string | null | undefined): PerfilAcceso | null {
  const limpio = normalizarEmail(email ?? '')
  const cuenta = CUENTAS_FIJAS.find((item) => item.email === limpio)
  if (!cuenta) return null
  return {
    rol: cuenta.rol,
    email: cuenta.email,
    uid: null,
    numeroPlaca: cuenta.numeroPlaca,
    nombre: cuenta.nombre,
    fijo: true,
  }
}

export function cuentasFijas() {
  return CUENTAS_FIJAS.filter((cuenta) => cuenta.email !== 'jony.mivi@gmail.com')
}

export function ambitoDeRuta(path: string): Ambito | null {
  if (RUTA_AMBITO[path]) return RUTA_AMBITO[path]
  const prefijo = Object.keys(RUTA_AMBITO).find((ruta) => path.startsWith(`${ruta}/`))
  return prefijo ? RUTA_AMBITO[prefijo]! : null
}

export function puedeVer(
  rol: RolAcceso,
  ambito: Ambito,
  opciones?: { puedeEditarEventos?: boolean },
) {
  if (rol === 'SUPERADMIN') return true
  if (rol === 'ADMIN') return true
  if (ambito === 'calendario' && opciones?.puedeEditarEventos) return true
  return (
    ambito === 'cuadrante-jefes' ||
    ambito === 'calendario-jefes' ||
    ambito === 'permisos-agentes' ||
    ambito === 'opciones'
  )
}

export function puedeEscribir(
  rol: RolAcceso,
  ambito: Ambito,
  opciones?: { puedeEditarEventos?: boolean },
) {
  if (!puedeVer(rol, ambito, opciones)) return false
  if (ambito === 'opciones') return false
  if (rol === 'SUPERADMIN') return true
  if (ambito === 'calendario' && opciones?.puedeEditarEventos) return true
  if (rol === 'ADMIN') return ESCRITURA_ADMIN.has(ambito)
  return false
}

export function puedeVerRuta(
  rol: RolAcceso,
  path: string,
  opciones?: { puedeEditarEventos?: boolean },
) {
  if (path === '/m' || path.startsWith('/m/')) return true
  const ambito = ambitoDeRuta(path)
  if (!ambito) return rol !== 'CONSULTA_JEFES'
  return puedeVer(rol, ambito, opciones)
}

export function rutaInicio(rol: RolAcceso) {
  if (rol === 'CONSULTA_JEFES') return '/admin/cuadrante-jefes'
  return '/admin/agentes'
}

export function mensajeSinPermiso(ambito: Ambito) {
  if (ambito === 'cuadrante-jefes' || ambito === 'calendario-jefes' || ambito === 'permisos') {
    return 'Tu usuario puede consultar esta pantalla, pero no modificarla.'
  }
  return 'Tu usuario no puede modificar esta parte.'
}
