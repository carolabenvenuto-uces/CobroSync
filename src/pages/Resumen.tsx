import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays } from 'lucide-react'
import { Card, CardTitulo, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { TODAS_LAS_SUCURSALES, useApp, useComprobantes } from '../context/AppContext'
import { calcularTotales, previstoVsCobrado, saldosPorAseguradora, totalesDelMes } from '../domain/finanzas'
import { calcularSemaforo, enGrupo, type GrupoSaldo } from '../domain/semaforo'
import { rankingSucursales } from '../domain/sucursales'
import type { Comprobante } from '../domain/tipos'
import { anioDe, diaDe, mesDe } from '../lib/fechas'
import { formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'
import { saldoFactura } from '../domain/importes'

/**
 * Resumen: lo que la gerencia necesita ver de un vistazo, cada dato una sola vez.
 * 1. Cómo estamos hoy · 2. El año, a la izquierda · 3. El mes elegido: cobros previstos contra
 * lo realmente cobrado · 4. Dónde está la plata pendiente. El detalle está en las demás pantallas.
 */
/** Importes del recuadro del año: se achican con la pantalla para entrar en una línea. */
const GRANDE = { fontSize: 'clamp(1.1rem, 1.6vw, 1.6rem)' }

export default function Resumen() {
  const { datos, anio, mes: mesGlobal, setMes: setMesGlobal, hoy, parametros, sucursal } = useApp()
  // Cada tarjeta abre el Detalle de facturas con ese grupo (y la sucursal elegida)
  const verFacturas = (grupo: GrupoSaldo) =>
    `/app/control-diario?grupo=${grupo}${sucursal === TODAS_LAS_SUCURSALES ? '' : `&sucursal=${encodeURIComponent(sucursal)}`}`
  const comprobantes = useComprobantes()
  const { aseguradoras, meta } = datos!

  // El mes se elige en el mismo cuadro. Se puede mirar también el mes que viene (lo que vence).
  const anioHoy = anioDe(hoy)
  const mesHoy = mesDe(hoy)
  const ultimoMes = anio === anioHoy ? Math.min(12, mesHoy + 1) : 12
  // El mes próximo solo vale acá (las demás pantallas llegan hasta el mes en curso)
  const [mesProximo, setMesProximo] = useState(false)
  const mes = mesProximo ? ultimoMes : mesGlobal
  const setMes = (m: number) => {
    const proximo = anio === anioHoy && m > mesHoy
    setMesProximo(proximo)
    if (!proximo) setMesGlobal(m)
  }
  const diasDelMes = new Date(Date.UTC(anio, mes, 0)).getUTCDate()
  const enCurso = anio === anioHoy && mes === mesHoy && diaDe(hoy) < diasDelMes
  const futuro = anio === anioHoy && mes > mesHoy

  const suma = (lista: Comprobante[]) => lista.reduce((s, c) => s + saldoFactura(c), 0)

  // 1. Situación de hoy
  const situacion = useMemo(() => {
    const totales = calcularTotales(comprobantes, hoy)
    const de = (g: GrupoSaldo) => suma(comprobantes.filter((c) => enGrupo(g, calcularSemaforo(c, hoy).etapa, saldoFactura(c))))
    return { ...totales, sinPresentar: de('sin_presentar'), alDia: de('al_dia') }
  }, [comprobantes, hoy])

  // 2. El año
  const anual = useMemo(() => {
    const delAnio = comprobantes.filter((c) => anioDe(c.fecha) === anio)
    return { ...calcularTotales(delAnio, hoy), facturas: delAnio.filter((c) => c.tipo === 'FC').length }
  }, [comprobantes, anio, hoy])

  // 3. El mes elegido
  const delMes = useMemo(() => totalesDelMes(comprobantes, anio, mes), [comprobantes, anio, mes])
  const previsto = useMemo(() => previstoVsCobrado(comprobantes, anio, mes), [comprobantes, anio, mes])

  // 4. Dónde está la plata pendiente
  const sucursales = useMemo(
    () => rankingSucursales(datos!.comprobantes, meta.sucursales, hoy, anio, null, parametros).sort((a, b) => b.retenido - a.retenido).slice(0, 3),
    [datos, meta.sucursales, hoy, anio, parametros],
  )
  const companias = useMemo(
    () => saldosPorAseguradora(comprobantes, aseguradoras, hoy).sort((a, b) => b.vencido - a.vencido).filter((s) => s.vencido > 0).slice(0, 3),
    [comprobantes, aseguradoras, hoy],
  )

  const selectorMes = (
    <select
      aria-label="Mes"
      value={mes}
      onChange={(e) => setMes(Number(e.target.value))}
      className="rounded-lg border border-slate-200 bg-white py-1 pl-2 pr-7 text-sm font-bold text-noche shadow-sm hover:border-marca/50 focus:border-marca focus:outline-none"
    >
      {MESES.slice(0, ultimoMes).map((nombre, i) => (
        <option key={nombre} value={i + 1}>
          {nombre} {anio}
          {anio === anioHoy && i + 1 === mesHoy ? ' (en curso)' : anio === anioHoy && i + 1 > mesHoy ? ' (próximo)' : ''}
        </option>
      ))}
    </select>
  )

  const dato = (titulo: string, valor: number, ayuda: string, clase = '') => (
    <div>
      <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
      <div className={`whitespace-nowrap font-extrabold tabular-nums ${clase}`} style={{ fontSize: 'clamp(0.95rem, 1.15vw, 1.15rem)' }}>
        {formatoPesos(valor)}
      </div>
      <div className="text-xs text-slate-500">{ayuda}</div>
    </div>
  )

  return (
    <>
      <EncabezadoPagina titulo="Resumen" sucursal />

      {/* 1. Cómo estamos hoy */}
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
        <Indicador to={verFacturas('pendiente')} titulo="Pendiente de cobro" valor={formatoPesos(situacion.pendiente)} tono="marca" ayuda="Todo lo facturado que falta cobrar" />
        <Indicador to={verFacturas('sin_presentar')} titulo="Sin presentar" valor={formatoPesos(situacion.sinPresentar)} ayuda="Esperando documentación o presentación" />
        <Indicador to={verFacturas('al_dia')} titulo="Al día" valor={formatoPesos(situacion.alDia)} ayuda="Presentado, todavía no vence" />
        <Indicador to={verFacturas('vencido')} titulo="Vencido" valor={formatoPesos(situacion.vencido)} tono="rojo" ayuda="Presentado, vencido y sin cobrar" />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-3">
        {/* 2. El año: lo primero que se ve, aparte del mes */}
        <div className="rounded-xl bg-noche p-5 text-white shadow-sm">
          <div className="text-xs font-semibold uppercase tracking-wide text-slate-300">Año {anio}</div>
          <div className="mt-4 space-y-4">
            <div>
              <div className="text-xs text-slate-300">Facturado</div>
              <div className="whitespace-nowrap font-extrabold tabular-nums" style={GRANDE}>{formatoPesos(anual.facturado)}</div>
              <div className="text-xs text-slate-400">
                {anual.facturas.toLocaleString('es-AR')} facturas · notas de crédito {formatoPesos(anual.notasCredito)}
              </div>
            </div>
            <div>
              <div className="text-xs text-slate-300">Cobrado</div>
              <div className="whitespace-nowrap font-extrabold tabular-nums text-emerald-300" style={GRANDE}>{formatoPesos(anual.cobrado)}</div>
            </div>
            <div>
              <div className="text-xs text-slate-300">Falta cobrar de lo facturado en {anio}</div>
              <div className="whitespace-nowrap font-extrabold tabular-nums" style={GRANDE}>{formatoPesos(anual.pendiente)}</div>
              <div className="text-xs text-slate-400">De eso, vencido: {formatoPesos(anual.vencido)}</div>
            </div>
          </div>
        </div>

        {/* 3. El mes: cobros previstos contra lo realmente cobrado */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {selectorMes}
            {enCurso && (
              <span className="flex items-center gap-1.5 text-xs text-blue-900">
                <CalendarDays className="h-3.5 w-3.5" /> Día {diaDe(hoy)} de {diasDelMes}: el mes todavía no terminó
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-3">
            {dato('Facturado en el mes', delMes.facturado, futuro ? 'Todavía no empezó' : `Notas de crédito ${formatoPesos(delMes.notasCredito)}`)}
            {dato('Cobro previsto', previsto.previsto, 'Facturas presentadas que vencen en el mes', 'text-marca')}
            {dato(
              'Cobrado en el mes',
              previsto.cobrado,
              previsto.previstoSinCobrar > 0 ? `De lo previsto falta cobrar ${formatoPesos(previsto.previstoSinCobrar)}` : 'Se cobró todo lo previsto',
              'text-esmeralda',
            )}
          </div>
          <div className="mt-4 h-56">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={previsto.semanas} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="semana" tickLine={false} axisLine={false} fontSize={11} />
                <YAxis tickFormatter={(v: number) => formatoPesosCorto(v)} tickLine={false} axisLine={false} fontSize={12} width={80} />
                <Tooltip formatter={(v) => formatoPesos(Number(v))} cursor={{ fill: '#F1F5F9' }} />
                <Legend iconType="circle" />
                <Bar dataKey="previsto" name="Previsto (por vencimiento)" fill="#2563EB" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cobrado" name="Cobrado" fill="#10B981" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

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
