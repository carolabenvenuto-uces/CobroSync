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
    <div className="mb-4 flex border-b border-slate-200">
      {pestanas.map((p) => (
        <NavLink
          key={p.ruta}
          to={p.ruta}
          className={({ isActive }) =>
            `-mb-px border-b-2 px-4 py-2 text-sm font-semibold ${isActive ? 'border-marca text-marca' : 'border-transparent text-slate-500 hover:text-slate-800'}`
          }
        >
          {p.titulo} <span className="ml-1 rounded-full bg-slate-100 px-2 py-0.5 text-xs text-slate-700">{p.cantidad}</span>
        </NavLink>
      ))}
    </div>
  )
}
