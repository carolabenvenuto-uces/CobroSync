import { useMemo, type ComponentType } from 'react'
import { Link, NavLink } from 'react-router-dom'
import {
  BarChart3,
  BookUser,
  Search,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  HandCoins,
  LayoutDashboard,
  Megaphone,
  Presentation,
  Trophy,
  Upload,
  X,
} from 'lucide-react'
import { NOMBRE_ROL, useApp, useComprobantes } from '../../context/AppContext'
import { esperaALaSucursal } from '../../domain/sucursales'
import { estadoReclamo } from '../../domain/reclamos'
import type { Rol } from '../../domain/tipos'
import { calcularAvisos } from '../../pages/Avisos'
import { Marca } from '../Logo'
import { Campana } from '../Notificaciones'
import { formatoFecha } from '../../lib/formato'

interface ItemMenu {
  ruta: string
  etiqueta: string
  icono: ComponentType<{ className?: string }>
  contador?: 'pendientes' | 'alertas' | 'reclamos'
}

/**
 * Cada rol tiene su propio menú: Gerencia ve resúmenes, Auditoría ve todo el detalle
 * y la Sucursal ve solo lo que tiene que hacer.
 */
const MENUS: Record<Rol, { titulo: string; items: ItemMenu[] }[]> = {
  gerencia: [
    {
      titulo: 'Informes',
      items: [
        { ruta: '/app', etiqueta: 'Resumen', icono: LayoutDashboard },
        { ruta: '/app/sucursales', etiqueta: 'Ranking de sucursales', icono: Trophy },
        { ruta: '/app/saldos', etiqueta: 'Saldos por compañía', icono: Building2 },
        { ruta: '/app/impacto', etiqueta: 'Impacto económico', icono: HandCoins },
      ],
    },
    { titulo: 'Consultas', items: [{ ruta: '/app/control-diario', etiqueta: 'Buscar una factura', icono: Search }] },
  ],
  auditoria: [
    {
      titulo: 'Trabajo diario',
      items: [
        { ruta: '/app', etiqueta: 'Avisos', icono: Bell, contador: 'alertas' },
        { ruta: '/app/pendientes', etiqueta: 'Pendientes de sucursales', icono: ClipboardList, contador: 'pendientes' },
        { ruta: '/app/reclamos', etiqueta: 'Vencidas y reclamos', icono: Megaphone, contador: 'reclamos' },
        { ruta: '/app/control-diario', etiqueta: 'Control diario', icono: FileText },
      ],
    },
    {
      titulo: 'Informes',
      items: [
        { ruta: '/app/resumen', etiqueta: 'Resumen', icono: LayoutDashboard },
        { ruta: '/app/sucursales', etiqueta: 'Ranking de sucursales', icono: Trophy },
        { ruta: '/app/saldos', etiqueta: 'Saldos por compañía', icono: Building2 },
        { ruta: '/app/impacto', etiqueta: 'Impacto económico', icono: HandCoins },
      ],
    },
    {
      titulo: 'Datos',
      items: [
        { ruta: '/app/companias', etiqueta: 'Compañías', icono: BookUser },
        { ruta: '/app/planilla', etiqueta: 'Usar mi planilla', icono: Upload },
      ],
    },
  ],
  sucursal: [{ titulo: 'Mi sucursal', items: [{ ruta: '/app', etiqueta: 'Mis facturas', icono: ClipboardList, contador: 'pendientes' }] }],
}

export function Sidebar({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { datos, rol, setRol, usuario, sucursal, setSucursal, hoy, fuente, usarDemo } = useApp()
  const comprobantes = useComprobantes()

  const contadores = useMemo(() => {
    if (!datos) return { pendientes: 0, alertas: 0, reclamos: 0 }
    const sectores = calcularAvisos(comprobantes, hoy)
    return {
      pendientes: comprobantes.filter((c) => esperaALaSucursal(c, hoy)).length,
      alertas: sectores.reduce((t, s) => t + s.avisos.reduce((u, a) => u + a.facturas.length, 0), 0),
      reclamos: comprobantes.filter((c) => {
        const e = estadoReclamo(c, hoy)
        return e === 'sin_reclamar' || e === 'escalar'
      }).length,
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
          <Campana />
          {MENUS[rol].map((seccion) => {
            const items = seccion.items
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
                            contador === 'pendientes' ? 'bg-sem-amarillo text-noche' : 'bg-sem-rojo text-white'
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

        {/* Quién usa la demo: rol y, para Sucursal, cuál */}
        <div className="border-t border-white/10 px-5 py-4">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-esmeralda/20 text-sm font-bold text-esmeralda">
              {usuario.slice(0, 1)}
            </div>
            <div className="min-w-0 text-sm font-semibold text-white">
              <div className="truncate">{usuario}</div>
            </div>
          </div>
          <label className="mt-3 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            Ver como
            <select
              value={rol}
              onChange={(e) => setRol(e.target.value as Rol)}
              className="mt-1 block w-full rounded-lg border border-white/10 bg-noche-claro px-2 py-1.5 text-sm font-medium normal-case tracking-normal text-white"
            >
              {(['sucursal', 'auditoria', 'gerencia'] as Rol[]).map((r) => (
                <option key={r} value={r}>
                  {NOMBRE_ROL[r]}
                </option>
              ))}
            </select>
          </label>
          {rol === 'sucursal' && (
            <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              Mi sucursal
              <select
                value={sucursal}
                onChange={(e) => setSucursal(e.target.value)}
                className="mt-1 block w-full rounded-lg border border-white/10 bg-noche-claro px-2 py-1.5 text-sm font-medium normal-case tracking-normal text-white"
              >
                {(datos?.meta.sucursales ?? []).map((s) => (
                  <option key={s.nombre}>{s.nombre}</option>
                ))}
              </select>
            </label>
          )}
          <div className="mt-3 space-y-1 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              {fuente.tipo === 'demo' ? 'Datos de ejemplo' : `Tu planilla: ${fuente.archivo}`}
              {hoy && ` · al ${formatoFecha(hoy)}`}
            </div>
            {fuente.tipo === 'planilla' && (
              <button type="button" onClick={usarDemo} className="underline hover:text-white">
                Volver a la demo
              </button>
            )}
            <Link to="/presentacion" className="flex items-center gap-2 hover:text-white">
              <Presentation className="h-3.5 w-3.5" />
              Ver presentación del producto
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
