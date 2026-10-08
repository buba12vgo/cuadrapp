import { lazy, type ComponentType } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { useAcceso } from '@/contexts/AccesoContext'
import { importarModulo } from '@/lib/cargaDiferida'
import { AccesoShell } from '@/components/AccesoShell'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { LoginPage } from '@/pages/LoginPage'
import { InicioAcceso } from '@/components/InicioAcceso'

function pagina<K extends string>(
  cargar: () => Promise<Record<K, ComponentType>>,
  nombre: K,
) {
  return lazy(() =>
    importarModulo(cargar).then((mod) => ({ default: mod[nombre] })),
  )
}

const MovilCalendarioPage = pagina(() => import('@/pages/movil/MovilCalendarioPage'), 'MovilCalendarioPage')
const MovilCuadrantePage = pagina(() => import('@/pages/movil/MovilCuadrantePage'), 'MovilCuadrantePage')
const AgentesPage = pagina(() => import('@/pages/AgentesPage'), 'AgentesPage')
const CalendarioPage = pagina(() => import('@/pages/CalendarioPage'), 'CalendarioPage')
const TiposEventoPage = pagina(() => import('@/pages/TiposEventoPage'), 'TiposEventoPage')
const CalendarioAgentePage = pagina(() => import('@/pages/CalendarioAgentePage'), 'CalendarioAgentePage')
const DiarioAgentesPage = pagina(() => import('@/pages/DiarioAgentesPage'), 'DiarioAgentesPage')
const SolicitudesPage = pagina(() => import('@/pages/SolicitudesPage'), 'SolicitudesPage')
const CalendarioJefesPage = pagina(() => import('@/pages/CalendarioJefesPage'), 'CalendarioJefesPage')
const CuadranteJefesPage = pagina(() => import('@/pages/CuadranteJefesPage'), 'CuadranteJefesPage')
const CuadranteMensualPage = pagina(() => import('@/pages/CuadranteMensualPage'), 'CuadranteMensualPage')
const MinimosPage = pagina(() => import('@/pages/MinimosPage'), 'MinimosPage')
const PlanAnualPage = pagina(() => import('@/pages/PlanAnualPage'), 'PlanAnualPage')
const PermisosPage = pagina(() => import('@/pages/PermisosPage'), 'PermisosPage')
const PermisosAgentesPage = pagina(() => import('@/pages/PermisosAgentesPage'), 'PermisosAgentesPage')
const MovilPermisosPage = pagina(() => import('@/pages/movil/MovilPermisosPage'), 'MovilPermisosPage')
const MovilDiarioPage = pagina(() => import('@/pages/movil/MovilDiarioPage'), 'MovilDiarioPage')
const MovilEventosPage = pagina(() => import('@/pages/movil/MovilEventosPage'), 'MovilEventosPage')
const MovilServicioPage = pagina(() => import('@/pages/movil/MovilServicioPage'), 'MovilServicioPage')
const PuestosPage = pagina(() => import('@/pages/PuestosPage'), 'PuestosPage')
const ListadosPage = pagina(() => import('@/pages/ListadosPage'), 'ListadosPage')
const OpcionesPage = pagina(() => import('@/pages/OpcionesPage'), 'OpcionesPage')
const ReglasPage = pagina(() => import('@/pages/ReglasPage'), 'ReglasPage')
const RoadmapTimeline = pagina(() => import('@/components/RoadmapTimeline'), 'RoadmapTimeline')
const UsuariosPage = pagina(() => import('@/pages/UsuariosPage'), 'UsuariosPage')

function InicioMovil() {
  return <Navigate to={useAcceso().inicioMovil} replace />
}

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AccesoShell />}>
          <Route path="/m" element={<InicioMovil />} />
          <Route path="/m/cuadrante" element={<MovilCuadrantePage />} />
          <Route path="/m/calendario" element={<MovilCalendarioPage />} />
          <Route path="/m/servicio" element={<MovilServicioPage />} />
          <Route path="/m/diario" element={<MovilDiarioPage />} />
          <Route path="/m/eventos" element={<MovilEventosPage />} />
          <Route path="/m/permisos" element={<MovilPermisosPage />} />
          <Route path="/m/solicitudes" element={<SolicitudesPage />} />
          <Route path="/" element={<InicioAcceso />} />
          <Route path="/admin/agentes" element={<AgentesPage />} />
          <Route path="/admin/puestos" element={<PuestosPage />} />
          <Route path="/admin/permisos" element={<PermisosPage />} />
          <Route path="/admin/permisos-agentes" element={<PermisosAgentesPage />} />
          <Route path="/admin/minimos" element={<MinimosPage />} />
          <Route path="/admin/plan-anual" element={<PlanAnualPage />} />
          <Route
            path="/admin/planificacion-anual"
            element={<Navigate to="/admin/plan-anual" replace />}
          />
          <Route path="/admin/cuadrante-mensual" element={<CuadranteMensualPage />} />
          <Route path="/admin/cuadrante-jefes" element={<CuadranteJefesPage />} />
          <Route path="/admin/calendario-jefes" element={<CalendarioJefesPage />} />
          <Route path="/admin/calendario-agente" element={<CalendarioAgentePage />} />
          <Route path="/admin/diario-agentes" element={<DiarioAgentesPage />} />
          <Route path="/admin/solicitudes" element={<SolicitudesPage />} />
          <Route
            path="/admin/cuadrante"
            element={<Navigate to="/admin/cuadrante-mensual" replace />}
          />
          <Route path="/admin/calendario" element={<CalendarioPage />} />
          <Route path="/admin/tipos-evento" element={<TiposEventoPage />} />
          <Route path="/admin/listados" element={<ListadosPage />} />
          <Route path="/admin/reglas" element={<ReglasPage />} />
          <Route path="/admin/usuarios" element={<UsuariosPage />} />
          <Route path="/admin/opciones" element={<OpcionesPage />} />
          <Route path="/admin/roadmap" element={<RoadmapTimeline />} />
        </Route>
      </Route>
      <Route path="*" element={<Navigate to="/login" replace />} />
    </Routes>
  )
}
