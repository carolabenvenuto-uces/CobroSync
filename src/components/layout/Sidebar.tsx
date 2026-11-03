import type { ComponentType } from 'react'
import { Link, NavLink } from 'react-router-dom'
import { ArrowLeft, Building2, CalendarClock, FileText, LayoutDashboard, X } from 'lucide-react'
import { NOMBRE_ROL, useApp } from '../../context/AppContext'
import type { Rol } from '../../domain/tipos'
import { Marca } from '../Logo'

interface ItemMenu {
  ruta: string
  etiqueta: string
  icono: ComponentType<{ className?: string }>
  roles: Rol[]
}

/** Cada pantalla declara qué roles la ven: el menú se arma según el rol activo. */
const MENU: ItemMenu[] = [
  { ruta: '/app', etiqueta: 'Dashboard general', icono: LayoutDashboard, roles: ['administracion', 'gerencia'] },
  {
    ruta: '/app/control-diario',
    etiqueta: 'Control diario y legajos',
    icono: FileText,
    roles: ['taller', 'administracion', 'gerencia'],
  },
  { ruta: '/app/saldos', etiqueta: 'Saldos por compañía', icono: Building2, roles: ['administracion', 'gerencia'] },
  {
    ruta: '/app/cobros-previstos',
    etiqueta: 'Cobros previstos',
    icono: CalendarClock,
    roles: ['administracion', 'gerencia'],
  },
]

export function Sidebar({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { rol } = useApp()
  const items = MENU.filter((item) => item.roles.includes(rol))

  return (
    <>
      {/* Fondo oscuro detrás del menú en celulares */}
      {abierto && <div className="fixed inset-0 z-30 bg-noche/50 lg:hidden" onClick={onCerrar} aria-hidden="true" />}

      <aside
        className={`fixed inset-y-0 left-0 z-40 flex w-64 flex-col bg-noche text-slate-300 transition-transform lg:sticky lg:top-0 lg:h-screen lg:translate-x-0 ${
          abierto ? 'translate-x-0' : '-translate-x-full'
        }`}
      >
        <div className="flex items-center justify-between px-5 py-5">
          <Marca oscuro />
          <button
            type="button"
            onClick={onCerrar}
            className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden"
            aria-label="Cerrar menú"
          >
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-1 px-3 py-2">
          {items.map(({ ruta, etiqueta, icono: Icono }) => (
            <NavLink
              key={ruta}
              to={ruta}
              end={ruta === '/app'}
              onClick={onCerrar}
              className={({ isActive }) =>
                `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                  isActive ? 'bg-marca text-white' : 'hover:bg-white/5 hover:text-white'
                }`
              }
            >
              <Icono className="h-4 w-4" />
              {etiqueta}
            </NavLink>
          ))}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-esmeralda/20 text-sm font-bold text-esmeralda">
              CB
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">Carola Benvenuto</div>
              <div className="truncate text-xs text-slate-400">{NOMBRE_ROL[rol]}</div>
            </div>
          </div>
          <Link to="/" className="mt-4 flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <ArrowLeft className="h-3.5 w-3.5" />
            Volver al sitio
          </Link>
        </div>
      </aside>
    </>
  )
}
