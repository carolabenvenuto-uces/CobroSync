import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays } from 'lucide-react'
import { FiltroMes, FiltroSucursal } from '../components/Filtros'
import { Card, CardTitulo, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { TODAS_LAS_SUCURSALES, useApp, useComprobantes } from '../context/AppContext'
import { calcularTotales, proyeccionDelMes, saldosPorAseguradora } from '../domain/finanzas'
import { calcularSemaforo } from '../domain/semaforo'
import { rankingSucursales } from '../domain/sucursales'
import type { Comprobante } from '../domain/tipos'
import { anioDe, diaDe, enMes, mesDe, semanaDelMes, semanasDelMes } from '../lib/fechas'
import { formatoFecha, formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'

const SIN_PRESENTAR = ['doc_pendiente', 'doc_atrasada', 'doc_observada', 'en_revision', 'pres_pendiente']

/**
 * Resumen: lo que la gerencia necesita ver de un vistazo, cada dato una sola vez.
 * El detalle está en las demás pantallas.
 */
export default function Resumen() {
  const { datos, anio, mes, sucursal, hoy, parametros } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras, meta, cobrosPrevistos } = datos!

  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const enCurso = anioDe(hoy) === anio && mesDe(hoy) === mes && diaDe(hoy) < diasDelMes
  const nombreMes = MESES[mes - 1].toLowerCase()
  const suma = (lista: Comprobante[]) => lista.reduce((s, c) => s + c.total, 0)

  // Situación de hoy
  const situacion = useMemo(() => {
    const totales = calcularTotales(comprobantes, hoy)
    const etapa = (c: Comprobante) => calcularSemaforo(c, hoy).etapa
    return {
      ...totales,
      sinPresentar: suma(comprobantes.filter((c) => SIN_PRESENTAR.includes(etapa(c)))),
      alDia: suma(comprobantes.filter((c) => etapa(c) === 'al_dia')),
    }
  }, [comprobantes, hoy])

  // El mes: facturado y cobrado, una sola vez, con su detalle por semana
  const delMes = useMemo(() => {
    const fc = comprobantes.filter((c) => c.tipo === 'FC' && enMes(c.fecha, anio, mes))
    const nc = comprobantes.filter((c) => c.tipo === 'NC' && enMes(c.fecha, anio, mes))
    const cobradas = comprobantes.filter((c) => c.estado === 'cobrada' && enMes(c.fechaCobro, anio, mes))
    const hasta = enCurso ? semanaDelMes(hoy) : semanasDelMes(anio, mes)
    const semanas = Array.from({ length: hasta }, (_, i) => ({
      semana: `Sem. ${i + 1} (${i * 7 + 1}-${Math.min((i + 1) * 7, diasDelMes)})`,
      facturado: 0,
      cobrado: 0,
    }))
    for (const c of fc) if (semanaDelMes(c.fecha) <= hasta) semanas[semanaDelMes(c.fecha) - 1].facturado += c.total
    for (const c of cobradas) if (semanaDelMes(c.fechaCobro as string) <= hasta) semanas[semanaDelMes(c.fechaCobro as string) - 1].cobrado += c.total
    return {
      facturas: fc.length,
      facturado: suma(fc),
      nc: suma(nc),
      cobrado: suma(cobradas),
      cobradoDelMes: suma(cobradas.filter((c) => enMes(c.fecha, anio, mes))),
      semanas,
    }
  }, [comprobantes, anio, mes, enCurso, hoy, diasDelMes])

  // Cobros esperados: el mes en curso y el siguiente
  const mesHoy = mesDe(hoy)
  const [mesProyectado, setMesProyectado] = useState(diaDe(hoy) >= 25 ? Math.min(12, mesHoy + 1) : mesHoy)
  const proyeccion = useMemo(() => {
    const ids = new Set(comprobantes.map((c) => c.id))
    return proyeccionDelMes(comprobantes, cobrosPrevistos.filter((cp) => ids.has(cp.comprobanteId)), anioDe(hoy), mesProyectado)
  }, [comprobantes, cobrosPrevistos, hoy, mesProyectado])

  // Dónde está la plata pendiente
  const sucursales = useMemo(
    () => rankingSucursales(datos!.comprobantes, meta.sucursales, hoy, anio, null, parametros).sort((a, b) => b.retenido - a.retenido).slice(0, 3),
    [datos, meta.sucursales, hoy, anio, parametros],
  )
  const companias = useMemo(
    () => saldosPorAseguradora(comprobantes, aseguradoras, hoy).sort((a, b) => b.vencido - a.vencido).filter((s) => s.vencido > 0).slice(0, 3),
    [comprobantes, aseguradoras, hoy],
  )

  const anual = useMemo(() => calcularTotales(comprobantes.filter((c) => anioDe(c.fecha) === anio), hoy), [comprobantes, anio, hoy])

  return (
    <>
      <EncabezadoPagina
        titulo="Resumen"
        subtitulo={`${sucursal === TODAS_LAS_SUCURSALES ? 'Todas las sucursales' : sucursal} · datos al ${formatoFecha(hoy)}`}
        acciones={
          <>
            <FiltroSucursal />
            <FiltroMes />
          </>
        }
      />

      {/* 1. Cómo estamos hoy */}
      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Indicador titulo="Pendiente de cobro" valor={formatoPesos(situacion.pendiente)} tono="marca" ayuda="Todo lo facturado que falta cobrar" />
        <Indicador titulo="Sin presentar" valor={formatoPesos(situacion.sinPresentar)} ayuda="Esperando documentación o presentación" />
        <Indicador titulo="Al día" valor={formatoPesos(situacion.alDia)} ayuda="Presentado, todavía no vence" />
        <Indicador titulo="Vencido" valor={formatoPesos(situacion.vencido)} tono="rojo" ayuda="Presentado, vencido y sin cobrar" />
      </div>

      {/* 2. El mes: un solo lugar para facturado y cobrado */}
      <Card className="mt-4">
        <CardTitulo>
          {MESES[mes - 1]} {anio}
          {enCurso ? ' · en curso' : ''}
        </CardTitulo>
        {enCurso && (
          <p className="-mt-2 mb-3 flex items-center gap-2 text-xs text-blue-900">
            <CalendarDays className="h-3.5 w-3.5" /> Día {diaDe(hoy)} de {diasDelMes}: los totales son parciales.
          </p>
        )}
        <div className="grid gap-4 sm:grid-cols-3">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facturado</div>
            <div className="text-xl font-extrabold tabular-nums">{formatoPesos(delMes.facturado)}</div>
            <div className="text-xs text-slate-500">
              {delMes.facturas.toLocaleString('es-AR')} facturas · NC {formatoPesos(delMes.nc)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Cobrado</div>
            <div className="text-xl font-extrabold tabular-nums text-esmeralda">{formatoPesos(delMes.cobrado)}</div>
            <div className="text-xs text-slate-500">
              De facturas de {nombreMes}: {formatoPesos(delMes.cobradoDelMes)} · de meses anteriores: {formatoPesos(delMes.cobrado - delMes.cobradoDelMes)}
            </div>
          </div>
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Año {anio}</div>
            <div className="text-sm tabular-nums">
              Facturado {formatoPesos(anual.facturado)}
              <br />
              Cobrado {formatoPesos(anual.cobrado)}
            </div>
          </div>
        </div>
        <div className="mt-4 h-56">
          <ResponsiveContainer width="100%" height="100%">
            <BarChart data={delMes.semanas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
              <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
              <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={11} />
              <YAxis tickFormatter={(v: number) => formatoPesosCorto(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
              <Tooltip formatter={(v) => formatoPesos(Number(v))} cursor={{ fill: '#F1F5F9' }} />
              <Legend iconType="circle" />
              <Bar dataKey="facturado" name="Facturado en la semana" fill="#2563EB" radius={[4, 4, 0, 0]} />
              <Bar dataKey="cobrado" name="Cobrado en la semana (de cualquier mes)" fill="#10B981" radius={[4, 4, 0, 0]} />
            </BarChart>
          </ResponsiveContainer>
        </div>
      </Card>

      {/* 3. Cobros esperados (antes, la pestaña Cobros previstos) */}
      <Card className="mt-4">
        <CardTitulo
          accion={
            <select className={claseSelect} value={mesProyectado} onChange={(e) => setMesProyectado(Number(e.target.value))}>
              {[mesHoy, Math.min(12, mesHoy + 1)]
                .filter((m, i, l) => l.indexOf(m) === i)
                .map((m) => (
                  <option key={m} value={m}>
                    {MESES[m - 1]} {anioDe(hoy)}
                  </option>
                ))}
            </select>
          }
        >
          Cobros esperados por semana
        </CardTitulo>
        <p className="-mt-2 mb-3 text-xs text-slate-500">
          Según el vencimiento de las facturas presentadas, y lo que las compañías ya muestran "en proceso de pago".
        </p>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-slate-500">
              <tr>
                <th className="py-2 pr-4 font-semibold">Semana</th>
                <th className="py-2 pr-4 text-right font-semibold">Por vencimiento</th>
                <th className="py-2 text-right font-semibold">Informado por las compañías</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {proyeccion.semanas.map((s) => (
                <tr key={s.semana}>
                  <td className="py-2 pr-4">Semana {s.semana}</td>
                  <td className="py-2 pr-4 text-right tabular-nums">{formatoPesos(s.porVencimiento)}</td>
                  <td className="py-2 text-right tabular-nums">{formatoPesos(s.informado)}</td>
                </tr>
              ))}
            </tbody>
            <tfoot className="font-bold">
              <tr className="border-t border-slate-200">
                <td className="py-2 pr-4">Total</td>
                <td className="py-2 pr-4 text-right tabular-nums">{formatoPesos(proyeccion.totalPorVencimiento)}</td>
                <td className="py-2 text-right tabular-nums">{formatoPesos(proyeccion.totalInformado)}</td>
              </tr>
            </tfoot>
          </table>
        </div>
        <p className="mt-2 text-xs text-slate-500">No incluye lo ya vencido ({formatoPesos(situacion.vencido)}), que se sigue en "Vencidas y reclamos".</p>
      </Card>

      {/* 4. Dónde está la plata pendiente */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitulo accion={<Link to="/app/sucursales" className="text-xs font-semibold text-marca hover:underline">Ver ranking</Link>}>
            Sucursales con mayor importe retenido por documentación
          </CardTitulo>
          <ul className="divide-y divide-slate-100 text-sm">
            {sucursales.map((r) => (
              <li key={r.sucursal.nombre} className="flex justify-between gap-3 py-2">
                <span>
                  <span className="font-semibold">{r.sucursal.nombre}</span>
                  <span className="ml-2 text-xs text-slate-500">
                    {r.pendientes} facturas · {r.criticos} críticas
                  </span>
                </span>
                <span className="font-semibold tabular-nums">{formatoPesos(r.retenido)}</span>
              </li>
            ))}
          </ul>
        </Card>
        <Card>
          <CardTitulo accion={<Link to="/app/saldos" className="text-xs font-semibold text-marca hover:underline">Ver saldos</Link>}>
            Compañías con más vencido sin cobrar
          </CardTitulo>
          <ul className="divide-y divide-slate-100 text-sm">
            {companias.length === 0 && <li className="py-2 text-slate-500">No hay vencidos.</li>}
            {companias.map((s) => (
              <li key={s.aseguradora.id} className="flex justify-between gap-3 py-2">
                <span className="font-semibold">{s.aseguradora.nombre}</span>
                <span className="font-semibold tabular-nums text-red-800">{formatoPesos(s.vencido)}</span>
              </li>
            ))}
          </ul>
        </Card>
      </div>
    </>
  )
}
