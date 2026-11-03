import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Banknote, Clock, Receipt, TrendingUp, Wallet, TriangleAlert } from 'lucide-react'
import { BadgeSemaforo, PuntoSemaforo } from '../components/ui/Badges'
import { Card, CardTitulo, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp, useComprobantes } from '../context/AppContext'
import {
  calcularDso,
  calcularTotales,
  proximosVencimientos,
  serieSemanalDelMes,
  totalesDelMes,
} from '../domain/finanzas'
import { calcularSemaforo } from '../domain/semaforo'
import type { ColorSemaforo } from '../domain/tipos'
import { diffDias, enMes } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'

export default function Dashboard() {
  const { datos, anio, mes, sucursal } = useApp()
  const comprobantes = useComprobantes()
  // El AppLayout solo muestra esta pantalla cuando los datos ya están cargados.
  const { aseguradoras, meta } = datos!
  const corte = meta.fechaCorte

  const totales = useMemo(() => calcularTotales(comprobantes, corte), [comprobantes, corte])
  const delMes = useMemo(() => totalesDelMes(comprobantes, anio, mes), [comprobantes, anio, mes])
  const serie = useMemo(() => serieSemanalDelMes(comprobantes, anio, mes), [comprobantes, anio, mes])
  const dso = useMemo(() => calcularDso(comprobantes, corte), [comprobantes, corte])

  const conSemaforo = useMemo(
    () => comprobantes.map((c) => ({ c, semaforo: calcularSemaforo(c) })),
    [comprobantes],
  )
  const conteo: Record<ColorSemaforo, number> = { rojo: 0, amarillo: 0, verde: 0, neutro: 0 }
  for (const { semaforo } of conSemaforo) conteo[semaforo.color] += 1

  // Prioridades del día: legajos bloqueados, los más viejos primero
  const prioridades = conSemaforo
    .filter((x) => x.semaforo.color === 'rojo')
    .sort((a, b) => a.c.fecha.localeCompare(b.c.fecha))
    .slice(0, 6)

  const [aseguradoraId, setAseguradoraId] = useState(aseguradoras[0]?.id ?? '')
  const deLaCompania = comprobantes.filter((c) => c.aseguradoraId === aseguradoraId)
  const companiaMes = totalesDelMes(deLaCompania, anio, mes)
  const companiaTotales = calcularTotales(deLaCompania, corte)
  const proximos = proximosVencimientos(comprobantes, aseguradoraId, corte)
  const nombreCompania = (id: string) => aseguradoras.find((a) => a.id === id)?.nombre ?? id

  const facturasDelMes = comprobantes.filter((c) => c.tipo === 'FC' && enMes(c.fecha, anio, mes)).length

  return (
    <>
      <EncabezadoPagina
        titulo="Dashboard general"
        subtitulo={`${MESES[mes - 1]} ${anio} · ${sucursal === 'Todas' ? 'Todas las sucursales' : sucursal}`}
      />

      <div className="grid grid-cols-2 gap-4 lg:grid-cols-3 xl:grid-cols-6">
        <Indicador
          titulo="Facturado del mes"
          valor={formatoPesosCorto(delMes.facturado)}
          ayuda={`${facturasDelMes} facturas`}
          icono={<TrendingUp className="h-4 w-4" />}
        />
        <Indicador
          titulo="Notas de crédito"
          valor={formatoPesosCorto(delMes.notasCredito)}
          ayuda="Emitidas en el mes"
          icono={<Receipt className="h-4 w-4" />}
        />
        <Indicador
          titulo="Cobrado en el mes"
          valor={formatoPesosCorto(delMes.cobrado)}
          tono="verde"
          icono={<Banknote className="h-4 w-4" />}
        />
        <Indicador
          titulo="Pendiente total"
          valor={formatoPesosCorto(totales.pendiente)}
          tono="marca"
          ayuda="Facturado + NC − cobrado"
          icono={<Wallet className="h-4 w-4" />}
        />
        <Indicador
          titulo="Vencido"
          valor={formatoPesosCorto(totales.vencido)}
          tono="rojo"
          ayuda="Presentado y sin cobrar"
          icono={<TriangleAlert className="h-4 w-4" />}
        />
        <Indicador
          titulo="DSO"
          valor={dso === null ? '—' : `${dso} días`}
          ayuda="Promedio últimos 90 días"
          icono={<Clock className="h-4 w-4" />}
        />
      </div>

      {/* Semáforo: cada tarjeta lleva al control diario ya filtrado */}
      <div className="mt-4 grid gap-4 sm:grid-cols-3">
        {(['rojo', 'amarillo', 'verde'] as const).map((color) => (
          <Link
            key={color}
            to={`/app/control-diario?semaforo=${color}&periodo=anio`}
            className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-4 shadow-sm transition hover:border-marca/40 hover:shadow"
          >
            <BadgeSemaforo color={color} />
            <span className="text-2xl font-extrabold">{conteo[color]}</span>
          </Link>
        ))}
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        <Card className="lg:col-span-2">
          <CardTitulo>Facturación vs. cobranza por semana · {MESES[mes - 1]}</CardTitulo>
          <div className="h-72">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serie} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis
                  tickFormatter={(v: number) => formatoPesosCorto(v)}
                  tickLine={false}
                  axisLine={false}
                  fontSize={12}
                  width={80}
                />
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
                {a.nombre}
              </option>
            ))}
          </select>
          <dl className="mt-4 space-y-3 text-sm">
            <div className="flex justify-between">
              <dt className="text-slate-500">Facturado en {MESES[mes - 1].toLowerCase()}</dt>
              <dd className="font-semibold">{formatoPesos(companiaMes.facturado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Cobrado en {MESES[mes - 1].toLowerCase()}</dt>
              <dd className="font-semibold text-esmeralda">{formatoPesos(companiaMes.cobrado)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Saldo pendiente</dt>
              <dd className="font-semibold text-marca">{formatoPesos(companiaTotales.pendiente)}</dd>
            </div>
            <div className="flex justify-between">
              <dt className="text-slate-500">Saldo vencido</dt>
              <dd className="font-semibold text-sem-rojo">{formatoPesos(companiaTotales.vencido)}</dd>
            </div>
          </dl>
          <div className="mt-5 border-t border-slate-100 pt-4">
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Próximos vencimientos</div>
            {proximos.length === 0 ? (
              <p className="mt-2 text-sm text-slate-500">Sin vencimientos próximos.</p>
            ) : (
              <ul className="mt-2 space-y-2 text-sm">
                {proximos.map((c) => (
                  <li key={c.id} className="flex justify-between gap-2">
                    <span>
                      {formatoFecha(c.vencimiento)} · <span className="text-slate-500">{formatoComprobante(c)}</span>
                    </span>
                    <span className="font-semibold">{formatoPesosCorto(c.total)}</span>
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
            <Link to="/app/control-diario?semaforo=rojo&periodo=anio" className="text-xs font-semibold text-marca hover:underline">
              Ver todos ({conteo.rojo})
            </Link>
          }
        >
          Prioridades del día: legajos bloqueados más antiguos
        </CardTitulo>
        {prioridades.length === 0 ? (
          <p className="text-sm text-slate-500">No hay legajos bloqueados. ¡Bien!</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="text-xs uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="py-2 pr-4 font-semibold">Fecha</th>
                  <th className="py-2 pr-4 font-semibold">Comprobante</th>
                  <th className="py-2 pr-4 font-semibold">Compañía</th>
                  <th className="py-2 pr-4 font-semibold">Sucursal</th>
                  <th className="py-2 pr-4 font-semibold">Motivo</th>
                  <th className="py-2 text-right font-semibold">Días</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {prioridades.map(({ c, semaforo }) => (
                  <tr key={c.id}>
                    <td className="py-2.5 pr-4 whitespace-nowrap">{formatoFecha(c.fecha)}</td>
                    <td className="py-2.5 pr-4 whitespace-nowrap font-medium">{formatoComprobante(c)}</td>
                    <td className="py-2.5 pr-4">{nombreCompania(c.aseguradoraId)}</td>
                    <td className="py-2.5 pr-4">{c.sucursal}</td>
                    <td className="py-2.5 pr-4">
                      <span className="flex items-center gap-2">
                        <PuntoSemaforo color="rojo" />
                        {semaforo.detalle[0]}
                      </span>
                    </td>
                    <td className="py-2.5 text-right font-semibold text-sem-rojo">{diffDias(c.fecha, corte)}</td>
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
