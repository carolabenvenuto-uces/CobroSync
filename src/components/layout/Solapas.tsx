import { NavLink, useLocation } from 'react-router-dom'
import { useApp } from '../../context/AppContext'

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
      { ruta: '/app/companias', titulo: 'Compañías', soloAdministradora: true },
      { ruta: '/app/planilla', titulo: 'Planilla', soloAdministradora: true },
    ],
  },
]

/** Dentro de qué grupo está una pantalla (para marcar el menú) */
export function grupoDe(pathname: string): string[] | null {
  return GRUPOS.find((g) => g.rutas.includes(pathname))?.rutas ?? null
}

export function Solapas() {
  const { rol, administradora: admin } = useApp()
  const { pathname } = useLocation()
  if (rol !== 'auditoria') return null
  const grupo = GRUPOS.find((g) => g.rutas.includes(pathname))
  if (!grupo) return null
  const solapas = grupo.solapas.filter((s) => !s.soloAdministradora || admin)
  return (
    // Interruptor: las opciones dentro de una cápsula gris; la elegida se "levanta" en blanco
    <div className="no-imprimir -mt-1 mb-5 max-w-full overflow-x-auto">
      <nav className="inline-flex gap-0.5 rounded-xl bg-slate-200/70 p-1" aria-label="Secciones">
        {solapas.map((s) => (
          <NavLink
            key={s.ruta}
            to={s.ruta}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${
                isActive || (s.ruta === '/app/pendientes' && pathname === '/app/pedidos')
                  ? 'bg-white text-noche shadow-sm'
                  : 'text-slate-500 hover:text-noche'
              }`
            }
          >
            {s.titulo}
          </NavLink>
        ))}
      </nav>
    </div>
  )
}
