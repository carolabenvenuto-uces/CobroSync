import { useMemo, type ComponentType } from 'react'
import { Link, NavLink, useNavigate } from 'react-router-dom'
import {
  LogOut,
  AlertTriangle,
  BarChart3,
  BookUser,
  Bell,
  Building2,
  ClipboardList,
  FileText,
  FolderOpen,
  HandCoins,
  LayoutDashboard,
  Megaphone,
  BookOpen,
  Trophy,
  Send,
  Settings,
  Upload,
  X,
} from 'lucide-react'
import { NOMBRE_ROL, useApp, useComprobantes } from '../../context/AppContext'
import { esperaALaSucursal } from '../../domain/sucursales'
import { calcularSemaforo } from '../../domain/semaforo'
import { paraResolver } from '../../domain/resolver'
import { estadoReclamo, RECLAMO_PARA_ACTUAR } from '../../domain/reclamos'
import type { Rol } from '../../domain/tipos'
import { calcularAvisos } from '../../pages/Avisos'
import { Marca } from '../Logo'
import { Campana } from '../Notificaciones'
import { formatoFecha } from '../../lib/formato'

interface ItemMenu {
  ruta: string
  etiqueta: string
  icono: ComponentType<{ className?: string }>
  contador?: 'pendientes' | 'alertas' | 'reclamos' | 'presentar' | 'resolver'
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
    { titulo: 'Detalle', items: [{ ruta: '/app/control-diario', etiqueta: 'Detalle de facturas', icono: FileText }] },
  ],
  auditoria: [
    {
      titulo: 'Trabajo diario',
      items: [
        { ruta: '/app', etiqueta: 'Avisos', icono: Bell, contador: 'alertas' },
        { ruta: '/app/pendientes', etiqueta: 'Pendientes de sucursales', icono: ClipboardList, contador: 'pendientes' },
        { ruta: '/app/presentar', etiqueta: 'Presentar', icono: Send, contador: 'presentar' },
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
        { ruta: '/app/ajustes', etiqueta: 'Ajustes', icono: Settings },
      ],
    },
  ],
  sucursal: [
    {
      titulo: 'Mi sucursal',
      items: [
        { ruta: '/app', etiqueta: 'Mis facturas', icono: ClipboardList, contador: 'pendientes' },
        { ruta: '/app/resolver', etiqueta: 'Para resolver', icono: AlertTriangle, contador: 'resolver' },
        { ruta: '/app/siniestros', etiqueta: 'Mis siniestros', icono: FolderOpen },
      ],
    },
  ],
}

export function Sidebar({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { datos, rol, setRol, usuario, sucursal, setSucursal, hoy, fuente, usarDemo, cerrarSesion, cuenta } = useApp()
  const navigate = useNavigate()
  const comprobantes = useComprobantes()

  const contadores = useMemo(() => {
    if (!datos) return { pendientes: 0, alertas: 0, reclamos: 0, presentar: 0, resolver: 0 }
    const sectores = calcularAvisos(comprobantes, hoy)
    return {
      // En la sucursal, "Mis facturas" cuenta lo mismo que la tarjeta Para subir (lo observado va en Para resolver)
      pendientes:
        rol === 'sucursal'
          ? comprobantes.filter((c) => c.tipo === 'FC' && ['doc_pendiente', 'doc_atrasada'].includes(calcularSemaforo(c, hoy).etapa)).length
          : comprobantes.filter((c) => esperaALaSucursal(c, hoy)).length,
      alertas: sectores.reduce((t, s) => t + s.avisos.reduce((u, a) => u + a.facturas.length, 0), 0),
      reclamos: comprobantes.filter((c) => {
        const e = estadoReclamo(c, hoy)
        return e !== null && RECLAMO_PARA_ACTUAR.includes(e)
      }).length,
      presentar: comprobantes.filter((c) => c.tipo === 'FC' && calcularSemaforo(c, hoy).etapa === 'pres_pendiente').length,
      resolver: paraResolver(comprobantes, hoy).length,
    }
  }, [datos, comprobantes, hoy, rol])

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
          <Campana onCerrar={onCerrar} />
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
                            contador === 'pendientes' ? 'bg-sem-amarillo text-noche' : contador === 'presentar' ? 'bg-marca text-white' : 'bg-sem-rojo text-white'
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
              {cuenta && <div className="truncate text-[11px] font-normal text-slate-400">{cuenta.email}</div>}
            </div>
          </div>
          {fuente.tipo === 'google' ? (
            <div className="mt-1 truncate text-[11px] text-slate-400">
              {NOMBRE_ROL[rol]}
              {rol === 'sucursal' && ` · ${sucursal}`}
            </div>
          ) : (
            <>
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
            </>
          )}
          <div className="mt-3 space-y-1 text-[11px] text-slate-400">
            <div className="flex items-center gap-2">
              <BarChart3 className="h-3.5 w-3.5 shrink-0" />
              {fuente.tipo === 'demo' ? 'Datos de ejemplo' : fuente.tipo === 'google' ? 'Datos de la empresa' : `Tu planilla: ${fuente.archivo}`}
              {hoy && ` · al ${formatoFecha(hoy)}`}
            </div>
            {fuente.tipo === 'planilla' && (
              <button type="button" onClick={usarDemo} className="underline hover:text-white">
                Volver a la demo
              </button>
            )}
            {fuente.tipo !== 'google' && (
              <button
                type="button"
                onClick={() => {
                  cerrarSesion()
                  navigate('/')
                }}
                className="flex items-center gap-2 hover:text-white"
              >
                <LogOut className="h-3.5 w-3.5" />
                Cambiar de usuario
              </button>
            )}
            <Link to="/app/manual" onClick={onCerrar} className="flex items-center gap-2 hover:text-white">
              <BookOpen className="h-3.5 w-3.5" />
              Manual de uso
            </Link>
          </div>
        </div>
      </aside>
    </>
  )
}
