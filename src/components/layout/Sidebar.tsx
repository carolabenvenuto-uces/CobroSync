import { useMemo, useState, type ComponentType } from 'react'
import { FIRMA, PRODUCTO, VERSION } from '../../lib/marca'
import { VentanaSoporte } from '../Soporte'
import { Link, NavLink, useLocation, useNavigate } from 'react-router-dom'
import {
  LogOut,
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
  LifeBuoy,
  Store,
  Send,
  Settings,
  Upload,
  X,
} from 'lucide-react'
import { NOMBRE_ROL, useApp, useComprobantes } from '../../context/AppContext'
import { esperaALaSucursal } from '../../domain/sucursales'
import { calcularSemaforo } from '../../domain/semaforo'
import { paraResolver } from '../../domain/resolver'
import { esAdministradora } from '../../domain/administracion'
import { pedidosAbiertos, pedidosParaSucursal } from '../../domain/pedidos'
import { estadoReclamo, RECLAMO_PARA_ACTUAR } from '../../domain/reclamos'
import type { Rol } from '../../domain/tipos'
import { calcularAvisos } from '../../pages/Avisos'
import { Marca } from '../Logo'
import { Campana } from '../Notificaciones'

interface ItemMenu {
  ruta: string
  etiqueta: string
  icono: ComponentType<{ className?: string }>
  contador?: 'pendientes' | 'alertas' | 'reclamos' | 'presentar' | 'resolver' | 'pedidos'
  /** solo la ve la administradora (Ajustes) */
  soloAdministradora?: boolean
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
        { ruta: '/app/sucursales', etiqueta: 'Control por sucursal', icono: Store },
        { ruta: '/app/saldos', etiqueta: 'Saldos por compañía', icono: Building2 },
        { ruta: '/app/impacto', etiqueta: 'Impacto económico', icono: HandCoins },
      ],
    },
    { titulo: 'Detalle', items: [{ ruta: '/app/control-diario', etiqueta: 'Detalle de facturas', icono: FileText }] },
  ],
  auditoria: [
    // Junto a Notificaciones: lo que hay que mirar primero
    { titulo: '', items: [{ ruta: '/app', etiqueta: 'Avisos', icono: Bell, contador: 'alertas' }] },
    {
      titulo: 'Trabajo diario',
      items: [
        { ruta: '/app/control-diario', etiqueta: 'Control diario', icono: FileText },
        { ruta: '/app/presentar', etiqueta: 'Presentar', icono: Send, contador: 'presentar' },
        { ruta: '/app/companias', etiqueta: 'Compañías', icono: BookUser },
      ],
    },
    {
      titulo: 'Seguimiento y reclamos',
      items: [
        { ruta: '/app/pendientes', etiqueta: 'Pendientes de sucursales', icono: ClipboardList, contador: 'pendientes' },
        { ruta: '/app/reclamos', etiqueta: 'Vencidas y reclamos', icono: Megaphone, contador: 'reclamos' },
      ],
    },
    {
      titulo: 'Informes',
      items: [
        { ruta: '/app/resumen', etiqueta: 'Resumen', icono: LayoutDashboard },
        { ruta: '/app/sucursales', etiqueta: 'Control por sucursal', icono: Store },
        { ruta: '/app/saldos', etiqueta: 'Saldos por compañía', icono: Building2 },
        { ruta: '/app/impacto', etiqueta: 'Impacto económico', icono: HandCoins },
      ],
    },
    {
      titulo: 'Configuración',
      items: [
        { ruta: '/app/planilla', etiqueta: 'Usar mi planilla', icono: Upload },
        { ruta: '/app/ajustes', etiqueta: 'Ajustes', icono: Settings, soloAdministradora: true },
      ],
    },
  ],
  sucursal: [
    {
      titulo: 'Mi sucursal',
      items: [
        { ruta: '/app', etiqueta: 'Mis facturas', icono: ClipboardList, contador: 'pendientes' },
        { ruta: '/app/siniestros', etiqueta: 'Mis siniestros', icono: FolderOpen },
      ],
    },
  ],
}

