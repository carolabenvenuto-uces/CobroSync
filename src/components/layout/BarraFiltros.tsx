import { Link } from 'react-router-dom'
import { FileSpreadsheet } from 'lucide-react'
import { NOMBRE_ROL, TODAS_LAS_SUCURSALES, useApp } from '../../context/AppContext'
import type { Rol } from '../../domain/tipos'
import { formatoFecha, MESES } from '../../lib/formato'
import { claseSelect } from '../ui/Estados'

const ROLES: Rol[] = ['sucursal', 'auditoria', 'gerencia']

/** Filtros globales: afectan a todas las pantallas a la vez. */
export function BarraFiltros() {
  const { datos, rol, setRol, sucursal, setSucursal, anio, mes, setMes, fuente, usarDemo } = useApp()
  const sucursales = (datos?.meta.sucursales ?? []).map((s) => s.nombre)

  return (
    <div className="sticky top-0 z-20 flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white/90 px-4 py-3 backdrop-blur sm:px-6 lg:px-8">
      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        {rol === 'sucursal' ? 'Mi sucursal' : 'Sucursal'}
        <select className={claseSelect} value={sucursal} onChange={(e) => setSucursal(e.target.value)}>
          {rol !== 'sucursal' && <option>{TODAS_LAS_SUCURSALES}</option>}
          {sucursales.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </label>

      <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
        Mes
        <select className={claseSelect} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
          {MESES.map((nombre, i) => (
            <option key={nombre} value={i + 1}>
              {nombre} {anio}
            </option>
          ))}
        </select>
      </label>

      {fuente.tipo === 'planilla' && (
        <span className="inline-flex items-center gap-2 rounded-lg bg-esmeralda/10 px-3 py-1.5 text-xs font-semibold text-emerald-900">
          <FileSpreadsheet className="h-3.5 w-3.5" />
          <Link to="/app/planilla" className="hover:underline">
            Datos reales: {fuente.archivo} (solo en este navegador)
          </Link>
          <button type="button" onClick={usarDemo} className="ml-1 text-emerald-700 underline hover:text-emerald-900">
            volver a la demo
          </button>
        </span>
      )}

      <div className="ml-auto flex flex-wrap items-center gap-3">
        {datos && (
          <span className="hidden text-xs text-slate-500 md:inline">
            Datos al {formatoFecha(datos.meta.fechaCorte)}
          </span>
        )}
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          <span className="rounded bg-esmeralda/15 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-emerald-800">
            Demo
          </span>
          Ver como
          <select className={claseSelect} value={rol} onChange={(e) => setRol(e.target.value as Rol)}>
            {ROLES.map((r) => (
              <option key={r} value={r}>
                {NOMBRE_ROL[r]}
              </option>
            ))}
          </select>
        </label>
      </div>
    </div>
  )
}
