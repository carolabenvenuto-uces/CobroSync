import { NavLink } from 'react-router-dom'
import { useApp, useComprobantes } from '../context/AppContext'
import { esperaALaSucursal } from '../domain/sucursales'
import { pedidosAbiertos } from '../domain/pedidos'

/** Lo que Cobranzas espera de las sucursales, en dos pantallas: la documentación y los pedidos. */
export function PestanasSucursales() {
  const { rol, hoy } = useApp()
  const comprobantes = useComprobantes()
  if (rol !== 'auditoria') return null
  const pestanas = [
    { ruta: '/app/pendientes', titulo: 'Documentación', cantidad: comprobantes.filter((c) => esperaALaSucursal(c, hoy)).length },
    { ruta: '/app/pedidos', titulo: 'Pedidos', cantidad: pedidosAbiertos(comprobantes, hoy).length },
  ]
  return (
    // Mismo interruptor que las solapas de arriba (ver layout/Solapas.tsx)
    <div className="mb-4 max-w-full overflow-x-auto">
      <div className="inline-flex gap-0.5 rounded-xl bg-slate-200/70 p-1">
        {pestanas.map((p) => (
          <NavLink
            key={p.ruta}
            to={p.ruta}
            className={({ isActive }) =>
              `whitespace-nowrap rounded-lg px-4 py-1.5 text-sm font-semibold transition-colors ${isActive ? 'bg-white text-noche shadow-sm' : 'text-slate-500 hover:text-noche'}`
            }
          >
            {p.titulo} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{p.cantidad}</span>
          </NavLink>
        ))}
      </div>
    </div>
  )
}
