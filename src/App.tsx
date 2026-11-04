import type { ReactNode } from 'react'
import { Navigate, Route, Routes } from 'react-router-dom'
import { AppLayout } from './components/layout/AppLayout'
import { INICIO_ROL, useApp } from './context/AppContext'
import type { Rol } from './domain/tipos'
import Ajustes from './pages/Ajustes'
import Avisos from './pages/Avisos'
import Companias from './pages/Companias'
import ControlDiario from './pages/ControlDiario'
import Impacto from './pages/Impacto'
import Ingreso from './pages/Ingreso'
import Landing from './pages/Landing'
import MisFacturas from './pages/MisFacturas'
import Pendientes from './pages/Pendientes'
import Presentar from './pages/Presentar'
import RankingSucursales from './pages/RankingSucursales'
import Reclamos from './pages/Reclamos'
import Resumen from './pages/Resumen'
import Saldos from './pages/Saldos'
import Siniestros from './pages/Siniestros'
import UsarPlanilla from './pages/UsarPlanilla'

/** Si el rol activo no tiene acceso a una pantalla, lo lleva a su inicio. */
function SoloPara({ roles, children }: { roles: Rol[]; children: ReactNode }) {
  const { rol } = useApp()
  return roles.includes(rol) ? children : <Navigate to={INICIO_ROL[rol]} replace />
}

const OFICINA: Rol[] = ['auditoria', 'gerencia']
const oficina = (pagina: ReactNode) => <SoloPara roles={OFICINA}>{pagina}</SoloPara>
const auditoria = (pagina: ReactNode) => <SoloPara roles={['auditoria']}>{pagina}</SoloPara>

/** Cada rol entra a su propia pantalla de inicio. */
function Inicio() {
  const { rol } = useApp()
  if (rol === 'gerencia') return <Resumen />
  if (rol === 'sucursal') return <MisFacturas />
  return <Avisos />
}

export default function App() {
  return (
    <Routes>
      {/* Pantalla de inicio: en la demo se elige el usuario; con Google se pasa directo a /app */}
      <Route path="/" element={<Ingreso />} />
      <Route path="/presentacion" element={<Landing />} />
      <Route path="/app" element={<AppLayout />}>
        <Route index element={<Inicio />} />
        <Route path="resumen" element={oficina(<Resumen />)} />
        <Route path="pendientes" element={oficina(<Pendientes />)} />
        <Route path="reclamos" element={oficina(<Reclamos />)} />
        <Route path="control-diario" element={oficina(<ControlDiario />)} />
        <Route path="sucursales" element={oficina(<RankingSucursales />)} />
        <Route path="impacto" element={oficina(<Impacto />)} />
        <Route path="saldos" element={oficina(<Saldos />)} />
        <Route path="companias" element={auditoria(<Companias />)} />
        <Route path="planilla" element={auditoria(<UsarPlanilla />)} />
        <Route path="ajustes" element={auditoria(<Ajustes />)} />
        <Route path="presentar" element={auditoria(<Presentar />)} />
        <Route path="siniestros" element={<Siniestros />} />
        <Route path="resolver" element={<MisFacturas vista="resolver" />} />
      </Route>
      <Route path="*" element={<Navigate to="/app" replace />} />
    </Routes>
  )
}
