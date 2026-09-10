export type PermisoConfig = {
  codigo: string
  nombre: string
  abreviatura: string
}

export const PERMISOS_INICIALES: PermisoConfig[] = [
  {
    codigo: 'ASUNTOS_PROPIOS',
    nombre: 'Asuntos propios',
    abreviatura: 'AP',
  },
  {
    codigo: 'ENFERMEDAD_FAMILIAR',
    nombre: 'Enfermedad de familiar',
    abreviatura: 'EF',
  },
  {
    codigo: 'IT',
    nombre: 'IT',
    abreviatura: 'IT',
  },
]

export function clonarPermiso(permiso: PermisoConfig): PermisoConfig {
  return {
    codigo: permiso.codigo,
    nombre: permiso.nombre,
    abreviatura: permiso.abreviatura,
  }
}

export function mapaAbreviaturasPermiso(permisos: PermisoConfig[]) {
  return Object.fromEntries(
    permisos.map((permiso) => [permiso.nombre, permiso.abreviatura]),
  )
}

export function abreviaturaDesdePermisos(
  permisos: PermisoConfig[],
  nombre: string,
) {
  return (
    permisos.find((permiso) => permiso.nombre === nombre)?.abreviatura ??
    nombre.slice(0, 3).toUpperCase()
  )
}

export function permisoDesdeAbrev(
  permisos: PermisoConfig[],
  abrev: string | undefined,
): string | null {
  if (!abrev) return null
  const limpio = abrev.trim().toUpperCase()
  return (
    permisos.find((permiso) => permiso.abreviatura.toUpperCase() === limpio)
      ?.nombre ?? null
  )
}
