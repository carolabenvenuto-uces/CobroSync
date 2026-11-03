import { useMemo, useState } from 'react'
import { BotonExportar, Card, CardTitulo, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { claseSelect } from '../components/ui/Estados'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularTotales, proyeccionDelMes } from '../domain/finanzas'
import { enMes, mesDe, semanaDelMes } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'

export default function CobrosPrevistos() {
  const { datos, anio } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras, cobrosPrevistos, meta } = datos!

  // Por defecto se proyecta el mes siguiente a la fecha de corte.
  const [mes, setMes] = useState(Math.min(12, mesDe(meta.fechaCorte) + 1))

  // Solo los cobros previstos de las facturas de la sucursal filtrada
  const cobros = useMemo(() => {
    const porId = new Map(comprobantes.map((c) => [c.id, c]))
    return cobrosPrevistos
      .filter((cp) => porId.has(cp.comprobanteId))
      .map((cp) => ({ cp, comprobante: porId.get(cp.comprobanteId)! }))
  }, [comprobantes, cobrosPrevistos])

  const proyeccion = useMemo(
    () => proyeccionDelMes(comprobantes, cobros.map((x) => x.cp), anio, mes),
    [comprobantes, cobros, anio, mes],
  )
  const vencido = useMemo(() => calcularTotales(comprobantes, meta.fechaCorte).vencido, [comprobantes, meta.fechaCorte])

  const delMes = cobros
    .filter(({ cp }) => enMes(cp.fechaIngreso, anio, mes))
    .sort((a, b) => a.cp.fechaIngreso.localeCompare(b.cp.fechaIngreso))
  const nombreCompania = (id: string) => aseguradoras.find((a) => a.id === id)?.nombre ?? id

  function exportar() {
    descargarExcel(
      `cobros-previstos-${anio}-${mes}`,
      ['Semana', 'Por vencimiento', 'Informado por compañías'],
      [
        ...proyeccion.semanas.map((s) => [`Semana ${s.semana}`, s.porVencimiento, s.informado]),
        ['Total', proyeccion.totalPorVencimiento, proyeccion.totalInformado],
        [],
        ['Compañía', 'Comprobante', 'Vto. factura', 'Ingreso previsto', 'Monto', 'Estado'],
        ...delMes.map(({ cp, comprobante }) => [
          nombreCompania(cp.aseguradoraId),
          formatoComprobante(comprobante),
          fechaExcel(comprobante.vencimiento),
          fechaExcel(cp.fechaIngreso),
          cp.monto,
          cp.estado === 'cobrado' ? 'Cobrado' : 'Informado',
        ]),
      ],
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Cobros previstos"
        subtitulo="Vencimiento oficial de las facturas frente a la fecha de ingreso informada por cada compañía"
        acciones={
          <>
            <select className={claseSelect} value={mes} onChange={(e) => setMes(Number(e.target.value))}>
              {MESES.map((nombre, i) => (
                <option key={nombre} value={i + 1}>
                  Proyectar {nombre.toLowerCase()} {anio}
                </option>
              ))}
            </select>
            <BotonExportar onClick={exportar} />
          </>
        }
      />

      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador
          titulo={`Por vencimiento · ${MESES[mes - 1]}`}
          valor={formatoPesosCorto(proyeccion.totalPorVencimiento)}
          ayuda="Facturas presentadas que vencen en el mes"
          tono="marca"
        />
        <Indicador
          titulo={`Informado por compañías · ${MESES[mes - 1]}`}
          valor={formatoPesosCorto(proyeccion.totalInformado)}
          ayuda="Pagos con fecha confirmada"
          tono="verde"
        />
        <Indicador
          titulo="Vencido sin cobrar"
          valor={formatoPesosCorto(vencido)}
          ayuda={`Al ${formatoFecha(meta.fechaCorte)}, de meses anteriores`}
          tono="rojo"
        />
      </div>

      <div className="mt-4 grid grid-cols-2 gap-4 md:grid-cols-3 xl:grid-cols-5">
        {proyeccion.semanas.map((s) => (
          <Card key={s.semana} className="p-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Semana {s.semana}</div>
            <dl className="mt-3 space-y-2">
              <div>
                <dt className="text-xs text-slate-500">Por vencimiento</dt>
                <dd className="whitespace-nowrap text-lg font-bold text-marca">{formatoPesosCorto(s.porVencimiento)}</dd>
              </div>
              <div>
                <dt className="text-xs text-slate-500">Informado</dt>
                <dd className="whitespace-nowrap text-lg font-bold text-esmeralda">{formatoPesosCorto(s.informado)}</dd>
              </div>
            </dl>
          </Card>
        ))}
      </div>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="p-5 pb-0">
          <CardTitulo>Detalle de ingresos de {MESES[mes - 1].toLowerCase()}</CardTitulo>
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">Compañía</th>
                <th className="px-3 py-3 font-semibold">Comprobante</th>
                <th className="px-3 py-3 font-semibold">Vto. factura</th>
                <th className="px-3 py-3 font-semibold">Ingreso previsto</th>
                <th className="px-3 py-3 text-right font-semibold">Monto</th>
                <th className="px-3 py-3 font-semibold">Semana</th>
                <th className="px-4 py-3 font-semibold">Estado</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {delMes.map(({ cp, comprobante }) => (
                <tr key={cp.id}>
                  <td className="px-4 py-2.5 whitespace-nowrap">{nombreCompania(cp.aseguradoraId)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap font-medium">{formatoComprobante(comprobante)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(comprobante.vencimiento)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">{formatoFecha(cp.fechaIngreso)}</td>
                  <td className="px-3 py-2.5 text-right whitespace-nowrap font-semibold">{formatoPesos(cp.monto)}</td>
                  <td className="px-3 py-2.5 whitespace-nowrap">Semana {semanaDelMes(cp.fechaIngreso)}</td>
                  <td className="px-4 py-2.5">
                    {cp.estado === 'cobrado' ? (
                      <span className="rounded-md bg-sem-verde/15 px-2 py-0.5 text-xs font-semibold text-emerald-800">
                        Cobrado
                      </span>
                    ) : (
                      <span className="rounded-md bg-sem-amarillo/15 px-2 py-0.5 text-xs font-semibold text-amber-800">
                        Informado
                      </span>
                    )}
                  </td>
                </tr>
              ))}
              {delMes.length === 0 && (
                <tr>
                  <td colSpan={7} className="px-4 py-10 text-center text-slate-500">
                    No hay ingresos informados para este mes.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </Card>
    </>
  )
}
