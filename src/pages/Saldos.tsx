import { useMemo } from 'react'
import { Link } from 'react-router-dom'
import { FiltroSucursal } from '../components/Filtros'
import { BotonExportar, Card, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { TODAS_LAS_SUCURSALES, useApp, useComprobantes } from '../context/AppContext'
import { calcularTotales, saldosPorAseguradora } from '../domain/finanzas'
import { estadoReclamo } from '../domain/reclamos'
import { calcularSemaforo } from '../domain/semaforo'
import { descargarExcel } from '../lib/exportar'
import { formatoFecha, formatoPesos } from '../lib/formato'

/**
 * Saldos por compañía: como el "Detalle por compañía" de la planilla, separando lo
 * pendiente en sin presentar, al día y vencido, y lo vencido según si ya se reclamó.
 */
export default function Saldos() {
  const { datos, sucursal, hoy } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!

  const filas = useMemo(
    () =>
      saldosPorAseguradora(comprobantes, aseguradoras, hoy).map((s) => {
        const propias = comprobantes.filter((c) => c.aseguradoraId === s.aseguradora.id)
        const suma = (f: (c: (typeof propias)[number]) => boolean) => propias.filter(f).reduce((t, c) => t + c.total, 0)
        const etapa = (c: (typeof propias)[number]) => calcularSemaforo(c, hoy).etapa
        return {
          ...s,
          sinPresentar: suma((c) => ['doc_pendiente', 'doc_atrasada', 'doc_observada', 'pres_pendiente'].includes(etapa(c))),
          alDia: suma((c) => etapa(c) === 'al_dia'),
          vencidoSinReclamar: suma((c) => estadoReclamo(c, hoy) === 'sin_reclamar'),
          vencidoParaEscalar: suma((c) => estadoReclamo(c, hoy) === 'escalar'),
          facturasVencidas: propias.filter((c) => etapa(c) === 'vencida').length,
        }
      }),
    [comprobantes, aseguradoras, hoy],
  )
  const totales = useMemo(() => calcularTotales(comprobantes, hoy), [comprobantes, hoy])
  const total = (k: 'sinPresentar' | 'alDia' | 'vencidoSinReclamar' | 'vencidoParaEscalar') => filas.reduce((s, f) => s + f[k], 0)

  function exportar() {
    descargarExcel(
      `saldos-por-compania-${hoy}`,
      ['Compañía', 'Plazo de pago (días)', 'Facturado', 'Notas de crédito', 'Cobrado', 'Pendiente total', 'Sin presentar', 'Al día', 'Vencido', 'Vencido sin reclamar', 'Vencido para escalar'],
      [
        ...filas.map((s) => [
          s.aseguradora.nombre,
          s.aseguradora.plazoPagoDias,
          s.facturado,
          s.notasCredito,
          s.cobrado,
          s.pendiente,
          s.sinPresentar,
          s.alDia,
          s.vencido,
          s.vencidoSinReclamar,
          s.vencidoParaEscalar,
        ]),
        ['Total', null, totales.facturado, totales.notasCredito, totales.cobrado, totales.pendiente, total('sinPresentar'), total('alDia'), totales.vencido, total('vencidoSinReclamar'), total('vencidoParaEscalar')],
      ],
    )
  }

  const celda = 'px-3 py-3 text-right whitespace-nowrap tabular-nums'

  return (
    <>
      <EncabezadoPagina
        titulo="Saldos por compañía"
        subtitulo={`Cuenta corriente al ${formatoFecha(hoy)} · ${sucursal === TODAS_LAS_SUCURSALES ? 'todas las sucursales' : sucursal}`}
        acciones={
          <>
            <FiltroSucursal />
            <BotonExportar onClick={exportar} />
          </>
        }
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Indicador titulo="Pendiente total" valor={formatoPesos(totales.pendiente)} tono="marca" ayuda="Facturado + NC − cobrado" />
        <Indicador titulo="Sin presentar" valor={formatoPesos(total('sinPresentar'))} ayuda="Doc. pendiente y pres. pendiente" />
        <Indicador titulo="Al día" valor={formatoPesos(total('alDia'))} ayuda="Presentado, todavía no vence" />
        <Indicador
          titulo="Vencido"
          valor={formatoPesos(totales.vencido)}
          tono="rojo"
          ayuda={`Sin reclamar: ${formatoPesos(total('vencidoSinReclamar'))}`}
        />
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Compañía</th>
                <th className="px-3 py-3 text-right font-semibold">Facturado</th>
                <th className="px-3 py-3 text-right font-semibold">Notas de crédito</th>
                <th className="px-3 py-3 text-right font-semibold">Cobrado</th>
                <th className="px-3 py-3 text-right font-semibold">Pendiente total</th>
                <th className="px-3 py-3 text-right font-semibold">Sin presentar</th>
                <th className="px-3 py-3 text-right font-semibold">Al día</th>
                <th className="px-3 py-3 text-right font-semibold">Vencido</th>
                <th className="px-4 py-3 font-semibold">Reclamos</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {filas.map((s) => (
                <tr key={s.aseguradora.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{s.aseguradora.nombre}</div>
                    <div className="text-xs text-slate-500">Paga a {s.aseguradora.plazoPagoDias} días de la presentación</div>
                  </td>
                  <td className={celda}>{formatoPesos(s.facturado)}</td>
                  <td className={`${celda} text-slate-500`}>{formatoPesos(s.notasCredito)}</td>
                  <td className={`${celda} text-emerald-700`}>{formatoPesos(s.cobrado)}</td>
                  <td className={`${celda} font-semibold`}>{formatoPesos(s.pendiente)}</td>
                  <td className={celda}>{formatoPesos(s.sinPresentar)}</td>
                  <td className={celda}>{formatoPesos(s.alDia)}</td>
                  <td className={`${celda} font-semibold ${s.vencido > 0 ? 'text-red-800' : 'text-slate-400'}`}>
                    {s.vencido > 0 ? formatoPesos(s.vencido) : '—'}
                    {s.facturasVencidas > 0 && <div className="text-xs font-normal text-slate-500">{s.facturasVencidas} facturas</div>}
                  </td>
                  <td className="px-4 py-3 text-xs">
                    {s.vencido === 0 ? (
                      <span className="text-slate-400">—</span>
                    ) : (
                      <Link to={`/app/reclamos?compania=${s.aseguradora.id}`} className="block space-y-0.5 hover:underline">
                        {s.vencidoSinReclamar > 0 && (
                          <div className="font-semibold text-red-800">Sin reclamar: {formatoPesos(s.vencidoSinReclamar)}</div>
                        )}
                        {s.vencidoParaEscalar > 0 && (
                          <div className="font-semibold text-amber-800">Para escalar: {formatoPesos(s.vencidoParaEscalar)}</div>
                        )}
                        {s.vencidoSinReclamar === 0 && s.vencidoParaEscalar === 0 && <div className="text-slate-600">Reclamado</div>}
                      </Link>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-fondo font-bold">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td className={celda}>{formatoPesos(totales.facturado)}</td>
                <td className={celda}>{formatoPesos(totales.notasCredito)}</td>
                <td className={celda}>{formatoPesos(totales.cobrado)}</td>
                <td className={celda}>{formatoPesos(totales.pendiente)}</td>
                <td className={celda}>{formatoPesos(total('sinPresentar'))}</td>
                <td className={celda}>{formatoPesos(total('alDia'))}</td>
                <td className={`${celda} text-red-800`}>{formatoPesos(totales.vencido)}</td>
                <td />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Pendiente total = facturado + notas de crédito − cobrado = sin presentar + al día + vencido.
      </p>
    </>
  )
}
