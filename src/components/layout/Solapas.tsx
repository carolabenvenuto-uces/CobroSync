import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'
import { esAdministradora } from '../../domain/administracion'

/**
 * Solapas de Cobranzas: pantallas que antes eran lugares sueltos del menú y ahora van juntas
 * (Control diario por factura o por siniestro, Seguimiento, Informes y Ajustes).
 */
interface Grupo {
  rutas: string[]
  solapas: { ruta: string; titulo: string; soloAdministradora?: boolean }[]
}

const GRUPOS: Grupo[] = [
  {
    rutas: ['/app/control-diario', '/app/siniestros'],
    solapas: [
      { ruta: '/app/control-diario', titulo: 'Por factura' },
      { ruta: '/app/siniestros', titulo: 'Por siniestro' },
    ],
  },
  {
    rutas: ['/app/pendientes', '/app/pedidos', '/app/reclamos'],
    solapas: [
      { ruta: '/app/pendientes', titulo: 'Sucursales' },
      { ruta: '/app/reclamos', titulo: 'Compañías' },
    ],
  },
  {
    rutas: ['/app/resumen', '/app/sucursales', '/app/saldos', '/app/impacto'],
    solapas: [
      { ruta: '/app/resumen', titulo: 'Resumen' },
      { ruta: '/app/sucursales', titulo: 'Por sucursal' },
      { ruta: '/app/saldos', titulo: 'Saldos por compañía' },
      { ruta: '/app/impacto', titulo: 'Impacto económico' },
    ],
  },
  {
    rutas: ['/app/ajustes', '/app/companias', '/app/planilla'],
    solapas: [
      { ruta: '/app/ajustes', titulo: 'Plazos y avisos', soloAdministradora: true },
      { ruta: '/app/companias', titulo: 'Compañías' },
      { ruta: '/app/planilla', titulo: 'Planilla' },
    ],
  },
]

/** Dentro de qué grupo está una pantalla (para marcar el menú) */
export function grupoDe(pathname: string): string[] | null {
  return GRUPOS.find((g) => g.rutas.includes(pathname))?.rutas ?? null
}

export function Solapas() {
  const { rol, cuenta, datos } = useApp()
  const { pathname } = useLocation()
  if (rol !== 'auditoria') return null
  const grupo = GRUPOS.find((g) => g.rutas.includes(pathname))
  if (!grupo) return null
  const admin = esAdministradora(rol, cuenta?.email, datos?.meta.avisos?.correoSoporte)
  const solapas = grupo.solapas.filter((s) => !s.soloAdministradora || admin)
  return (
    <nav className="no-imprimir -mt-1 mb-5 flex gap-1 overflow-x-auto border-b border-slate-200" aria-label="Secciones">
      {solapas.map((s) => (
        <NavLink
          key={s.ruta}
          to={s.ruta}
          className={({ isActive }) =>
            `-mb-px whitespace-nowrap border-b-2 px-3 py-2 text-sm font-semibold transition-colors ${
              isActive || (s.ruta === '/app/pendientes' && pathname === '/app/pedidos')
                ? 'border-marca text-marca'
                : 'border-transparent text-slate-500 hover:text-noche'
            }`
          }
        >
          {s.titulo}
        </NavLink>
      ))}
    </nav>
  )
}