export function Sidebar({ abierto, onCerrar }: { abierto: boolean; onCerrar: () => void }) {
  const { datos, rol, setRol, usuario, sucursal, setSucursal, hoy, fuente, usarDemo, cerrarSesion, cuenta } = useApp()
  const navigate = useNavigate()
  const comprobantes = useComprobantes()

  const { pathname } = useLocation()
  const [soporte, setSoporte] = useState(false)
  const administradora = esAdministradora(rol, cuenta?.email, datos?.meta.avisos?.correoSoporte)

  const contadores = useMemo(() => {
    if (!datos) return { pendientes: 0, alertas: 0, reclamos: 0, presentar: 0, resolver: 0, pedidos: 0 }
    const sectores = calcularAvisos(comprobantes, hoy)
    return {
      // En la sucursal, "Mis facturas" cuenta lo que tiene tareas: para subir y rechazos u observaciones
      pendientes:
        rol === 'sucursal'
          ? new Set([
              ...comprobantes.filter((c) => c.tipo === 'FC' && ['doc_pendiente', 'doc_atrasada', 'doc_observada'].includes(calcularSemaforo(c, hoy).etapa)).map((c) => c.id),
              ...pedidosParaSucursal(comprobantes, hoy).map((p) => p.c.id),
            ]).size
          : comprobantes.filter((c) => esperaALaSucursal(c, hoy)).length + (rol === 'auditoria' ? pedidosAbiertos(comprobantes, hoy).length : 0),
      alertas: sectores.reduce((t, s) => t + s.avisos.reduce((u, a) => u + a.facturas.length, 0), 0),
      reclamos: comprobantes.filter((c) => {
        const e = estadoReclamo(c, hoy)
        return e !== null && RECLAMO_PARA_ACTUAR.includes(e)
      }).length,
      presentar: comprobantes.filter((c) => c.tipo === 'FC' && (c.reenviar || calcularSemaforo(c, hoy).etapa === 'pres_pendiente')).length,
      pedidos: pedidosAbiertos(comprobantes, hoy).length,
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

        {/* Quién está usando la plataforma, arriba, con el logo de SVA */}
        <div className="mx-3 mb-3 flex items-center gap-3 rounded-xl bg-white/5 px-3 py-2.5">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-esmeralda/20 text-sm font-bold text-esmeralda">
            {usuario.slice(0, 1)}
          </div>
          <div className="min-w-0 flex-1 text-sm font-semibold text-white">
            <div className="truncate">{usuario}</div>
            <div className="truncate text-[11px] font-normal text-slate-400">
              {NOMBRE_ROL[rol]}
              {rol === 'sucursal' && ` · ${sucursal}`}
            </div>
          </div>
          <img src={`${import.meta.env.BASE_URL}grupo-sva-claro.png`} alt="Grupo SVA" className="h-8 w-auto shrink-0" />
        </div>

        <nav className="scroll-oscuro flex-1 space-y-5 overflow-y-auto px-3 py-2">
          <Campana onCerrar={onCerrar} />
          {MENUS[rol].map((seccion, n) => {
            const items = seccion.items.filter((it) => !it.soloAdministradora || administradora)
            if (!items.length) return null
            return (
              <div key={seccion.titulo || n} className={seccion.titulo ? '' : '-mt-4'}>
                {seccion.titulo && (
                  <div className="px-3 pb-1 text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {seccion.titulo}
                  </div>
                )}
                <div className="space-y-1">
                  {items.map(({ ruta, etiqueta, icono: Icono, contador }) => (
                    <NavLink
                      key={etiqueta}
                      to={ruta}
                      end={ruta === '/app'}
                      onClick={onCerrar}
                      className={({ isActive }) =>
                        `flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${
                          // Pedidos es la otra pestaña de Pendientes de sucursales
                          isActive || (ruta === '/app/pendientes' && pathname === '/app/pedidos') ? 'bg-marca text-white' : 'hover:bg-white/5 hover:text-white'
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

        {/* Abajo, solo el manual. En la demo, además, el cambio de vista (en la prueba cada uno entra con su cuenta) */}
        <div className="border-t border-white/10 px-5 py-3 text-[12px] text-slate-400">
          <Link to="/app/manual" onClick={onCerrar} className="flex items-center gap-2 py-1 hover:text-white">
            <BookOpen className="h-4 w-4" />
            Manual de uso
          </Link>
          <button type="button" onClick={() => setSoporte(true)} className="flex w-full items-center gap-2 py-1 text-left hover:text-white">
            <LifeBuoy className="h-4 w-4" />
            Soporte técnico
          </button>
          {soporte && <VentanaSoporte onCerrar={() => setSoporte(false)} />}
          {fuente.tipo !== 'google' && (
            <details className="mt-1">
              <summary className="cursor-pointer select-none py-1 text-[11px] text-slate-500 hover:text-slate-300">Vista de demostración</summary>
              <label className="mt-2 block text-[11px] font-semibold uppercase tracking-wider text-slate-500">
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
              {fuente.tipo === 'planilla' && (
                <button type="button" onClick={usarDemo} className="mt-2 block underline hover:text-white">
                  Volver a los datos de ejemplo
                </button>
              )}
            </details>
          )}
          {/* Cerrar sesión: en la demo vuelve a elegir usuario; con Google, cierra la cuenta en este navegador
              (sirve en las computadoras compartidas de las sucursales) */}
          {fuente.tipo === 'google' ? (
            <a
              href="https://accounts.google.com/Logout"
              target="_top"
              title="Cierra la sesión de la cuenta de Google en este navegador"
              className="flex w-full items-center gap-2 py-1 hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </a>
          ) : (
            <button
              type="button"
              onClick={() => {
                cerrarSesion()
                navigate('/')
              }}
              className="flex w-full items-center gap-2 py-1 text-left hover:text-white"
            >
              <LogOut className="h-4 w-4" />
              Cerrar sesión
            </button>
          )}
          {/* Versión y siglas de la autora, discretas al pie del menú (el nombre completo está en el pie de página) */}
          <div className="mt-2 border-t border-white/10 pt-2 text-[10px] tracking-wide text-slate-500">
            {PRODUCTO} v{VERSION} · {FIRMA}
          </div>
        </div>
      </aside>
    </>
  )
}
