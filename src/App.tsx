import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { useApp } from './context/AppContext'
import type { Rol } from './domain/tipos'
import CobrosPrevistos from './pages/CobrosPrevistos'
import ControlDiario from './pages/ControlDiario'
import Dashboard from './pages/Dashboard'
import Landing from './pages/Landing'
import Saldos from './pages/Saldos'

/** Si el rol activo no tiene acceso a una pantalla, lo lleva al Control diario. */
function SoloPara({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { rol } = useApp()
  return roles.includes(rol) ? children : <Navigate to="/app/control-diario" replace />
}

const OFICINA: Rol[] = ['administracion', 'gerencia']

export default function App() {
  return (
    <Routes>
      <Route path="/" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route
          index
          element={
            <SoloPara roles={OFICINA}>
              <Dashboard />
            </SoloPara>
          }
        />
        <Route path="control-diario" element={<ControlDiario />} />
        <Route
          path="saldos"
          element={
            <SoloPara roles={OFICINA}>
              <Saldos />
            </SoloPara>
          }
        />
        <Route
          path="cobros-previstos"
          element={
            <SoloPara roles={OFICINA}>
              <CobrosPrevistos />
            </SoloPara>
          }
        />
      </Route>
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )
}
