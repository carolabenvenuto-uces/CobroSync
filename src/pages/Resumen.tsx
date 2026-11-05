import { useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { CalendarDays, Printer } from 'lucide-react'
import { Card, CardTitulo, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { TODAS_LAS_SUCURSALES, useApp, useComprobantes } from '../context/AppContext'
import { calcularTotales, previstoVsCobrado, saldosPorAseguradora, totalesDelMes } from '../domain/finanzas'
import { calcularSemaforo, enGrupo, type GrupoSaldo } from '../domain/semaforo'
import { rankingSucursales } from '../domain/sucursales'
import type { Comprobante } from '../domain/tipos'
import { anioDe, diaDe, enMes, mesDe } from '../lib/fechas'
import { formatoFecha, formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'
import { saldoFactura } from '../domain/importes'

/**
 * Resumen: lo que la gerencia necesita ver de un vistazo, cada dato una sola vez.
 * 1. El año, a la izquierda · 2. El mes elegido: cobros previstos contra lo realmente cobrado ·
 * 3. Lo pendiente de hoy (el total una sola vez, y en qué etapa está) · 4. Dónde está esa plata.
 * El detalle está en las demás pantallas.
 */
/** Importes del recuadro del año: se achican con la pantalla para entrar en una línea. */
const GRANDE = { fontSize: 'clamp(1.05rem, 1.4vw, 1.45rem)' }

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
  const pasado = anio < anioHoy || (anio === anioHoy && mes < mesHoy)

  const suma = (lista: Comprobante[]) => lista.reduce((s, c) => s + saldoFactura(c), 0)

  // 1. Situación de hoy
  const situacion = useMemo(() => {
    const totales = calcularTotales(comprobantes, hoy)
    const de = (g: GrupoSaldo) => suma(comprobantes.filter((c) => enGrupo(g, calcularSemaforo(c, hoy).etapa, saldoFactura(c))))
    return { ...totales, sinPresentar: de('sin_presentar'), alDia: de('al_dia') }
  }, [comprobantes, hoy])

  const pct = (v: number) => (situacion.pendiente > 0 ? Math.round((v / situacion.pendiente) * 100) : 0)

  // 2. El año
  const anual = useMemo(() => {
    const delAnio = comprobantes.filter((c) => anioDe(c.fecha) === anio)
    return { ...calcularTotales(delAnio, hoy), facturas: delAnio.filter((c) => c.tipo === 'FC').length }
  }, [comprobantes, anio, hoy])

  // 3. El mes elegido
  const delMes = useMemo(
    () => ({
      ...totalesDelMes(comprobantes, anio, mes),
      facturas: comprobantes.filter((c) => c.tipo === 'FC' && enMes(c.fecha, anio, mes)).length,
    }),
    [comprobantes, anio, mes],
  )
  const previsto = useMemo(() => previstoVsCobrado(comprobantes, anio, mes), [comprobantes, anio, mes])

  // 4. Dónde está la plata pendiente
  const ranking = useMemo(
    () => rankingSucursales(datos!.comprobantes, meta.sucursales, hoy, anio, null, parametros).sort((a, b) => b.retenido - a.retenido),
    [datos, meta.sucursales, hoy, anio, parametros],
  )
  const sucursales = ranking.slice(0, 3)
  const unaSucursal = sucursal === TODAS_LAS_SUCURSALES ? null : (ranking.find((r) => r.sucursal.nombre === sucursal) ?? null)
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
      {/* Encabezado que sale solo al imprimir */}
      <div className="solo-impresion mb-4 border-b border-slate-300 pb-2">
        <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">CobroSync · Resumen para Gerencia</div>
        <div className="text-lg font-extrabold">
          {sucursal === TODAS_LAS_SUCURSALES ? 'Todas las sucursales' : `Sucursal ${sucursal}`} · al {formatoFecha(hoy)}
        </div>
      </div>
      <div className="no-imprimir">
        <EncabezadoPagina
          titulo="Resumen"
          sucursal
          acciones={
            <button
              type="button"
              onClick={() => window.print()}
              className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-semibold text-noche shadow-sm hover:bg-fondo"
              title="Abre la ventana de impresión: impresora o «Guardar como PDF»"
            >
              <Printer className="h-4 w-4 text-marca" /> Imprimir o guardar en PDF
            </button>
          }
        />
      </div>

      <div className="grid gap-4 lg:grid-cols-3">
        {/* 2. El año: lo primero que se ve, aparte del mes. Mismo formato que los datos del mes */}
        <div className="flex flex-col rounded-xl border border-marca/20 bg-indigo-50/70 p-5 shadow-sm">
          <div className="text-sm font-bold uppercase tracking-wide text-marca">Año {anio}</div>
          {(() => {
            const nc = Math.abs(anual.notasCredito)
            const base = anual.facturado || 1
            const falta = Math.max(0, anual.facturado - anual.cobrado - nc)
            const pct = (v: number) => `${((v / base) * 100).toLocaleString('es-AR', { maximumFractionDigits: 1 })} %`
            const partes = [
              { titulo: 'Cobrado', valor: anual.cobrado, color: 'bg-sem-verde', texto: 'text-teal-800' },
              { titulo: 'Notas de crédito', valor: nc, color: 'bg-red-700', texto: 'text-red-800' },
              { titulo: 'Falta cobrar', valor: falta, color: 'bg-sem-amarillo', texto: 'text-amber-900' },
            ]
            return (
              <div className="mt-4 flex flex-1 flex-col gap-4">
                <div>
                  <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Facturado</div>
                  <div className="whitespace-nowrap font-extrabold tabular-nums text-noche" style={GRANDE}>
                    {formatoPesos(anual.facturado)}
                  </div>
                  <div className="text-xs text-slate-500">{anual.facturas.toLocaleString('es-AR')} facturas</div>
                  {/* Cómo se reparte lo facturado: cada parte abajo lleva su color y su porcentaje */}
                  <div className="mt-3 flex h-3 overflow-hidden rounded-full bg-slate-100" role="img" aria-label={partes.map((x) => `${x.titulo} ${pct(x.valor)}`).join(', ')}>
                    {partes.map((x) => (
                      <div key={x.titulo} className={x.color} style={{ width: `${(x.valor / base) * 100}%` }} />
                    ))}
                  </div>
                </div>
                {partes.map((x) => (
                  <div key={x.titulo}>
                    <div className="flex items-center justify-between gap-2 text-xs font-semibold uppercase tracking-wide text-slate-500">
                      <span className="flex items-center gap-1.5">
                        <span className={`h-2.5 w-2.5 shrink-0 rounded-full ${x.color}`} aria-hidden="true" /> {x.titulo}
                      </span>
                      <span className={`tabular-nums normal-case ${x.texto}`}>{pct(x.valor)}</span>
                    </div>
                    <div className={`whitespace-nowrap font-extrabold tabular-nums ${x.texto}`} style={GRANDE}>
                      {formatoPesos(x.titulo === 'Notas de crédito' ? -x.valor : x.valor)}
                    </div>
                  </div>
                ))}
              </div>
            )
          })()}
        </div>

        {/* 3. El mes: cobros previstos contra lo realmente cobrado */}
        <Card className="lg:col-span-2">
          <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
            {selectorMes}
            {enCurso && (
              <span className="flex items-center gap-1.5 text-xs text-indigo-900">
                <CalendarDays className="h-3.5 w-3.5" /> Día {diaDe(hoy)} de {diasDelMes}: el mes todavía no terminó
              </span>
            )}
          </div>
          <div className="grid gap-4 sm:grid-cols-2 2xl:grid-cols-4">
            {dato('Facturado en el mes', delMes.facturado, futuro ? 'Todavía no empezó' : `${delMes.facturas.toLocaleString('es-AR')} facturas`)}
            {dato('Notas de crédito', -Math.abs(delMes.notasCredito), 'Anulaciones y descuentos', 'text-red-700')}
            {dato('Cobro previsto', previsto.previsto, 'Facturas presentadas que vencen en el mes', 'text-marca')}
            {dato(
              'Cobrado en el mes',
              previsto.cobrado,
              previsto.previstoSinCobrar > 0
                ? `De lo previsto ${pasado ? 'faltó' : 'falta'} cobrar ${formatoPesos(previsto.previstoSinCobrar)}`
                : 'Se cobró todo lo previsto',
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
                <Bar dataKey="previsto" name="Previsto (por vencimiento)" fill="#5B4FC7" radius={[4, 4, 0, 0]} />
                <Bar dataKey="cobrado" name="Cobrado" fill="#0E9F8E" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>
      </div>

      {/* 3. Lo pendiente de hoy, una sola vez: el total y en qué etapa está */}
      <div className="mb-2 mt-6">
        <Link to={verFacturas('pendiente')} className="group inline-flex flex-wrap items-baseline gap-x-3 gap-y-1">
          <h2 className="text-sm font-bold uppercase tracking-wide text-noche">Pendiente de cobro hoy:</h2>
          <span className="whitespace-nowrap font-extrabold tabular-nums text-marca" style={GRANDE}>{formatoPesos(situacion.pendiente)}</span>
          <span className="text-xs font-semibold text-marca group-hover:underline">Ver facturas →</span>
        </Link>
        <p className="text-xs text-slate-500">Todo lo facturado que falta cobrar, según en qué etapa está: sin presentar + al día + vencido.</p>
      </div>
      {/* La barra muestra cuánto es cada parte del total */}
      <div className="mb-3 flex h-2.5 overflow-hidden rounded-full bg-slate-100" aria-hidden="true">
        <div className="bg-sem-amarillo" style={{ width: `${pct(situacion.sinPresentar)}%` }} />
        <div className="bg-etapa-compania" style={{ width: `${pct(situacion.alDia)}%` }} />
        <div className="bg-red-800" style={{ width: `${pct(situacion.vencido)}%` }} />
      </div>
      <div className="grid gap-4 sm:grid-cols-3">
        <Indicador to={verFacturas('sin_presentar')} titulo="Sin presentar" punto="bg-sem-amarillo" valor={formatoPesos(situacion.sinPresentar)} ayuda={`${pct(situacion.sinPresentar)} % · esperando documentación o presentación`} />
        <Indicador to={verFacturas('al_dia')} titulo="Al día" punto="bg-etapa-compania" valor={formatoPesos(situacion.alDia)} ayuda={`${pct(situacion.alDia)} % · presentado, todavía no vence`} />
        <Indicador to={verFacturas('vencido')} titulo="Vencido" punto="bg-red-800" valor={formatoPesos(situacion.vencido)} tono="rojo" ayuda={`${pct(situacion.vencido)} % · presentado, vencido y sin cobrar`} />
      </div>

      {/* 4. Dónde está la plata pendiente. Con una sucursal elegida, los datos de esa sucursal */}
      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        {unaSucursal ? (
          <Card>
            <CardTitulo accion={<Link to="/app/sucursales" className="text-xs font-semibold text-marca hover:underline">Ver ranking</Link>}>
              Documentación de {sucursal}
            </CardTitulo>
            {unaSucursal && (
              <div className="grid grid-cols-2 gap-4 sm:grid-cols-3">
                {[
                  { titulo: 'Retenido hoy', valor: formatoPesos(unaSucursal.retenido), clase: '' },
                  { titulo: 'Esperando documentación', valor: `${unaSucursal.pendientes} facturas`, clase: '' },
                  { titulo: 'Críticas', valor: `${unaSucursal.criticos} facturas`, clase: unaSucursal.criticos ? 'text-red-800' : '' },
                  { titulo: 'Atrasadas', valor: `${unaSucursal.atrasados} facturas`, clase: unaSucursal.atrasados ? 'text-sem-rojo' : '' },
                  { titulo: `Días prom. hasta subir (${anio})`, valor: unaSucursal.diasPromedioEscaneo === null ? '—' : `${unaSucursal.diasPromedioEscaneo} días`, clase: '' },
                  { titulo: 'Subidas en plazo', valor: unaSucursal.dentroDePlazoPct === null ? '—' : `${unaSucursal.dentroDePlazoPct} %`, clase: '' },
                ].map((x) => (
                  <div key={x.titulo}>
                    <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{x.titulo}</div>
                    <div className={`whitespace-nowrap text-base font-extrabold tabular-nums ${x.clase}`}>{x.valor}</div>
                  </div>
                ))}
              </div>
            )}
          </Card>
        ) : (
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
        )}
        <Card>
          <CardTitulo accion={<Link to="/app/saldos" className="text-xs font-semibold text-marca hover:underline">Ver saldos</Link>}>
            {unaSucursal ? `Compañías con más vencido en ${sucursal}` : 'Compañías con más vencido sin cobrar'}
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
