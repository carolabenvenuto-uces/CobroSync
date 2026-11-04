import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BotonExportar, Card, CardTitulo, EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp } from '../context/AppContext'
import { DIAS_ESCALAR_GERENCIA_GENERAL, PLAZO_ESCANEO_DIAS } from '../domain/semaforo'
import { rankingSucursales } from '../domain/sucursales'
import { anioDe, mesDe } from '../lib/fechas'
import { descargarExcel } from '../lib/exportar'
import { formatoFecha, formatoPesos, MESES } from '../lib/formato'

/** Con menos facturas que esto, los promedios de una sucursal se marcan como poco representativos. */
const MINIMO_REPRESENTATIVO = 100

/**
 * Ranking de sucursales: quién tiene más documentación pendiente y cuánta plata retiene.
 * Se ordena por plata retenida hoy (lo que importa para cobrar), no por promedios,
 * para que una sucursal con pocas facturas no quede arriba por un par de casos.
 */
export default function RankingSucursales() {
  const { datos, hoy, anio, parametros } = useApp()
  const { comprobantes, meta } = datos!
  // 'anio' o el número de mes (todos los meses hasta hoy se pueden elegir)
  const [periodo, setPeriodo] = useState<'anio' | number>('anio')
  const ultimoMes = anioDe(hoy) === anio ? mesDe(hoy) : 12

  const ranking = useMemo(
    () =>
      rankingSucursales(comprobantes, meta.sucursales, hoy, anio, periodo === 'anio' ? null : periodo, parametros).sort(
        (a, b) => b.retenido - a.retenido || b.pendientes - a.pendientes,
      ),
    [comprobantes, meta.sucursales, hoy, anio, periodo, parametros],
  )
  const textoPeriodo = periodo === 'anio' ? `año ${anio}` : `${MESES[periodo - 1].toLowerCase()} ${anio}`
  const totalRetenido = ranking.reduce((s, r) => s + r.retenido, 0)

  const grafico = ranking.map((r) => ({
    sucursal: r.sucursal.nombre,
    enPlazo: r.pendientes - r.atrasados - r.criticos,
    atrasados: r.atrasados,
    criticos: r.criticos,
  }))

  function exportar() {
    descargarExcel(
      `ranking-sucursales-${periodo === 'anio' ? anio : `${anio}-${periodo}`}`,
      [
        'Sucursal',
        'Doc. pendiente hoy',
        `En plazo (hasta ${PLAZO_ESCANEO_DIAS} días)`,
        `Atrasadas (${PLAZO_ESCANEO_DIAS + 1} a ${DIAS_ESCALAR_GERENCIA_GENERAL} días)`,
        `Críticas (más de ${DIAS_ESCALAR_GERENCIA_GENERAL} días)`,
        'Importe retenido hoy',
        '% de lo retenido',
        `Facturas del período (${textoPeriodo})`,
        'Días promedio hasta subir el legajo',
        '% subidas dentro del plazo',
        'Compromisos vencidos',
        'NC sin aviso',
        'Costo estimado de la demora',
      ],
      ranking.map((r) => [
        r.sucursal.nombre,
        r.pendientes,
        r.pendientes - r.atrasados - r.criticos,
        r.atrasados,
        r.criticos,
        r.retenido,
        totalRetenido ? Math.round((r.retenido / totalRetenido) * 100) : 0,
        r.facturas,
        r.diasPromedioEscaneo,
        r.dentroDePlazoPct,
        r.compromisosVencidos,
        r.ncSinInformar,
        r.costoDemora,
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Ranking de sucursales"
        subtitulo={`Documentación pendiente al ${formatoFecha(hoy)}, ordenado por importe retenido. Promedios del ${textoPeriodo}.`}
        acciones={
          <>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Promedios de
              <select
                className={claseSelect}
                value={periodo}
                onChange={(e) => setPeriodo(e.target.value === 'anio' ? 'anio' : Number(e.target.value))}
              >
                <option value="anio">Todo el año {anio}</option>
                {MESES.slice(0, ultimoMes).map((nombre, i) => (
                  <option key={nombre} value={i + 1}>
                    {nombre} {anio}
                    {i + 1 === ultimoMes && anioDe(hoy) === anio ? ' (en curso)' : ''}
                  </option>
                ))}
              </select>
            </label>
            <BotonExportar onClick={exportar} />
          </>
        }
      />

      <Card>
        <CardTitulo>Facturas con documentación pendiente hoy, por sucursal</CardTitulo>
        <div style={{ height: 60 + grafico.length * 44 }}>
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico} layout="vertical" margin={{ top: 0, right: 24, left: 8, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" horizontal={false} stroke="#E2E8F0" />
              <XAxis type="number" tickLine={false} axisLine={false} fontSize={12} allowDecimals={false} />
              <YAxis type="category" dataKey="sucursal" tickLine={false} axisLine={false} fontSize={13} width={120} />
              <Tooltip cursor={{ fill: '#F1F5F9' }} />
              <Legend iconType="circle" />
              <Bar dataKey="enPlazo" name={`En plazo (hasta ${PLAZO_ESCANEO_DIAS} días)`} stackId="p" fill="#F59E0B" />
              <Bar dataKey="atrasados" name={`Atrasadas (${PLAZO_ESCANEO_DIAS + 1} a ${DIAS_ESCALAR_GERENCIA_GENERAL} días)`} stackId="p" fill="#EF4444" />
              <Bar dataKey="criticos" name={`Críticas (más de ${DIAS_ESCALAR_GERENCIA_GENERAL} días)`} stackId="p" fill="#991B1B" radius={[0, 4, 4, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Sucursal</th>
                <th className="px-3 py-3 text-right font-semibold">Importe retenido hoy</th>
                <th className="px-3 py-3 text-right font-semibold">Doc. pendiente</th>
                <th className="px-3 py-3 text-right font-semibold">Atrasadas</th>
                <th className="px-3 py-3 text-right font-semibold">Críticas</th>
                <th className="px-3 py-3 text-right font-semibold">Compromisos vencidos</th>
                <th className="px-3 py-3 text-right font-semibold">NC sin aviso</th>
                <th className="px-3 py-3 text-right font-semibold">Facturas ({periodo === 'anio' ? 'año' : 'mes'})</th>
                <th className="px-3 py-3 text-right font-semibold">Días prom. hasta subir</th>
                <th className="px-4 py-3 text-right font-semibold">Subidas en plazo</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranking.map((r, i) => {
                const pocas = r.facturas < MINIMO_REPRESENTATIVO
                return (
                  <tr key={r.sucursal.nombre}>
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{r.sucursal.nombre}</div>
                      <div className="text-xs text-slate-500">{r.sucursal.gerente}</div>
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="font-bold tabular-nums">{formatoPesos(r.retenido)}</div>
                      <div className="text-xs text-slate-500">
                        {totalRetenido ? Math.round((r.retenido / totalRetenido) * 100) : 0} % del total
                      </div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.pendientes}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${r.atrasados ? 'font-semibold text-sem-rojo' : 'text-slate-400'}`}>{r.atrasados}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${r.criticos ? 'font-semibold text-red-800' : 'text-slate-400'}`}>{r.criticos}</td>
                    <td className={`px-3 py-3 text-right tabular-nums ${r.compromisosVencidos ? 'font-semibold' : 'text-slate-400'}`}>
                      {r.compromisosVencidos}
                    </td>
                    <td className={`px-3 py-3 text-right tabular-nums ${r.ncSinInformar ? 'font-semibold' : 'text-slate-400'}`}>{r.ncSinInformar}</td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.facturas.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-3 text-right tabular-nums">
                      {r.diasPromedioEscaneo ?? '—'}
                      {pocas && <div className="text-[11px] text-slate-400">pocas facturas</div>}
                    </td>
                    <td className="px-4 py-3 text-right tabular-nums">{r.dentroDePlazoPct === null ? '—' : `${r.dentroDePlazoPct} %`}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Los promedios de una sucursal con menos de {MINIMO_REPRESENTATIVO} facturas en el período se marcan como poco
        representativos. El costo de la demora por sucursal está en "Impacto económico".
      </p>
    </>
  )
}
