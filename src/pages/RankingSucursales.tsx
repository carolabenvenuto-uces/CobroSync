import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, Cell, ReferenceLine, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { BotonExportar, Card, CardTitulo, EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp } from '../context/AppContext'
import { PLAZO_ESCANEO_DIAS } from '../domain/semaforo'
import { rankingSucursales } from '../domain/sucursales'
import { descargarExcel } from '../lib/exportar'
import { formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'

/**
 * Ranking de sucursales: quién cumple con el escaneo y cuánto cuesta la demora.
 * Pensado para gerencia: convierte "siempre tienen una excusa" en datos.
 */
export default function RankingSucursales() {
  const { datos, hoy, anio, mes, parametros } = useApp()
  const { comprobantes, meta } = datos!
  const [periodo, setPeriodo] = useState<'anio' | 'mes'>('anio')

  const ranking = useMemo(
    () => rankingSucursales(comprobantes, meta.sucursales, hoy, anio, periodo === 'mes' ? mes : null, parametros),
    [comprobantes, meta.sucursales, hoy, anio, mes, periodo, parametros],
  )
  const textoPeriodo = periodo === 'mes' ? `${MESES[mes - 1]} ${anio}` : `Año ${anio}`

  const grafico = ranking.map((r) => ({
    sucursal: r.sucursal.nombre.replace('Sucursal ', ''),
    dias: r.diasPromedioEscaneo ?? 0,
  }))

  function exportar() {
    descargarExcel(
      `ranking-sucursales-${periodo === 'mes' ? `${anio}-${mes}` : anio}`,
      [
        'Sucursal',
        'Gerente',
        'Facturas del período',
        'Días promedio hasta escanear',
        '% dentro de 7 días',
        'Pendientes hoy',
        'Atrasados (8-21 días)',
        'Críticos (+21 días)',
        'Compromisos vencidos',
        'NC sin informar',
        'Plata retenida hoy',
        'Costo financiero estimado de la demora',
      ],
      ranking.map((r) => [
        r.sucursal.nombre,
        r.sucursal.gerente,
        r.facturas,
        r.diasPromedioEscaneo,
        r.dentroDePlazoPct,
        r.pendientes,
        r.atrasados,
        r.criticos,
        r.compromisosVencidos,
        r.ncSinInformar,
        r.retenido,
        r.costoDemora,
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Ranking de sucursales"
        subtitulo={`Cumplimiento del escaneo · ${textoPeriodo}. Pendientes y plata retenida: a hoy.`}
        acciones={
          <>
            <select className={claseSelect} value={periodo} onChange={(e) => setPeriodo(e.target.value as 'anio' | 'mes')}>
              <option value="anio">Todo el año</option>
              <option value="mes">Mes del filtro ({MESES[mes - 1]})</option>
            </select>
            <BotonExportar onClick={exportar} />
          </>
        }
      />

      <Card>
        <CardTitulo>Días promedio desde la factura hasta que la sucursal sube el legajo</CardTitulo>
        <div className="h-64">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={grafico} margin={{ top: 16, right: 16, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="sucursal" tickLine={false} axisLine={false} fontSize={12} />
              <YAxis tickLine={false} axisLine={false} fontSize={12} width={32} />
              <Tooltip formatter={(v) => [`${String(v)} días`, 'Promedio']} cursor={{ fill: '#F1F5F9' }} />
              <ReferenceLine
                y={PLAZO_ESCANEO_DIAS}
                stroke="#EF4444"
                strokeDasharray="4 4"
                label={{ value: `Plazo: ${PLAZO_ESCANEO_DIAS} días`, position: 'insideTopRight', fontSize: 11, fill: '#EF4444' }}
              />
              <Bar dataKey="dias" radius={[4, 4, 0, 0]}>
                {grafico.map((g) => (
                  <Cell key={g.sucursal} fill={g.dias > PLAZO_ESCANEO_DIAS ? '#EF4444' : g.dias > PLAZO_ESCANEO_DIAS / 2 ? '#F59E0B' : '#10B981'} />
                ))}
              </Bar>
            </BarChart>
          </ResponsiveContainer>
        </div>
        <p className="mt-2 text-xs text-slate-500">
          Verde: rápido (hasta {PLAZO_ESCANEO_DIAS / 2} días) · Amarillo: dentro del plazo · Rojo: en promedio pasa el plazo.
        </p>
      </Card>

      <Card className="mt-4 overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-4 py-3 font-semibold">#</th>
                <th className="px-3 py-3 font-semibold">Sucursal</th>
                <th className="px-3 py-3 text-right font-semibold">Facturas</th>
                <th className="px-3 py-3 text-right font-semibold">Días prom.</th>
                <th className="px-3 py-3 text-right font-semibold">En plazo</th>
                <th className="px-3 py-3 text-right font-semibold">Pendientes</th>
                <th className="px-3 py-3 text-right font-semibold">Atrasados</th>
                <th className="px-3 py-3 text-right font-semibold">Críticos</th>
                <th className="px-3 py-3 text-right font-semibold">Compromisos vencidos</th>
                <th className="px-3 py-3 text-right font-semibold">NC sin aviso</th>
                <th className="px-3 py-3 text-right font-semibold">Retenido hoy</th>
                <th className="px-4 py-3 text-right font-semibold">Costo demora</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranking.map((r, i) => {
                const lento = (r.diasPromedioEscaneo ?? 0) > PLAZO_ESCANEO_DIAS
                return (
                  <tr key={r.sucursal.nombre}>
                    <td className="px-4 py-3 text-slate-400">{i + 1}</td>
                    <td className="px-3 py-3">
                      <div className="font-semibold">{r.sucursal.nombre}</div>
                      <div className="text-xs text-slate-500">Gerente: {r.sucursal.gerente}</div>
                    </td>
                    <td className="px-3 py-3 text-right">{r.facturas}</td>
                    <td className={`px-3 py-3 text-right font-bold ${lento ? 'text-sem-rojo' : ''}`}>
                      {r.diasPromedioEscaneo ?? '—'}
                    </td>
                    <td className="px-3 py-3 text-right">{r.dentroDePlazoPct === null ? '—' : `${r.dentroDePlazoPct} %`}</td>
                    <td className="px-3 py-3 text-right">{r.pendientes}</td>
                    <td className={`px-3 py-3 text-right ${r.atrasados ? 'font-semibold text-sem-rojo' : 'text-slate-400'}`}>{r.atrasados}</td>
                    <td className={`px-3 py-3 text-right ${r.criticos ? 'font-semibold text-sem-rojo' : 'text-slate-400'}`}>{r.criticos}</td>
                    <td className={`px-3 py-3 text-right ${r.compromisosVencidos ? 'font-semibold' : 'text-slate-400'}`}>
                      {r.compromisosVencidos}
                    </td>
                    <td className={`px-3 py-3 text-right ${r.ncSinInformar ? 'font-semibold' : 'text-slate-400'}`}>{r.ncSinInformar}</td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">{formatoPesosCorto(r.retenido)}</td>
                    <td className="px-4 py-3 text-right whitespace-nowrap font-semibold">{formatoPesos(r.costoDemora)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        Ordenado por días promedio de escaneo, de más lento a más rápido. El costo de la demora se explica en "Impacto
        económico".
      </p>
    </>
  )
}
