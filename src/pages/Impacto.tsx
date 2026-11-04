import { useMemo, useState } from 'react'
import { Bar, BarChart, CartesianGrid, ResponsiveContainer, Tooltip, XAxis, YAxis } from 'recharts'
import { Clock, HandCoins, Hourglass, Info, TrendingDown } from 'lucide-react'
import { BotonExportar, Card, CardTitulo, EncabezadoPagina, Indicador } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp, useComprobantes } from '../context/AppContext'
import { calcularImpacto } from '../domain/impacto'
import { esperaALaSucursal, rankingSucursales } from '../domain/sucursales'
import { descargarExcel } from '../lib/exportar'
import { formatoPesos, formatoPesosCorto, MESES } from '../lib/formato'

/**
 * Impacto económico de las demoras: dimensiona en plata lo que hoy se discute en palabras.
 */
export default function Impacto() {
  const { datos, hoy, anio, sucursal, parametros, setParametros } = useApp()

  // Al entrar, un cartel avisa que los números de costo están en revisión (una vez por sesión)
  const [aviso, setAviso] = useState(() => {
    try {
      return sessionStorage.getItem('cobrosync-impacto-visto') !== '1'
    } catch {
      return true
    }
  })
  function cerrarAviso() {
    setAviso(false)
    try {
      sessionStorage.setItem('cobrosync-impacto-visto', '1')
    } catch {
      /* sin almacenamiento: se vuelve a mostrar la próxima vez */
    }
  }
  const comprobantes = useComprobantes()
  const { meta } = datos!

  const impacto = useMemo(
    () => calcularImpacto(comprobantes, hoy, anio, parametros, (c) => esperaALaSucursal(c, hoy)),
    [comprobantes, hoy, anio, parametros],
  )
  const porSucursal = useMemo(
    () =>
      rankingSucursales(datos!.comprobantes, meta.sucursales, hoy, anio, null, parametros).sort(
        (a, b) => b.costoDemora - a.costoDemora,
      ),
    [datos, meta.sucursales, hoy, anio, parametros],
  )
  const serieMensual = impacto.costoPorMes.map((m) => ({ mes: MESES[m.mes - 1].slice(0, 3), costo: Math.round(m.costo) }))
  const diasAhorrados =
    impacto.dsoActual !== null && impacto.dsoPosible !== null ? impacto.dsoActual - impacto.dsoPosible : null

  function exportar() {
    descargarExcel(
      `impacto-economico-${anio}`,
      ['Concepto', 'Valor'],
      [
        ['Sucursal', sucursal],
        ['Tasa anual usada (%)', parametros.tasaAnualPct],
        ['Objetivo de días hasta presentar', parametros.objetivoDias],
        ['Importe retenido hoy por legajos incompletos', impacto.retenidoHoy],
        ['Legajos retenidos hoy', impacto.legajosRetenidos],
        [`Costo financiero estimado ${anio}`, impacto.costoDelAnio],
        ['Días extra promedio por factura', impacto.diasExtraPromedio],
        ['DSO actual (días)', impacto.dsoActual],
        ['DSO posible presentando en término (días)', impacto.dsoPosible],
        [],
        ['Costo por mes', ''],
        ...impacto.costoPorMes.map((m) => [MESES[m.mes - 1], m.costo]),
        [],
        ['Costo por sucursal', ''],
        ...porSucursal.map((r) => [r.sucursal.nombre, r.costoDemora]),
      ],
    )
  }

  return (
    <>
      {aviso && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-noche/40 p-4" role="dialog" aria-modal="true" aria-labelledby="aviso-impacto">
          <div className="w-full max-w-md rounded-xl bg-white p-6 shadow-2xl">
            <div className="mb-3 inline-flex items-center gap-2 rounded-full bg-sem-amarillo/15 px-3 py-1 text-xs font-bold uppercase tracking-wide text-amber-900">
              <Info className="h-3.5 w-3.5" /> En revisión
            </div>
            <h2 id="aviso-impacto" className="text-lg font-extrabold text-noche">Estos números son una estimación</h2>
            <p className="mt-2 text-sm text-slate-600">
              El <strong>importe retenido</strong> es real: son facturas emitidas que esperan documentación. El <strong>costo de la demora</strong>{' '}
              se calcula con una tasa de referencia que todavía se está revisando con Contabilidad. Sirve para dimensionar el problema, no es un
              dato contable.
            </p>
            <button
              type="button"
              onClick={cerrarAviso}
              autoFocus
              className="mt-5 w-full rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro"
            >
              Entendido
            </button>
          </div>
        </div>
      )}
      <EncabezadoPagina
        titulo="Impacto económico"
        subtitulo={`Costo financiero de la demora en la documentación · ${anio}`}
        sucursal
        acciones={<BotonExportar onClick={exportar} />}
      />

      <div className="mb-4 flex items-start gap-2 rounded-lg border border-sem-amarillo/40 bg-sem-amarillo/10 px-4 py-3 text-sm text-amber-900">
        <Info className="mt-0.5 h-4 w-4 shrink-0" />
        <span>
          <strong>En revisión con Contabilidad.</strong> El importe <strong>retenido</strong> es real: son facturas emitidas que todavía
          esperan documentación. El <strong>costo de la demora</strong> es una estimación con la tasa de abajo, hasta que Contabilidad
          defina cuál usar.
        </span>
      </div>

      <Card className="mb-4">
        <div className="flex flex-wrap items-end gap-4">
          <label className="text-xs font-semibold text-slate-500">
            Tasa anual de referencia (%)
            <input
              type="number"
              min={0}
              max={300}
              value={parametros.tasaAnualPct}
              onChange={(e) => setParametros({ ...parametros, tasaAnualPct: Number(e.target.value) })}
              className={`${claseSelect} mt-1 block w-32`}
            />
          </label>
          <label className="text-xs font-semibold text-slate-500">
            Objetivo: días desde la factura hasta presentarla
            <input
              type="number"
              min={0}
              max={30}
              value={parametros.objetivoDias}
              onChange={(e) => setParametros({ ...parametros, objetivoDias: Number(e.target.value) })}
              className={`${claseSelect} mt-1 block w-32`}
            />
          </label>
          <p className="max-w-md text-xs text-slate-500">
            Usá la tasa con la que la empresa valúa el dinero (por ejemplo, la de un plazo fijo o la de su
            financiación). Es una estimación para dimensionar el problema, no un cálculo contable.
          </p>
        </div>
      </Card>

      <div className="grid grid-cols-2 gap-4 xl:grid-cols-4">
        <Indicador
          titulo="Retenido hoy (real)"
          valor={formatoPesos(impacto.retenidoHoy)}
          tono="rojo"
          ayuda={`${impacto.legajosRetenidos} facturas esperando a las sucursales`}
          icono={<HandCoins className="h-4 w-4" />}
        />
        <Indicador
          titulo={`Costo de la demora ${anio} (estimado)`}
          valor={formatoPesos(impacto.costoDelAnio)}
          tono="rojo"
          ayuda="Costo financiero estimado"
          icono={<TrendingDown className="h-4 w-4" />}
        />
        <Indicador
          titulo="Días extra por factura"
          valor={`${impacto.diasExtraPromedio.toLocaleString('es-AR')} días`}
          ayuda={`Por encima del objetivo de ${parametros.objetivoDias} días`}
          icono={<Hourglass className="h-4 w-4" />}
        />
        <Indicador
          titulo="DSO actual → posible"
          valor={impacto.dsoActual === null ? '—' : `${impacto.dsoActual} → ${impacto.dsoPosible} días`}
          tono="verde"
          ayuda={diasAhorrados ? `Se cobraría ${diasAhorrados} días antes` : 'Días promedio de cobro'}
          icono={<Clock className="h-4 w-4" />}
        />
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <Card>
          <CardTitulo>Costo de la demora por mes</CardTitulo>
          <div className="h-64">
            <ResponsiveContainer width="100%" height="100%">
              <BarChart data={serieMensual} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
                <CartesianGrid strokeDasharray="3 3" vertical={false} stroke="#E2E8F0" />
                <XAxis dataKey="mes" tickLine={false} axisLine={false} fontSize={12} />
                <YAxis tickFormatter={(v: number) => formatoPesosCorto(v)} tickLine={false} axisLine={false} fontSize={12} width={72} />
                <Tooltip formatter={(v) => [formatoPesos(Number(v)), 'Costo']} cursor={{ fill: '#F1F5F9' }} />
                <Bar dataKey="costo" fill="#EF4444" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </div>
        </Card>

        <Card>
          <CardTitulo>Costo de la demora por sucursal · {anio}</CardTitulo>
          <ul className="space-y-3 text-sm">
            {porSucursal.map((r) => {
              const maximo = porSucursal[0]?.costoDemora || 1
              return (
                <li key={r.sucursal.nombre}>
                  <div className="flex justify-between gap-2">
                    <span className="font-medium">{r.sucursal.nombre}</span>
                    <span className="font-semibold">{formatoPesos(r.costoDemora)}</span>
                  </div>
                  <div className="mt-1 h-2 rounded-full bg-slate-100">
                    <div className="h-2 rounded-full bg-sem-rojo" style={{ width: `${(r.costoDemora / maximo) * 100}%` }} />
                  </div>
                </li>
              )
            })}
          </ul>
        </Card>
      </div>

      <Card className="mt-4">
        <CardTitulo>Cómo se calcula</CardTitulo>
        <ul className="list-disc space-y-1 pl-5 text-sm text-slate-600">
          <li>
            <strong>Días extra</strong>: días entre la factura y su presentación que superan el objetivo (si todavía no se
            presentó, se cuentan hasta hoy).
          </li>
          <li>
            <strong>Costo</strong> = importe × días extra × tasa anual ÷ 365. Es el costo financiero de tener ese importe inmovilizado.
          </li>
          <li>
            <strong>DSO posible</strong>: el promedio de días de cobro si todas las facturas cobradas se hubieran presentado
            dentro del objetivo.
          </li>
        </ul>
      </Card>
    </>
  )
}
