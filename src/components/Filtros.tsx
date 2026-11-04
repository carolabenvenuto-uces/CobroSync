/**
 * Filtros que cada pantalla muestra solo si los usa (antes había una franja fija arriba).
 * El valor elegido se recuerda al cambiar de pantalla.
 */
import { TODAS_LAS_SUCURSALES, useApp } from '../context/AppContext'
import { anioDe, diaDe, mesDe } from '../lib/fechas'
import { MESES } from '../lib/formato'
import { claseSelect } from './ui/Estados'

export function FiltroSucursal({ enLinea = false }: { enLinea?: boolean }) {
  const { datos, rol, sucursal, setSucursal } = useApp()
  // Una persona de sucursal solo ve la suya: el filtro no aplica
  if (rol === 'sucursal') return null
  if (enLinea) {
    // Debajo del título de la pantalla, a la vista: "Todas las sucursales ▾"
    return (
      <select
        aria-label="Sucursal"
        className="rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-7 text-sm font-semibold text-noche shadow-sm hover:border-marca/50 focus:border-marca focus:outline-none"
        value={sucursal}
        onChange={(e) => setSucursal(e.target.value)}
      >
        <option value={TODAS_LAS_SUCURSALES}>Todas las sucursales</option>
        {(datos?.meta.sucursales ?? []).map((s) => (
          <option key={s.nombre} value={s.nombre}>
            Sucursal {s.nombre}
          </option>
        ))}
      </select>
    )
  }
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      Sucursal
      <select className={claseSelect} value={sucursal} onChange={(e) => setSucursal(e.target.value)}>
        <option value={TODAS_LAS_SUCURSALES}>Todas</option>
        {(datos?.meta.sucursales ?? []).map((s) => (
          <option key={s.nombre}>{s.nombre}</option>
        ))}
      </select>
    </label>
  )
}

export function FiltroMes() {
  const { anio, mes, setMes, hoy } = useApp()
  const ultimoMes = hoy && anioDe(hoy) === anio ? mesDe(hoy) : 12
  const enCurso = hoy && anioDe(hoy) === anio && diaDe(hoy) < new Date(Date.UTC(anio, ultimoMes, 0)).getUTCDate()
  return (
    <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
      Mes
      <select className={claseSelect} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
        {MESES.slice(0, ultimoMes).map((nombre, i) => (
          <option key={nombre} value={i + 1}>
            {nombre} {anio}
            {i + 1 === ultimoMes && enCurso ? ' (en curso)' : ''}
          </option>
        ))}
      </select>
    </label>
  )
}
