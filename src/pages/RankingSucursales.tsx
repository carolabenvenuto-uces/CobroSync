import { useMemo, useState } from 'react'
import { BotonExportar, Card, EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp } from '../context/AppContext'
import { textoCritica, textoPlazo } from '../domain/plazos'
import { rankingSucursales } from '../domain/sucursales'
import { anioDe, mesDe } from '../lib/fechas'
import { descargarExcel } from '../lib/exportar'
import { formatoPesos, MESES } from '../lib/formato'

/**
 * Control por sucursal: para cada sucursal, en orden alfabético, cuánto tiene pendiente y qué
 * porcentaje se sube dentro del plazo. Es un control de Cobranzas, no una competencia: no hay
 * posiciones ni gráfico.
 */
export default function RankingSucursales() {
  const { datos, hoy, anio, parametros } = useApp()
  const { comprobantes, meta } = datos!
  // 'anio' o el número de mes (todos los meses hasta hoy se pueden elegir)
  const [periodo, setPeriodo] = useState<'anio' | number>('anio')
  const ultimoMes = anioDe(hoy) === anio ? mesDe(hoy) : 12

  const ranking = useMemo(
    () =>
      rankingSucursales(comprobantes, meta.sucursales, hoy, anio, periodo === 'anio' ? null : periodo, parametros).sort((a, b) =>
        a.sucursal.nombre.localeCompare(b.sucursal.nombre, 'es'),
      ),
    [comprobantes, meta.sucursales, hoy, anio, periodo, parametros],
  )
  const textoPeriodo = periodo === 'anio' ? `año ${anio}` : `${MESES[periodo - 1].toLowerCase()} ${anio}`

  const totalRetenido = ranking.reduce((s, r) => s + r.retenido, 0)

  const pct = (parte: number, total: number) => (total ? Math.round((parte / total) * 100) : null)
  const fueraDePlazo = (r: (typeof ranking)[number]) => pct(r.atrasados + r.criticos, r.pendientes)

  function exportar() {
    descargarExcel(
      `control-por-sucursal-${periodo === 'anio' ? anio : `${anio}-${periodo}`}`,
      [
        'Sucursal',
        `Facturas del período (${textoPeriodo})`,
        '% subidas dentro del plazo',
        'Doc. pendiente hoy',
        `En plazo (hasta ${textoPlazo()})`,
        'Atrasadas (pasaron el plazo)',
        `Críticas (${textoCritica()})`,
        '% de lo pendiente fuera de plazo',
        'Importe retenido hoy',
        '% de lo retenido',
        'Compromisos vencidos',
        'NC sin aviso',
        'Costo estimado de la demora',
      ],
      ranking.map((r) => [
        r.sucursal.nombre,
        r.facturas,
        r.dentroDePlazoPct,
        r.pendientes,
        r.pendientes - r.atrasados - r.criticos,
        r.atrasados,
        r.criticos,
        fueraDePlazo(r),
        r.retenido,
        pct(r.retenido, totalRetenido) ?? 0,
        r.compromisosVencidos,
        r.ncSinInformar,
        r.costoDemora,
      ]),
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Control por sucursal"
        subtitulo={`Sucursales en orden alfabético. Facturas y subidas en plazo del ${textoPeriodo}; lo pendiente, a hoy.`}
        acciones={
          <>
            <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
              Período
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

      <Card className="overflow-hidden p-0">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide">
              <tr className="text-[11px]">
                <th className="bg-fondo px-4 py-2" />
                <th colSpan={2} className="border-l border-white bg-sky-50 px-3 py-2 text-center font-bold text-sky-800">
                  Período ({periodo === 'anio' ? 'año' : 'mes'})
                </th>
                <th colSpan={4} className="border-l border-white bg-amber-50 px-3 py-2 text-center font-bold text-amber-800">
                  Documentación pendiente hoy
                </th>
                <th colSpan={2} className="border-l border-white bg-violet-50 px-3 py-2 text-center font-bold text-violet-800">
                  Seguimiento
                </th>
              </tr>
              <tr className="text-slate-500">
                <th className="bg-fondo px-4 py-3 font-semibold">Sucursal</th>
                <th className="bg-sky-50/60 px-3 py-3 text-right font-semibold">Facturas</th>
                <th className="bg-sky-50/60 px-3 py-3 text-right font-semibold">% subidas en plazo</th>
                <th className="bg-amber-50/60 px-3 py-3 text-right font-semibold">Pendientes</th>
                <th className="bg-amber-50/60 px-3 py-3 text-right font-semibold">Atrasadas / críticas</th>
                <th className="bg-amber-50/60 px-3 py-3 text-right font-semibold">% fuera de plazo</th>
                <th className="bg-amber-50/60 px-3 py-3 text-right font-semibold">Importe retenido</th>
                <th className="bg-violet-50/60 px-3 py-3 text-right font-semibold">Compromisos vencidos</th>
                <th className="bg-violet-50/60 px-4 py-3 text-right font-semibold">NC sin aviso</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {ranking.map((r) => {
                const fuera = fueraDePlazo(r)
                return (
                  <tr key={r.sucursal.nombre}>
                    <td className="px-4 py-3">
                      <div className="font-semibold">{r.sucursal.nombre}</div>
                      <div className="text-xs text-slate-500">{r.sucursal.gerente}</div>
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.facturas.toLocaleString('es-AR')}</td>
                    <td className="px-3 py-3 text-right">
                      <Porcentaje valor={r.dentroDePlazoPct} bueno />
                    </td>
                    <td className="px-3 py-3 text-right tabular-nums">{r.pendientes}</td>
                    <td className="px-3 py-3 text-right tabular-nums whitespace-nowrap">
                      <span className={r.atrasados ? 'font-semibold text-sem-rojo' : 'text-slate-400'}>{r.atrasados}</span>
                      <span className="text-slate-300"> / </span>
                      <span className={r.criticos ? 'font-semibold text-red-800' : 'text-slate-400'}>{r.criticos}</span>
                    </td>
                    <td className="px-3 py-3 text-right">
                      <Porcentaje valor={fuera} />
                    </td>
                    <td className="px-3 py-3 text-right whitespace-nowrap">
                      <div className="font-bold tabular-nums">{formatoPesos(r.retenido)}</div>
                      <div className="text-xs text-slate-500">{pct(r.retenido, totalRetenido) ?? 0} % del total</div>
                    </td>
                    <td className={`px-3 py-3 text-right tabular-nums ${r.compromisosVencidos ? 'font-semibold' : 'text-slate-400'}`}>
                      {r.compromisosVencidos}
                    </td>
                    <td className={`px-4 py-3 text-right tabular-nums ${r.ncSinInformar ? 'font-semibold' : 'text-slate-400'}`}>{r.ncSinInformar}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      </Card>
      <p className="mt-3 text-xs text-slate-500">
        "% fuera de plazo" es la parte de lo pendiente que ya pasó el plazo de {textoPlazo()}. El costo de la demora por sucursal está
        en "Impacto económico".
      </p>
    </>
  )
}

/** Porcentaje con un chip de color suave: verde, ámbar o rojo según qué tan lejos está de lo esperado. */
function Porcentaje({ valor, bueno = false }: { valor: number | null; bueno?: boolean }) {
  if (valor === null) return <span className="text-slate-400">—</span>
  // "bueno": cuanto más alto, mejor (subidas en plazo). Si no, cuanto más bajo, mejor (fuera de plazo).
  const nivel = bueno ? (valor >= 80 ? 0 : valor >= 50 ? 1 : 2) : valor <= 20 ? 0 : valor <= 50 ? 1 : 2
  const clase = ['bg-teal-50 text-teal-800', 'bg-amber-50 text-amber-800', 'bg-red-50 text-red-800'][nivel]
  return <span className={`inline-block rounded-full px-2 py-0.5 text-xs font-bold tabular-nums ${clase}`}>{valor} %</span>
}
