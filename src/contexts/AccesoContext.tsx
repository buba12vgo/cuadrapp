import {
  createContext,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from 'react'
import {
  ETIQUETA_ROL_ACCESO,
  fijarRolAccesoActivo,
  perfilFijo,
  puedeEscribir,
  puedeVer,
  rutaInicio,
  type Ambito,
  type PerfilAcceso,
  type RolAcceso,
} from '@/lib/acceso'
import { isDesignPreview } from '@/lib/designPreview'
import { consultaPreviewPuedeEventos, leerUsuarioAcceso } from '@/lib/usuariosAcceso'
import { useAuth } from '@/contexts/AuthContext'

const PREVIEW_ROL_KEY = 'cuadrapp.preview-rol'

type AccesoContextValue = {
  perfil: PerfilAcceso | null
  loading: boolean
  puedeVer: (ambito: Ambito) => boolean
  puedeEscribir: (ambito: Ambito) => boolean
  inicio: string
  etiquetaRol: string
  rolPreview: RolAcceso
  setRolPreview: (rol: RolAcceso) => void
}

const AccesoContext = createContext<AccesoContextValue | null>(null)

function leerRolPreview(): RolAcceso {
  try {
    const valor = sessionStorage.getItem(PREVIEW_ROL_KEY)
    if (valor === 'ADMIN' || valor === 'CONSULTA_JEFES' || valor === 'SUPERADMIN') {
      return valor
    }
  } catch {
    /* ignore */
  }
  return 'SUPERADMIN'
}

function perfilPreview(rol: RolAcceso): PerfilAcceso {
  if (rol === 'ADMIN') {
    return {
      rol,
      email: 'jonymivi@gmail.com',
      uid: 'preview-admin',
      numeroPlaca: '108',
      nombre: 'Jonathan Miguez Vila',
      fijo: true,
    }
  }
  if (rol === 'CONSULTA_JEFES') {
    return {
      rol,
      email: 'jefe.beta@cuadrapp.local',
      uid: 'preview-consulta',
      numeroPlaca: null,
      nombre: 'Consulta jefes',
      fijo: false,
      puedeEditarEventos: consultaPreviewPuedeEventos(),
    }
  }
  return {
    rol: 'SUPERADMIN',
    email: 'buba12@gmail.com',
    uid: 'preview-superadmin',
    numeroPlaca: '102',
    nombre: 'Rubén Francisco Román Durán',
    fijo: true,
  }
}

export function AccesoProvider({ children }: { children: ReactNode }) {
  const { user, loading: authLoading, signOut, notificar } = useAuth()
  const [perfil, setPerfil] = useState<PerfilAcceso | null>(null)
  const [loading, setLoading] = useState(true)
  const [rolPreview, setRolPreviewState] = useState<RolAcceso>(leerRolPreview)

  useEffect(() => {
    fijarRolAccesoActivo(perfil?.rol ?? null)
  }, [perfil])

  useEffect(() => {
    if (authLoading) return
    let cancelado = false

    async function resolver() {
      setLoading(true)
      if (!user) {
        if (!cancelado) {
          setPerfil(null)
          setLoading(false)
        }
        return
      }

      if (isDesignPreview) {
        if (!cancelado) {
          setPerfil(perfilPreview(rolPreview))
          setLoading(false)
        }
        return
      }

      const email = user.email?.trim().toLowerCase() ?? ''
      const fijo = perfilFijo(email)
      if (fijo && user.emailVerified) {
        if (!cancelado) {
          setPerfil({ ...fijo, uid: user.uid })
          setLoading(false)
        }
        return
      }

      try {
        const doc = await leerUsuarioAcceso(user.uid)
        if (cancelado) return
        if (
          doc &&
          doc.activo &&
          doc.email === email
        ) {
          setPerfil({
            rol: doc.rolAcceso,
            email: doc.email,
            uid: doc.uid,
            numeroPlaca: doc.numeroPlaca,
            nombre: doc.nombre,
            fijo: false,
            puedeEditarEventos: doc.puedeEditarEventos === true,
          })
          setLoading(false)
          return
        }
      } catch (err) {
        console.error('[acceso] No se pudo leer el perfil', err)
      }

      if (cancelado) return
      setPerfil(null)
      setLoading(false)
      notificar('Esta cuenta no tiene acceso. El superadmin tiene que darte de alta.')
      await signOut()
    }

    void resolver()
    return () => {
      cancelado = true
    }
  }, [user, authLoading, rolPreview, signOut, notificar])

  function setRolPreview(rol: RolAcceso) {
    try {
      sessionStorage.setItem(PREVIEW_ROL_KEY, rol)
    } catch {
      /* ignore */
    }
    setRolPreviewState(rol)
  }

  const value = useMemo<AccesoContextValue>(() => {
    const rol = perfil?.rol
    return {
      perfil,
      loading: authLoading || loading,
      puedeVer: (ambito) => (rol ? puedeVer(rol, ambito) : false),
      puedeEscribir: (ambito) =>
        rol
          ? puedeEscribir(rol, ambito, {
              puedeEditarEventos: perfil?.puedeEditarEventos,
            })
          : false,
      inicio: rol ? rutaInicio(rol) : '/login',
      etiquetaRol: rol ? ETIQUETA_ROL_ACCESO[rol] : '',
      rolPreview,
      setRolPreview,
    }
  }, [perfil, authLoading, loading, rolPreview])

  return <AccesoContext.Provider value={value}>{children}</AccesoContext.Provider>
}

export function useAcceso() {
  const ctx = useContext(AccesoContext)
  if (!ctx) throw new Error('useAcceso must be used within AccesoProvider')
  return ctx
}
