import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { INICIO_ROL, useApp } from './context/AppContext'
import type { Rol } from './domain/tipos'
import Alertas from './pages/Alertas'
import CobrosPrevistos from './pages/CobrosPrevistos'
import ControlDiario from './pages/ControlDiario'
import Dashboard from './pages/Dashboard'
import Impacto from './pages/Impacto'
import Landing from './pages/Landing'
import Pendientes from './pages/Pendientes'
import RankingSucursales from './pages/RankingSucursales'
import Saldos from './pages/Saldos'
import UsarPlanilla from './pages/UsarPlanilla'

/** Si el rol activo no tiene acceso a una pantalla, lo lleva a su inicio. */
function SoloPara({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { rol } = useApp()
  return roles.includes(rol) ? children : <Navigate to={INICIO_ROL[rol]} replace />
}

const OFICINA: Rol[] = ['auditoria', 'gerencia']
const oficina = (pagina: ReactNode) => <SoloPara roles={OFICINA}>{pagina}</SoloPara>

export default function App() {
  return (
    <Routes>
      {/* La demo abre directo en la app; la presentación queda como página aparte. */}
      <Route path="/" element={<Navigate to="/app" replace />} />
      <Route path="/presentacion" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={oficina(<Dashboard />)} />
        <Route path="pendientes" element={<Pendientes />} />
        <Route path="alertas" element={oficina(<Alertas />)} />
        <Route path="control-diario" element={<ControlDiario />} />
        <Route path="sucursales" element={oficina(<RankingSucursales />)} />
        <Route path="impacto" element={oficina(<Impacto />)} />
        <Route path="saldos" element={oficina(<Saldos />)} />
        <Route path="cobros-previstos" element={oficina(<CobrosPrevistos />)} />
        <Route path="planilla" element={oficina(<UsarPlanilla />)} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
