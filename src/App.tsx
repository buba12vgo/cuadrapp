import { Navigate, Route, Routes } from 'react-router-dom'
import { AdminLayout } from '@/components/AdminLayout'
import { AgentesPage } from '@/pages/AgentesPage'
import { CalendarioPage } from '@/pages/CalendarioPage'
import { CuadranteMensualPage } from '@/pages/CuadranteMensualPage'
import { PlanAnualPage } from '@/pages/PlanAnualPage'

export default function App() {
  return (
    <Routes>
      <Route element={<AdminLayout />}>
        <Route path="/" element={<Navigate to="/admin/agentes" replace />} />
        <Route path="/admin/agentes" element={<AgentesPage />} />
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
      </Route>
    </Routes>
  )
}
