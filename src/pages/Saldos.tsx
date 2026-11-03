import { useMemo } from 'react'
import { BotonExportar, Card, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { descargarExcel } from '../lib/exportar'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularTotales, saldosPorAseguradora } from '../domain/finanzas'
import { formatoFecha, formatoPesos, formatoPesosCorto } from '../lib/formato'

export default function Saldos() {
  const { datos, sucursal } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras, meta } = datos!

  const saldos = useMemo(
    () => saldosPorAseguradora(comprobantes, aseguradoras, meta.fechaCorte),
    [comprobantes, aseguradoras, meta.fechaCorte],
  )
  const totales = useMemo(() => calcularTotales(comprobantes, meta.fechaCorte), [comprobantes, meta.fechaCorte])

  function exportar() {
    descargarExcel(
      `saldos-por-compania-${meta.fechaCorte}`,
      ['Compañía', 'Plazo de pago (días)', 'Facturado', 'Notas de crédito', 'Cobrado', 'Pendiente', 'Vencido', 'Legajos en rojo'],
      [
        ...saldos.map((s) => [
          s.aseguradora.nombre,
          s.aseguradora.plazoPagoDias,
          s.facturado,
          s.notasCredito,
          s.cobrado,
          s.pendiente,
          s.vencido,
          s.legajosEnRojo,
        ]),
        ['Total', null, totales.facturado, totales.notasCredito, totales.cobrado, totales.pendiente, totales.vencido, null],
      ],
    )
  }

  return (
    <>
      <EncabezadoPagina
        acciones={<BotonExportar onClick={exportar} />}
        titulo="Saldos por compañía"
        subtitulo={`Cuenta corriente acumulada al ${formatoFecha(meta.fechaCorte)} · ${
          sucursal === 'Todas' ? 'Todas las sucursales' : sucursal
        }`}
      />

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-5">
        <Indicador titulo="Facturado" valor={formatoPesosCorto(totales.facturado)} />
        <Indicador titulo="Notas de crédito" valor={formatoPesosCorto(totales.notasCredito)} />
        <Indicador titulo="Cobrado" valor={formatoPesosCorto(totales.cobrado)} tono="verde" />
        <Indicador titulo="Pendiente" valor={formatoPesosCorto(totales.pendiente)} tono="marca" />
        <Indicador titulo="Vencido" valor={formatoPesosCorto(totales.vencido)} tono="rojo" />
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
                <th className="px-3 py-3 text-right font-semibold">Pendiente</th>
                <th className="px-3 py-3 text-right font-semibold">Vencido</th>
                <th className="px-3 py-3 text-center font-semibold">Legajos en rojo</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {saldos.map((s) => (
                <tr key={s.aseguradora.id}>
                  <td className="px-4 py-3">
                    <div className="font-semibold">{s.aseguradora.nombre}</div>
                    <div className="text-xs text-slate-500">
                      {s.aseguradora.email} · paga a {s.aseguradora.plazoPagoDias} días
                    </div>
                  </td>
                  <td className="px-3 py-3 text-right whitespace-nowrap">{formatoPesos(s.facturado)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap text-slate-500">{formatoPesos(s.notasCredito)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap text-emerald-700">{formatoPesos(s.cobrado)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap font-semibold">{formatoPesos(s.pendiente)}</td>
                  <td className="px-3 py-3 text-right whitespace-nowrap font-semibold text-sem-rojo">
                    {s.vencido > 0 ? formatoPesos(s.vencido) : '—'}
                  </td>
                  <td className="px-3 py-3 text-center">{s.legajosEnRojo || '—'}</td>
                  <td className="px-4 py-3">
                    {s.vencido > 0 ? (
                      <span className="rounded-md bg-sem-rojo/10 px-2 py-0.5 text-xs font-semibold text-red-700">
                        Con vencidos
                      </span>
                    ) : (
                      <span className="rounded-md bg-sem-verde/15 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        Al día
                      </span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-fondo font-bold">
              <tr>
                <td className="px-4 py-3">Total</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatoPesos(totales.facturado)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatoPesos(totales.notasCredito)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatoPesos(totales.cobrado)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap">{formatoPesos(totales.pendiente)}</td>
                <td className="px-3 py-3 text-right whitespace-nowrap text-sem-rojo">{formatoPesos(totales.vencido)}</td>
                <td colSpan={2} />
              </tr>
            </tfoot>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Pendiente = Facturado + Notas de crédito − Cobrado. Vencido = facturas presentadas cuyo vencimiento ya pasó.
      </p>
    </>
  )
}
