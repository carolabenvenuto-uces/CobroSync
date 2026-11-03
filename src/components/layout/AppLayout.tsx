import { useState } from 'react'
import { Outlet } from 'react-router-dom'
import { Menu } from 'lucide-react'
import { useApp } from '../../context/AppContext'
import { Marca } from '../Logo'
import { Cargando, ErrorCarga } from '../ui/Estados'
import { BarraFiltros } from './BarraFiltros'
import { Sidebar } from './Sidebar'

/** Estructura de la demo: sidebar a la izquierda, filtros arriba y la pantalla activa (<Outlet />). */
export function AppLayout() {
  const { datos, error } = useApp()
  const [menuAbierto, setMenuAbierto] = useState(false)

  return (
    <div className="flex min-h-screen">
      <Sidebar abierto={menuAbierto} onCerrar={() => setMenuAbierto(false)} />

      <div className="flex min-w-0 flex-1 flex-col">
        {/* Barra superior solo en celulares, con el botón para abrir el menú */}
        <div className="flex items-center justify-between bg-noche px-4 py-3 lg:hidden">
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

        <BarraFiltros />

        <main className="flex-1 px-4 py-6 sm:px-6 lg:px-8">
          {error ? <ErrorCarga mensaje={error} /> : datos ? <Outlet /> : <Cargando />}
        </main>

        <footer className="border-t border-slate-200 px-8 py-4 text-xs text-slate-500">
          Demo con datos ficticios · CobroSync by CAROLA · desarrollado por CaroIA Studio
        </footer>
      </div>
    </div>
  )
}
