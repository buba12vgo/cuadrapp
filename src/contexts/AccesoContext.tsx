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
import { useAgentesData } from '@/lib/agentesStore'
import { esRolCuadranteJefes } from '@/lib/rolesCuadrante'
import { isDesignPreview } from '@/lib/designPreview'
import { consultaPreviewPuedeEventos, leerUsuarioAcceso } from '@/lib/usuariosAcceso'
import { useAuth } from '@/contexts/AuthContext'

const PREVIEW_ROL_KEY = 'cuadrapp.preview-rol'

export type RolPreview = RolAcceso | 'AGENTE'

type AccesoContextValue = {
  perfil: PerfilAcceso | null
  loading: boolean
  esJefatura: boolean
  puedeVer: (ambito: Ambito) => boolean
  puedeEscribir: (ambito: Ambito) => boolean
  inicio: string
  etiquetaRol: string
  rolPreview: RolPreview
  setRolPreview: (rol: RolPreview) => void
}

const AccesoContext = createContext<AccesoContextValue | null>(null)

function leerRolPreview(): RolPreview {
  try {
    const valor = sessionStorage.getItem(PREVIEW_ROL_KEY)
    if (
      valor === 'ADMIN' ||
      valor === 'CONSULTA_JEFES' ||
      valor === 'SUPERADMIN' ||
      valor === 'AGENTE'
    ) {
      return valor
    }
  } catch {
    /* ignore */
  }
  return 'SUPERADMIN'
}

function perfilPreview(rol: RolPreview): PerfilAcceso {
  if (rol === 'AGENTE') {
    return {
      rol: 'CONSULTA_JEFES',
      email: 'xoan.agente@cuadrapp.local',
      uid: 'preview-agente',
      numeroPlaca: '1108',
      agenteId: 'ag-003',
      nombre: 'Xoán Pérez Otero',
      fijo: false,
    }
  }
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
      email: 'elena.jefa@cuadrapp.local',
      uid: 'preview-consulta',
      numeroPlaca: '1001',
      agenteId: 'ag-001',
      nombre: 'Elena Vázquez Souto',
      fijo: false,
      puedeEditarEventos:
        consultaPreviewPuedeEventos() ||
        sessionStorage.getItem('cuadrapp.preview-eventos') === '1',
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
  const [rolPreview, setRolPreviewState] = useState<RolPreview>(leerRolPreview)
  const [agentes] = useAgentesData()

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
            agenteId: doc.agenteId,
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

  const esJefatura = useMemo(() => {
    if (!perfil || perfil.rol !== 'CONSULTA_JEFES') return false
    const agente =
      agentes.find((item) => item.id === perfil.agenteId) ??
      agentes.find(
        (item) => perfil.numeroPlaca != null && item.numeroPlaca === perfil.numeroPlaca,
      )
    return agente ? esRolCuadranteJefes(agente.rolBase) : false
  }, [perfil, agentes])

  function setRolPreview(rol: RolPreview) {
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
      esJefatura,
      puedeVer: (ambito) =>
        rol
          ? puedeVer(rol, ambito, {
              puedeEditarEventos: perfil?.puedeEditarEventos,
              esJefatura,
            })
          : false,
      puedeEscribir: (ambito) =>
        rol
          ? puedeEscribir(rol, ambito, {
              puedeEditarEventos: perfil?.puedeEditarEventos,
              esJefatura,
            })
          : false,
      inicio: rol ? rutaInicio(rol, { esJefatura }) : '/login',
      etiquetaRol: rol ? ETIQUETA_ROL_ACCESO[rol] : '',
      rolPreview,
      setRolPreview,
    }
  }, [perfil, authLoading, loading, rolPreview, esJefatura])

  return <AccesoContext.Provider value={value}>{children}</AccesoContext.Provider>
}

export function useAcceso() {
  const ctx = useContext(AccesoContext)
  if (!ctx) throw new Error('useAcceso must be used within AccesoProvider')
  return ctx
}
