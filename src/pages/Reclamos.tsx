import { useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { Info } from 'lucide-react'
import { FiltroSucursal } from '../components/Filtros'
import { LegajoPanel } from '../components/LegajoPanel'
import { BotonExportar, Card, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp, useComprobantes } from '../context/AppContext'
import {
  DIAS_SIN_RESPUESTA,
  DIAS_VENCIDA_PARA_ESCALAR,
  estadoReclamo,
  NOMBRE_ESTADO_RECLAMO,
  RECLAMOS_PARA_ESCALAR,
  ultimoReclamo,
  type EstadoReclamo,
} from '../domain/reclamos'
import { diffDias } from '../lib/fechas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

const ESTILO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'bg-red-800/10 text-red-900',
  reclamada: 'bg-slate-100 text-slate-700',
  escalar: 'bg-sem-amarillo/20 text-amber-900',
}

/**
 * Facturas vencidas y su seguimiento con cada compañía: si se reclamó, cuántas veces,
 * cuándo fue el último reclamo y cuáles hay que escalar a gerencia.
 */
export default function Reclamos() {
  const { datos, hoy } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!
  const [params, setParams] = useSearchParams()
  const compania = params.get('compania') ?? 'todas'
  const [filtro, setFiltro] = useState<EstadoReclamo | 'todas'>('todas')
  const [seleccionadoId, setSeleccionadoId] = useState<string | null>(null)
  const nombreCompania = (id: string) => aseguradoras.find((a) => a.id === id)?.nombre ?? id

  const vencidas = useMemo(
    () =>
      comprobantes
        .map((c) => ({ c, estado: estadoReclamo(c, hoy) }))
        .filter((x): x is { c: (typeof comprobantes)[number]; estado: EstadoReclamo } => x.estado !== null)
        .filter((x) => compania === 'todas' || x.c.aseguradoraId === compania)
        .sort((a, b) => (a.c.vencimiento ?? '').localeCompare(b.c.vencimiento ?? '')),
    [comprobantes, hoy, compania],
  )
  const visibles = vencidas.filter((x) => filtro === 'todas' || x.estado === filtro)
  const resumen = (e: EstadoReclamo) => {
    const lista = vencidas.filter((x) => x.estado === e)
    return { cantidad: lista.length, total: lista.reduce((s, x) => s + x.c.total, 0) }
  }
  const total = vencidas.reduce((s, x) => s + x.c.total, 0)
  const seleccionado = comprobantes.find((c) => c.id === seleccionadoId) ?? null

  function exportar() {
    descargarExcel(
      `vencidas-y-reclamos-${hoy}`,
      ['Compañía', 'Comprobante', 'Sucursal', 'Siniestro', 'Total', 'Presentación', 'Vencimiento', 'Días vencida', 'Reclamos', 'Último reclamo', 'Estado'],
      visibles.map(({ c, estado }) => [
        nombreCompania(c.aseguradoraId),
        formatoComprobante(c),
        c.sucursal,
        c.siniestro,
        c.total,
        fechaExcel(c.fechaPresentacion),
        fechaExcel(c.vencimiento),
        diffDias(c.vencimiento as string, hoy),
        c.reclamos.length,
        fechaExcel(ultimoReclamo(c)),
        NOMBRE_ESTADO_RECLAMO[estado],
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Vencidas y reclamos"
        subtitulo={`Facturas presentadas, vencidas y sin cobrar al ${formatoFecha(hoy)}`}
        acciones={
          <>
            <FiltroSucursal />
            <select
              className={claseSelect}
              value={compania}
              onChange={(e) => setParams(e.target.value === 'todas' ? {} : { compania: e.target.value }, { replace: true })}
            >
              <option value="todas">Todas las compañías</option>
              {aseguradoras.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.nombre}
                </option>
              ))}
            </select>
            <BotonExportar onClick={exportar} />
          </>
        }
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-marca/20 bg-marca/5 px-4 py-3 text-sm text-blue-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          Se escala a gerencia cuando la factura tiene {RECLAMOS_PARA_ESCALAR} reclamos o más y pasaron {DIAS_SIN_RESPUESTA} días sin
          respuesta desde el último, o cuando lleva más de {DIAS_VENCIDA_PARA_ESCALAR} días vencida.
        </span>
      </div>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <button type="button" className="text-left" onClick={() => setFiltro('todas')}>
          <Indicador titulo="Vencido total" valor={formatoPesos(total)} ayuda={`${vencidas.length} facturas`} tono="rojo" />
        </button>
        {(['sin_reclamar', 'reclamada', 'escalar'] as EstadoReclamo[]).map((e) => (
          <button key={e} type="button" className={`rounded-xl text-left ${filtro === e ? 'ring-2 ring-marca' : ''}`} onClick={() => setFiltro(e)}>
            <Indicador titulo={NOMBRE_ESTADO_RECLAMO[e]} valor={formatoPesos(resumen(e).total)} ayuda={`${resumen(e).cantidad} facturas`} />
          </button>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Compañía</th>
                <th className="px-3 py-3 font-semibold">Comprobante</th>
                <th className="px-3 py-3 font-semibold">Sucursal</th>
                <th className="px-3 py-3 text-right font-semibold">Total</th>
                <th className="px-3 py-3 font-semibold">Vencimiento</th>
                <th className="px-3 py-3 text-right font-semibold">Días vencida</th>
                <th className="px-3 py-3 text-right font-semibold">Reclamos</th>
                <th className="px-3 py-3 font-semibold">Último reclamo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visibles.map(({ c, estado }) => (
                <tr key={c.id} onClick={() => setSeleccionadoId(c.id)} className="cursor-pointer hover:bg-marca/5">
                  <td className="px-4 py-2.5 whitespace-nowrap">{nombreCompania(c.aseguradoraId)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium">{formatoComprobante(c)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{c.sucursal}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap tabular-nums">{formatoPesos(c.total)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(c.vencimiento)}</td>
                  <td className="px-3 py-2.5 text-right font-semibold tabular-nums text-red-800">{diffDias(c.vencimiento as string, hoy)}</td>
                  <td className="px-3 py-2.5 text-right tabular-nums">{c.reclamos.length || '—'}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(ultimoReclamo(c))}</td>
                  <td className="px-4 py-2.5">
                    <span className={`whitespace-nowrap rounded-md px-2 py-0.5 text-xs font-semibold ${ESTILO[estado]}`}>
                      {NOMBRE_ESTADO_RECLAMO[estado]}
                    </span>
                  </td>
                </tr>
              ))}
              {visibles.length === 0 && (
                <tr>
                  <td colSpan={9} className="px-4 py-10 text-center text-slate-500">
                    No hay facturas vencidas con estos filtros.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">Tocá una factura para registrar un reclamo o ver su historial.</p>

      {seleccionado && <LegajoPanel comprobante={seleccionado} onCerrar={() => setSeleccionadoId(null)} />}
    </>
  )
}
