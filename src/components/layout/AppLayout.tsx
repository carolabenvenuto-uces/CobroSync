import { useState } from 'react'
import { Navigate, Outlet } from 'react-router-dom'
import { Eye, Menu } from 'lucide-react'
import { NOMBRE_ROL, useApp } from '../../context/AppContext'
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
  const { datos, error, fuente, guardado, legajoAbierto, abrirLegajo, sesionIniciada, vista, verComo, salio } = useApp()
  const legajo = legajoAbierto ? datos?.comprobantes.find((c) => c.id === legajoAbierto) : undefined
  const [menuAbierto, setMenuAbierto] = useState(false)

  // Con Google: mientras se reconoce la cuenta, una pantalla de bienvenida; si no tiene acceso, un aviso claro
  if (conectadoAGoogle() && !datos) return error ? <SinAcceso mensaje={error} /> : <Cargando pantallaCompleta />
  // Demo: si todavía no se eligió usuario, a la pantalla de inicio
  if (!conectadoAGoogle() && !sesionIniciada) return <Navigate to="/" replace />
  if (salio) return <Salida />

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

        {/* La administradora mirando como otro usuario: siempre a la vista, con la vuelta a la suya */}
        {vista && (
          <div className="no-imprimir sticky top-16 z-20 flex flex-wrap items-center gap-x-3 gap-y-1 border-b border-amber-300 bg-amber-50 px-4 py-2 text-sm text-amber-950 sm:px-6 lg:top-0 lg:px-8">
            <Eye className="h-4 w-4 shrink-0" />
            <span className="min-w-0 flex-1">
              Viendo como <strong>{vista.rol === 'sucursal' ? `Sucursal · ${vista.sucursal}${vista.veCompanias ? ' + compañías' : ''}` : NOMBRE_ROL[vista.rol]}</strong> · solo para mirar, no se guarda nada
            </span>
            <button type="button" onClick={() => verComo(null)} className="rounded-lg border border-amber-300 bg-white px-3 py-1 text-xs font-semibold hover:bg-amber-100">
              Volver a mi vista
            </button>
          </div>
        )}

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

        {/* Pie: a la izquierda la conexión y el guardado; a la derecha la autoría (en el celular, una debajo de la otra) */}
        <footer className="flex flex-col gap-1 border-t border-slate-200 px-4 py-4 text-xs text-slate-500 sm:flex-row sm:items-center sm:justify-between sm:gap-4 sm:px-8">
          <span>
            {fuente.tipo === 'google'
              ? `Conectado como ${fuente.email} · ${guardado.estado === 'guardando' ? 'Guardando…' : guardado.estado === 'error' ? `No se pudo guardar: ${guardado.mensaje}` : 'Cambios guardados'}`
              : fuente.tipo === 'planilla'
                ? 'Datos de la planilla cargada: se procesan solo en este navegador'
                : ''}
          </span>
          <span className="text-slate-400 sm:text-right">{AUTORIA}</span>
        </footer>
      </div>

      {/* El legajo se abre desde cualquier pantalla (tablas, avisos, notificaciones) */}
      {datos && <AvisoNotificacion />}
      <AvisoCarga />
      {legajo && <LegajoPanel key={legajo.id} comprobante={legajo} onCerrar={() => abrirLegajo(null)} />}
    </div>
  )
}

/**
 * Después de "Cerrar sesión" con Google. CobroSync entra con la cuenta de Google de la empresa abierta en
 * el navegador (como Gmail o Drive), así que no hay una contraseña propia: al volver a abrir el link se
 * entra con esa cuenta. En una computadora compartida, para que otro no entre, hay que cerrar la cuenta
 * de Google, como con el mail.
 */
function Salida() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-noche px-4">
      <div className="w-full max-w-sm rounded-2xl bg-white p-8 text-center shadow-xl">
        <h1 className="text-xl font-extrabold text-noche">Cerraste sesión</h1>
        <p className="mt-2 text-sm text-slate-600">Ya podés cerrar esta pestaña.</p>
      </div>
    </div>
  )
}
