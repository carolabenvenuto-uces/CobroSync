import { useMemo, type ComponentType } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  BarChart3,
  Bell,
  Building2,
  CalendarClock,
  ClipboardList,
  FileText,
  HandCoins,
  LayoutDashboard,
  Presentation,
  Trophy,
  Upload,
  X,
} from 'lucide-react'
import { NOMBRE_ROL, useApp, useComprobantes } from '../../context/AppContext'
import { esperaALaSucursal } from '../../domain/sucursales'
import type { Rol } from '../../domain/tipos'
import { calcularAlertas } from '../../pages/Alertas'
import { Marca } from '../Logo'

interface ItemMenu {
  ruta: string
  etiqueta: string
  icono: ComponentType<{ className?: string }>
  roles: Rol[]
  contador?: 'pendientes' | 'alertas'
}

const OFICINA: Rol[] = ['auditoria', 'gerencia']

/** El menú se arma según el rol activo: cada pantalla declara quién la ve. */
const SECCIONES: { titulo: string; items: ItemMenu[] }[] = [
  {
    titulo: 'Operación',
    items: [
      { ruta: '/app', etiqueta: 'Inicio', icono: LayoutDashboard, roles: OFICINA },
      { ruta: '/app/pendientes', etiqueta: 'Pendientes de sucursales', icono: ClipboardList, roles: OFICINA, contador: 'pendientes' },
      { ruta: '/app/pendientes', etiqueta: 'Mis pendientes', icono: ClipboardList, roles: ['sucursal'], contador: 'pendientes' },
      { ruta: '/app/alertas', etiqueta: 'Alertas', icono: Bell, roles: OFICINA, contador: 'alertas' },
      { ruta: '/app/control-diario', etiqueta: 'Control diario', icono: FileText, roles: ['sucursal', ...OFICINA] },
    ],
  },
  {
    titulo: 'Informes',
    items: [
      { ruta: '/app/sucursales', etiqueta: 'Ranking de sucursales', icono: Trophy, roles: OFICINA },
      { ruta: '/app/impacto', etiqueta: 'Impacto económico', icono: HandCoins, roles: OFICINA },
      { ruta: '/app/saldos', etiqueta: 'Saldos por compañía', icono: Building2, roles: OFICINA },
      { ruta: '/app/cobros-previstos', etiqueta: 'Cobros previstos', icono: CalendarClock, roles: OFICINA },
    ],
  },
  {
    titulo: 'Datos',
    items: [{ ruta: '/app/planilla', etiqueta: 'Usar mi planilla', icono: Upload, roles: OFICINA }],
  },
]

export function Sidebar({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { datos, rol, usuario, sucursal, hoy, fuente } = useApp()
  const comprobantes = useComprobantes()

  const contadores = useMemo(() => {
    if (!datos) return { pendientes: 0, alertas: 0 }
    const alertas = calcularAlertas(comprobantes, hoy, (id) => id)
    return {
      pendientes: comprobantes.filter((c) => esperaALaSucursal(c, hoy)).length,
      alertas: alertas.reduce((s, g) => s + g.items.length, 0),
    }
  }, [datos, comprobantes, hoy])

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
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 hover:bg-white/10 lg:hidden" aria-label="Cerrar menú">
            <X className="h-5 w-5" />
          </button>
        </div>

        <nav className="flex-1 space-y-5 overflow-y-auto px-3 py-2">
          {SECCIONES.map((seccion) => {
            const items = seccion.items.filter((item) => item.roles.includes(rol))
            if (items.length === 0) return null
            return (
              <div key={seccion.titulo}>
                <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                  {seccion.titulo}
                </div>
                <div className="space-y-1">
                  {items.map(({ ruta, etiqueta, icono: Icono, contador }) => (
                    <NavLink
                      key={etiqueta}
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
                      <span className="flex-1">{etiqueta}</span>
                      {contador && contadores[contador] > 0 && (
                        <span
                          className={`rounded-full px-2 py-0.5 text-[11px] font-bold ${
                            contador === 'alertas' ? 'bg-sem-rojo text-white' : 'bg-sem-amarillo text-noche'
                          }`}
                        >
                          {contadores[contador]}
                        </span>
                      )}
                    </NavLink>
                  ))}
                </div>
              </div>
            )
          })}
        </nav>

        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-esmeralda/20 text-sm font-bold text-esmeralda">
              {usuario.slice(0, 1)}
            </div>
            <div className="min-w-0">
              <div className="truncate text-sm font-semibold text-white">{usuario}</div>
              <div className="truncate text-xs text-slate-400">
                {NOMBRE_ROL[rol]}
                {rol === 'sucursal' && ` · ${sucursal}`}
              </div>
            </div>
          </div>
          <Link to="/presentacion" className="mt-4 flex items-center gap-2 text-xs text-slate-400 hover:text-white">
            <Presentation className="h-3.5 w-3.5" />
            Ver presentación del producto
          </Link>
          <div className="mt-2 flex items-center gap-2 text-[11px] text-slate-500">
            <BarChart3 className="h-3.5 w-3.5" />
            {fuente.tipo === 'demo' ? 'Demo con datos de ejemplo' : 'Datos de tu planilla'}
          </div>
        </div>
      </aside>
    </>
  )
}
