import { Navigate, Route, Routes } from 'react-router-dom'
import { AccesoShell } from '@/components/AccesoShell'
import { MovilCalendarioPage } from '@/pages/movil/MovilCalendarioPage'
import { MovilCuadrantePage } from '@/pages/movil/MovilCuadrantePage'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AgentesPage } from '@/pages/AgentesPage'
import { CalendarioPage } from '@/pages/CalendarioPage'
import { CalendarioAgentePage } from '@/pages/CalendarioAgentePage'
import { DiarioAgentesPage } from '@/pages/DiarioAgentesPage'
import { CalendarioJefesPage } from '@/pages/CalendarioJefesPage'
import { CuadranteJefesPage } from '@/pages/CuadranteJefesPage'
import { CuadranteMensualPage } from '@/pages/CuadranteMensualPage'
import { MinimosPage } from '@/pages/MinimosPage'
import { PlanAnualPage } from '@/pages/PlanAnualPage'
import { PermisosPage } from '@/pages/PermisosPage'
import { PermisosAgentesPage } from '@/pages/PermisosAgentesPage'
import { MovilPermisosPage } from '@/pages/movil/MovilPermisosPage'
import { MovilDiarioPage } from '@/pages/movil/MovilDiarioPage'
import { MovilServicioPage } from '@/pages/movil/MovilServicioPage'
import { PuestosPage } from '@/pages/PuestosPage'
import { LoginPage } from '@/pages/LoginPage'
import { ListadosPage } from '@/pages/ListadosPage'
import { OpcionesPage } from '@/pages/OpcionesPage'
import { ReglasPage } from '@/pages/ReglasPage'
import { RoadmapTimeline } from '@/components/RoadmapTimeline'
import { UsuariosPage } from '@/pages/UsuariosPage'
import { InicioAcceso } from '@/components/InicioAcceso'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AccesoShell />}>
          <Route path="/m" element={<Navigate to="/m/cuadrante" replace />} />
          <Route path="/m/cuadrante" element={<MovilCuadrantePage />} />
          <Route path="/m/calendario" element={<MovilCalendarioPage />} />
          <Route path="/m/servicio" element={<MovilServicioPage />} />
          <Route path="/m/diario" element={<MovilDiarioPage />} />
          <Route path="/m/permisos" element={<MovilPermisosPage />} />
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
          <Route
            path="/admin/cuadrante"
            element={<Navigate to="/admin/cuadrante-mensual" replace />}
          />
          <Route path="/admin/calendario" element={<CalendarioPage />} />
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
