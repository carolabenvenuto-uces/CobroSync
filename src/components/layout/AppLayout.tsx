import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { LegajoPanel } from '../LegajoPanel'
import { AvisoNotificacion } from '../Notificaciones'
import { AvisoCarga } from '../AvisoCarga'
import { Solapas } from './Solapas'
import { Marca } from '../Logo'
import { AUTORIA } from '../../lib/marca'
import { Cargando, ErrorCarga, SinAcceso } from '../ui/Estados'
import { conectadoAGoogle } from '../../services/google'
import { Sidebar } from './Sidebar'

/** Estructura de la demo: sidebar a la izquierda, filtros arriba y la pantalla activa (<Outlet />). */
export function AppLayout() {
  const { datos, error, fuente, guardado, legajoAbierto, abrirLegajo, sesionIniciada } = useApp()
  const legajo = legajoAbierto ? datos?.comprobantes.find((c) => c.id === legajoAbierto) : undefined
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Con Google: mientras se reconoce la cuenta, una pantalla de bienvenida; si no tiene acceso, un aviso claro
  if (conectadoAGoogle() && !datos) return error ? <SinAcceso mensaje={error} /> : <Cargando pantallaCompleta />
  // Demo: si todavía no se eligió usuario, a la pantalla de inicio
  if (!conectadoAGoogle() && !sesionIniciada) return <Navigate to="/" replace />

  return (
    <div className="flex min-h-screen">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo en celulares, fija al bajar: la marca y el botón del menú siempre a mano */}
        <div className="no-imprimir sticky top-0 z-30 flex h-16 items-center justify-between bg-noche px-4 shadow-md lg:hidden">
          <Marca oscuro />
          <button
            type="button"
            onClick={() => setMenuAbierto(true)}
            className="rounded-lg p-2 text-white hover:bg-white/10"
            aria-label="Abrir menú"
          >
            <Menu className="h-5 w-5" />
          </button>
        </div>

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {error ? (
            <ErrorCarga mensaje={error} />
          ) : datos ? (
            <>
              <Solapas />
              <Outlet />
            </>
          ) : (
            <Cargando />
          )}
        </main>

        <footer className="flex items-center justify-between gap-4 border-t border-slate-200 px-8 py-4 text-xs text-slate-500">
          <span>
          {fuente.tipo === 'demo'
            ? ''
            : fuente.tipo === 'google'
              ? `Conectado como ${fuente.email} · ${guardado.estado === 'guardando' ? 'Guardando…' : guardado.estado === 'error' ? `No se pudo guardar: ${guardado.mensaje}` : 'Cambios guardados'}`
              : 'Datos de la planilla cargada: se procesan solo en este navegador'}{' '}
          {fuente.tipo === 'demo' ? '' : ' · '}
          {AUTORIA}
          </span>
        </footer>
      </div>

      {/* El legajo se abre desde cualquier pantalla (tablas, avisos, notificaciones) */}
      {datos && <AvisoNotificacion />}
      <AvisoCarga />
      {legajo && <LegajoPanel key={legajo.id} comprobante={legajo} onCerrar={() => abrirLegajo(null)} />}
    </div>
  )
}
