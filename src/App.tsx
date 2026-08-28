import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '@/components/AdminLayout'
import { ProtectedRoute } from '@/components/ProtectedRoute'
import { AgentesPage } from '@/pages/AgentesPage'
import { CalendarioPage } from '@/pages/CalendarioPage'
import { CuadranteMensualPage } from '@/pages/CuadranteMensualPage'
import { MinimosPage } from '@/pages/MinimosPage'
import { PlanAnualPage } from '@/pages/PlanAnualPage'
import { PuestosPage } from '@/pages/PuestosPage'
import { LoginPage } from '@/pages/LoginPage'
import { ReglasPage } from '@/pages/ReglasPage'

export default function App() {
  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<ProtectedRoute />}>
        <Route element={<AdminLayout />}>
          <Route path="/" element={<Navigate to="/admin/agentes" replace />} />
          <Route path="/admin/agentes" element={<AgentesPage />} />
          <Route path="/admin/puestos" element={<PuestosPage />} />
          <Route path="/admin/minimos" element={<MinimosPage />} />
          <Route path="/admin/plan-anual" element={<PlanAnualPage />} />
          <Route
            path="/admin/planificacion-anual"
            element={<Navigate to="/admin/plan-anual" replace />}
          />
          <Route path="/admin/cuadrante-mensual" element={<CuadranteMensualPage />} />
          <Route
            path="/admin/cuadrante"
            element={<Navigate to="/admin/cuadrante-mensual" replace />}
          />
          <Route path="/admin/calendario" element={<CalendarioPage />} />
          <Route path="/admin/reglas" element={<ReglasPage />} />
        </Route>
      </Route>
    </Routes>
  )
}
