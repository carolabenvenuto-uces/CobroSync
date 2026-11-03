import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays } from 'lucide-react'
import { FiltroMes, FiltroSucursal } from '../components/Filtros'
import { AYUDA_ETAPA, BadgeEtapa, ETAPAS_ACTIVAS, quienEtapa } from '../components/ui/Badges'
import { Card, CardTitulo, EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { TODAS_LAS_SUCURSALES, useApp, useComprobantes } from '../context/AppContext'
import { calcularDso, calcularTotales, proximosVencimientos } from '../domain/finanzas'
import { estadoReclamo } from '../domain/reclamos'
import { calcularSemaforo } from '../domain/semaforo'
import type { Comprobante, Etapa } from '../domain/tipos'
import { anioDe, diaDe, diffDias, enMes, mesDe, semanaDelMes, semanasDelMes } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'

/** Una fila del informe: título, cantidad de comprobantes y monto completo. */
function Fila({ titulo, cantidad, monto, ayuda, fuerte }: { titulo: string; cantidad?: number; monto: number; ayuda?: string; fuerte?: boolean }) {
  return (
    <div className={`flex items-baseline justify-between gap-4 py-2.5 ${fuerte ? 'font-bold' : ''}`}>
      <div>
        <div className={fuerte ? 'text-noche' : 'text-slate-700'}>{titulo}</div>
        {ayuda && <div className="text-xs font-normal text-slate-500">{ayuda}</div>}
      </div>
      <div className="text-right">
        <div className="whitespace-nowrap tabular-nums">{formatoPesos(monto)}</div>
        {cantidad !== undefined && (
          <div className="text-xs font-normal text-slate-500">
            {cantidad.toLocaleString('es-AR')} comprobantes
          </div>
        )}
      </div>
    </div>
  )
}

export default function Dashboard() {
  const { datos, anio, mes, sucursal, hoy } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!

  // ¿El mes elegido es el mes en curso (y todavía no terminó)?
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const enCurso = anioDe(hoy) === anio && mesDe(hoy) === mes && diaDe(hoy) < diasDelMes

  const delMes = useMemo(() => {
    const fc = comprobantes.filter((c) => c.tipo === 'FC' && enMes(c.fecha, anio, mes))
    const nc = comprobantes.filter((c) => c.tipo === 'NC' && enMes(c.fecha, anio, mes))
    const cobradas = comprobantes.filter((c) => c.estado === 'cobrada' && enMes(c.fechaCobro, anio, mes))
    const deEsteMes = cobradas.filter((c) => enMes(c.fecha, anio, mes))
    const suma = (lista: Comprobante[]) => lista.reduce((s, c) => s + c.total, 0)
    return {
      facturas: fc.length,
      facturado: suma(fc),
      ncCantidad: nc.length,
      nc: suma(nc),
      cobradas: cobradas.length,
      cobrado: suma(cobradas),
      cobradoDelMes: suma(deEsteMes),
      cobradoAnteriores: suma(cobradas) - suma(deEsteMes),
    }
  }, [comprobantes, anio, mes])

  const anual = useMemo(() => {
    const delAnio = comprobantes.filter((c) => anioDe(c.fecha) === anio)
    return { ...calcularTotales(delAnio, hoy), cantidad: delAnio.filter((c) => c.tipo === 'FC').length }
  }, [comprobantes, anio, hoy])

  // Situación de hoy por etapa (todas las facturas abiertas, de cualquier mes)
  const porEtapa = useMemo(() => {
    const r = Object.fromEntries(ETAPAS_ACTIVAS.map((e) => [e, { cantidad: 0, total: 0 }])) as Record<Etapa, { cantidad: number; total: number }>
    for (const c of comprobantes) {
      const e = calcularSemaforo(c, hoy).etapa
      if (r[e]) {
        r[e].cantidad += 1
        r[e].total += c.total
      }
    }
    return r
  }, [comprobantes, hoy])
  const pendienteAbierto = ETAPAS_ACTIVAS.reduce((s, e) => s + porEtapa[e].total, 0)
  const facturasAbiertas = ETAPAS_ACTIVAS.reduce((s, e) => s + porEtapa[e].cantidad, 0)

  // Semanas del mes: solo las transcurridas si el mes está en curso
  const serie = useMemo(() => {
    const semanas = semanasDelMes(anio, mes)
    const hasta = enCurso ? semanaDelMes(hoy) : semanas
    const filas = Array.from({ length: hasta }, (_, i) => ({
      semana: `Sem. ${i + 1} (${i * 7 + 1}-${Math.min((i + 1) * 7, diasDelMes)})${enCurso && i + 1 === hasta ? ' en curso' : ''}`,
      facturado: 0,
      cobrado: 0,
    }))
    for (const c of comprobantes) {
      if (c.tipo !== 'FC') continue
      if (enMes(c.fecha, anio, mes) && semanaDelMes(c.fecha) <= hasta) filas[semanaDelMes(c.fecha) - 1].facturado += c.total
      if (c.estado === 'cobrada' && enMes(c.fechaCobro, anio, mes) && semanaDelMes(c.fechaCobro) <= hasta) {
        filas[semanaDelMes(c.fechaCobro) - 1].cobrado += c.total
      }
    }
    return filas
  }, [comprobantes, anio, mes, enCurso, hoy, diasDelMes])

  const dso = useMemo(() => calcularDso(comprobantes, hoy), [comprobantes, hoy])

  // Lo más urgente: documentación atrasada más antigua y vencidas para escalar
  const urgentes = useMemo(
    () =>
      comprobantes
        .map((c) => ({ c, s: calcularSemaforo(c, hoy) }))
        .filter((x) => x.s.etapa === 'doc_atrasada' || x.s.etapa === 'doc_observada')
        .sort((a, b) => a.c.fecha.localeCompare(b.c.fecha))
        .slice(0, 6),
    [comprobantes, hoy],
  )
  const paraEscalar = comprobantes.filter((c) => estadoReclamo(c, hoy) === 'escalar').length
  const sinReclamar = comprobantes.filter((c) => estadoReclamo(c, hoy) === 'sin_reclamar').length

  const [aseguradoraId, setAseguradoraId] = useState(aseguradoras[0]?.id ?? '')
  const deLaCompania = comprobantes.filter((c) => c.aseguradoraId === aseguradoraId)
  const companiaTotales = calcularTotales(deLaCompania, hoy)
  const companiaMes = deLaCompania.filter((c) => c.tipo === 'FC' && enMes(c.fecha, anio, mes)).reduce((s, c) => s + c.total, 0)
  const companiaCobrado = deLaCompania
    .filter((c) => c.estado === 'cobrada' && enMes(c.fechaCobro, anio, mes))
    .reduce((s, c) => s + c.total, 0)
  const proximos = proximosVencimientos(comprobantes, aseguradoraId, hoy)
  const nombreCompania = (id: string) => aseguradoras.find((a) => a.id === id)?.nombre ?? id
  const nombreMes = MESES[mes - 1]

  return (
    <>
      <EncabezadoPagina
        titulo="Inicio"
        subtitulo={`${sucursal === TODAS_LAS_SUCURSALES ? 'Todas las sucursales' : sucursal} · datos al ${formatoFecha(hoy)}`}
        acciones={
          <>
            <FiltroSucursal />
            <FiltroMes />
          </>
        }
      />

      {enCurso && (
        <div className="mb-4 flex items-center gap-2 rounded-lg border border-marca/20 bg-marca/5 px-4 py-2.5 text-sm text-blue-900">
          <CalendarDays className="h-4 w-4" />
          {nombreMes} está en curso: día {diaDe(hoy)} de {diasDelMes}. Los totales del mes son parciales.
        </div>
      )}

      <div className="grid gap-4 lg:grid-cols-2">
        {/* Como el "Informe mensual" de la planilla */}
        <Card>
          <CardTitulo>
            Informe de {nombreMes.toLowerCase()} {anio}
            {enCurso ? ' (parcial)' : ''}
          </CardTitulo>
          <div className="divide-y divide-slate-100 text-sm">
            <Fila titulo={`Facturado en ${nombreMes.toLowerCase()}`} cantidad={delMes.facturas} monto={delMes.facturado} />
            <Fila titulo="Notas de crédito del mes" cantidad={delMes.ncCantidad} monto={delMes.nc} />
            <Fila
              titulo={`Cobrado en ${nombreMes.toLowerCase()}`}
              cantidad={delMes.cobradas}
              monto={delMes.cobrado}
              ayuda={`De facturas de ${nombreMes.toLowerCase()}: ${formatoPesos(delMes.cobradoDelMes)} · de meses anteriores: ${formatoPesos(delMes.cobradoAnteriores)}`}
            />
          </div>
        </Card>

        {/* Como el "Informe general" de la planilla */}
        <Card>
          <CardTitulo>Informe general {anio}</CardTitulo>
          <div className="divide-y divide-slate-100 text-sm">
            <Fila titulo="Total facturado" cantidad={anual.cantidad} monto={anual.facturado} />
            <Fila titulo="Total notas de crédito" monto={anual.notasCredito} />
            <Fila titulo="Total cobrado" monto={anual.cobrado} />
            <Fila titulo="Total pendiente" monto={anual.pendiente} ayuda="Facturado + notas de crédito − cobrado" fuerte />
          </div>
          <p className="mt-2 text-xs text-slate-500">
            Días promedio de cobro (últimos 90 días): <strong>{dso ?? '—'}</strong>
          </p>
        </Card>
      </div>

      {/* Situación de hoy por estado, con los nombres de la planilla */}
      <Card className="mt-4 overflow-hidden p-0">
        <div className="p-5 pb-2">
          <CardTitulo>
            Facturas abiertas hoy por estado · {facturasAbiertas.toLocaleString('es-AR')} facturas por {formatoPesos(pendienteAbierto)}
          </CardTitulo>
        </div>
        <table className="w-full text-left text-sm">
          <thead className="bg-fondo text-xs uppercase tracking-wide text-slate-500">
            <tr>
              <th className="px-5 py-2.5 font-semibold">Estado</th>
              <th className="px-3 py-2.5 font-semibold">Qué significa</th>
              <th className="px-3 py-2.5 font-semibold">Le toca a</th>
              <th className="px-3 py-2.5 text-right font-semibold">Facturas</th>
              <th className="px-5 py-2.5 text-right font-semibold">Monto</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {ETAPAS_ACTIVAS.map((e) => (
              <tr key={e} className="hover:bg-marca/5">
                <td className="px-5 py-2.5">
                  <Link to={`/app/control-diario?etapa=${e}&periodo=anio`}>
                    <BadgeEtapa etapa={e} />
                  </Link>
                </td>
                <td className="px-3 py-2.5 text-slate-600">{AYUDA_ETAPA[e]}</td>
                <td className="px-3 py-2.5">{quienEtapa(e)}</td>
                <td className="px-3 py-2.5 text-right tabular-nums">{porEtapa[e].cantidad.toLocaleString('es-AR')}</td>
                <td className="px-5 py-2.5 text-right font-semibold tabular-nums whitespace-nowrap">{formatoPesos(porEtapa[e].total)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        <div className="flex flex-wrap gap-4 border-t border-slate-100 px-5 py-3 text-sm">
          <Link to="/app/pendientes" className="font-semibold text-marca hover:underline">
            Ver documentación pendiente por sucursal →
          </Link>
          <Link to="/app/reclamos" className="font-semibold text-marca hover:underline">
            Vencidas: {sinReclamar} sin reclamar · {paraEscalar} para escalar →
          </Link>
        </div>
      </Card>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitulo>
            Facturado y cobrado por semana · {nombreMes} {anio}
          </CardTitulo>
          <p className="-mt-2 mb-3 text-xs text-slate-500">
            Facturado: facturas emitidas en la semana. Cobrado: pagos recibidos en la semana, de facturas de cualquier mes.
            {enCurso && ' Se muestran solo las semanas transcurridas.'}
          </p>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickFormatter={(v: number) => formatoPesosCorto(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                <Tooltip formatter={(v) => formatoPesos(Number(v))} cursor={{ fill: '#F1F5F9' }} />
                <Legend iconType="circle" />
                <Bar dataKey="facturado" name="Facturado" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cobrado" name="Cobrado" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitulo>Consulta por compañía</CardTitulo>
          <select className={`${claseSelect} w-full`} value={aseguradoraId} onChange={(e) => setAseguradoraId(e.target.value)}>
            {aseguradoras.map((a) => (
              <option key={a.id} value={a.id}>
                {a.nombre} · paga a {a.plazoPagoDias} días
              </option>
            ))}
          </select>
          <div className="mt-2 divide-y divide-slate-100 text-sm">
            <Fila titulo={`Facturado en ${nombreMes.toLowerCase()}`} monto={companiaMes} />
            <Fila titulo={`Cobrado en ${nombreMes.toLowerCase()}`} monto={companiaCobrado} />
            <Fila titulo="Saldo pendiente" monto={companiaTotales.pendiente} />
            <Fila titulo="Saldo vencido" monto={companiaTotales.vencido} fuerte />
          </div>
          <div className="mt-3 border-t border-slate-100 pt-3">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximos vencimientos</div>
            {proximos.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin vencimientos próximos.</p>
            ) : (
              <ul className="mt-2 space-y-1.5 text-sm">
                {proximos.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span>
                      {formatoFecha(c.vencimiento)} · <span className="text-slate-500">{formatoComprobante(c)}</span>
                    </span>
                    <span className="whitespace-nowrap font-semibold tabular-nums">{formatoPesos(c.total)}</span>
                  </li>
                ))}
              </ul>
            )}
          </div>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitulo
          accion={
            <Link to="/app/pendientes" className="text-xs font-semibold text-marca hover:underline">
              Ver todas
            </Link>
          }
        >
          Para reclamar hoy a las sucursales: documentación atrasada más antigua
        </CardTitulo>
        {urgentes.length === 0 ? (
          <p className="text-sm text-slate-500">No hay documentación atrasada.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Fecha</th>
                  <th className="py-2 pr-4 font-semibold">Comprobante</th>
                  <th className="py-2 pr-4 font-semibold">Sucursal</th>
                  <th className="py-2 pr-4 font-semibold">Compañía</th>
                  <th className="py-2 pr-4 text-right font-semibold">Total</th>
                  <th className="py-2 pr-4 font-semibold">Qué falta</th>
                  <th className="py-2 text-right font-semibold">Días</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {urgentes.map(({ c, s }) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap font-medium">{formatoComprobante(c)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{c.sucursal}</td>
                    <td className="py-2.5 pr-4">{nombreCompania(c.aseguradoraId)}</td>
                    <td className="py-2.5 pr-4 text-right whitespace-nowrap tabular-nums">{formatoPesos(c.total)}</td>
                    <td className="py-2.5 pr-4 text-xs text-slate-600">{s.detalle.slice(1).join(' · ') || s.detalle[0]}</td>
                    <td className="py-2.5 text-right font-semibold text-sem-rojo">{diffDias(c.fecha, hoy)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </Card>
    </>
  )
}
