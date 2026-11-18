import { useMemo, useState } from 'react'
import { CheckCircle2, Download, GitCompare, TriangleAlert } from 'lucide-react'
import { Card, CardTitulo } from './ui/Card'
import { compararConPlanillaEnGoogle, type FilaComparacion, type ResultadoComparacion } from '../services/google'
import { descargarExcel } from '../lib/exportar'
import { formatoFecha, formatoPesos } from '../lib/formato'

const esFecha = (v: unknown) => typeof v === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(v)
const mostrar = (v: string | number) => (v === '' || v === null ? '(vacío)' : typeof v === 'number' ? formatoPesos(v) : esFecha(v) ? formatoFecha(v) : v)

/**
 * Comparar con mi planilla: CobroSync lee la hoja Diario y la compara factura por factura (por la
 * referencia) y campo por campo con lo que tiene. No cambia nada. Solo la administradora.
 */
export function CompararPlanilla() {
  const [resultado, setResultado] = useState<ResultadoComparacion | null>(null)
  const [estado, setEstado] = useState<'listo' | 'comparando' | string>('listo')
  const [campo, setCampo] = useState<string | null>(null)
  const [ver, setVer] = useState<'diferencias' | 'soloPlanilla' | 'soloCobroSync'>('diferencias')

  async function comparar() {
    setEstado('comparando')
    try {
      setResultado(await compararConPlanillaEnGoogle())
      setCampo(null)
      setVer('diferencias')
      setEstado('listo')
    } catch (e) {
      setEstado(e instanceof Error ? e.message : String(e))
    }
  }

  const filas = useMemo(() => {
    if (!resultado) return []
    if (ver !== 'diferencias') return resultado[ver]
    return campo ? resultado.diferencias.filter((d) => d.campos?.some((c) => c.campo === campo)) : resultado.diferencias
  }, [resultado, ver, campo])

  function bajarExcel(r: ResultadoComparacion) {
    const encabezados = ['Ref.', 'Comprobante', 'Fecha', 'Sucursal', 'Compañía', 'Importe', 'Qué pasa', 'Dato', 'En la planilla', 'En CobroSync']
    const base = (f: FilaComparacion) => [f.ref, f.comprobante, f.fecha, f.sucursal, f.compania, f.importe]
    const datos = [
      ...r.diferencias.flatMap((f) => (f.campos ?? []).map((c) => [...base(f), 'Distinto', c.campo, String(c.planilla), String(c.cobrosync)])),
      ...r.soloPlanilla.map((f) => [...base(f), 'Solo en la planilla', '', '', '']),
      ...r.soloCobroSync.map((f) => [...base(f), 'Solo en CobroSync', '', '', '']),
    ]
    descargarExcel('Comparacion con la planilla', encabezados, datos, 'Comparación con la planilla de control')
  }

  const r = resultado
  const todoIgual = r && r.conDiferencias === 0 && r.soloPlanilla.length === 0 && r.cantidadSoloCobroSync === 0
  return (
    <Card className="mb-4">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <CardTitulo>Comparar con mi planilla</CardTitulo>
          <p className="text-sm text-slate-600">
            Revisa factura por factura (por la referencia) y dato por dato si CobroSync tiene lo mismo que la hoja Diario. No cambia nada.
          </p>
        </div>
        <button
          type="button"
          onClick={() => void comparar()}
          disabled={estado === 'comparando'}
          className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-60"
        >
          <GitCompare className="h-4 w-4" /> {estado === 'comparando' ? 'Comparando…' : r ? 'Comparar de nuevo' : 'Comparar con mi planilla'}
        </button>
      </div>
      {estado !== 'listo' && estado !== 'comparando' && <p className="mt-2 text-sm text-red-700">{estado}</p>}

      {r && (
        <div className="mt-4 space-y-4">
          {/* Resumen */}
          <div className={`flex items-start gap-2 rounded-lg px-3 py-2 text-sm ${todoIgual ? 'bg-esmeralda/10 text-teal-900' : 'bg-amber-50 text-amber-900'}`}>
            {todoIgual ? <CheckCircle2 className="mt-0.5 h-4 w-4 shrink-0" /> : <TriangleAlert className="mt-0.5 h-4 w-4 shrink-0" />}
            <span>
              {todoIgual
                ? `Todo coincide: ${r.comparadas.toLocaleString('es-AR')} facturas iguales en la planilla y en CobroSync.`
                : `${r.comparadas.toLocaleString('es-AR')} facturas comparadas: ${r.iguales.toLocaleString('es-AR')} iguales y ${r.conDiferencias.toLocaleString('es-AR')} con alguna diferencia.`}
              {r.omitidas > 0 && ` (${r.omitidas.toLocaleString('es-AR')} filas de sucursales que no están en el piloto no se comparan.)`}
            </span>
          </div>

          <div className="grid gap-3 sm:grid-cols-3">
            {(
              [
                ['diferencias', 'Con diferencias', r.conDiferencias],
                ['soloPlanilla', 'Solo en la planilla', r.soloPlanilla.length],
                ['soloCobroSync', 'Solo en CobroSync', r.cantidadSoloCobroSync],
              ] as const
            ).map(([clave, titulo, n]) => (
              <button
                key={clave}
                type="button"
                onClick={() => {
                  setVer(clave)
                  setCampo(null)
                }}
                className={`rounded-xl border p-3 text-left transition ${ver === clave ? 'border-marca bg-indigo-50 ring-2 ring-indigo-200' : 'border-slate-200 bg-white hover:shadow-sm'}`}
              >
                <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">{titulo}</div>
                <div className={`text-xl font-extrabold tabular-nums ${n ? 'text-noche' : 'text-teal-700'}`}>{n.toLocaleString('es-AR')}</div>
              </button>
            ))}
          </div>

          {/* Totales: lo mismo que se ve en los informes */}
          <table className="w-full text-sm">
            <thead>
              <tr className="text-left text-xs uppercase tracking-wide text-slate-500">
                <th className="py-1 font-semibold">Totales</th>
                <th className="py-1 text-right font-semibold">Planilla</th>
                <th className="py-1 text-right font-semibold">CobroSync</th>
                <th className="py-1 text-right font-semibold">Diferencia</th>
              </tr>
            </thead>
            <tbody className="tabular-nums">
              {(
                [
                  ['Comprobantes', 'cantidad'],
                  ['Facturado (sin anuladas)', 'facturado'],
                  ['Cobrado', 'cobrado'],
                ] as const
              ).map(([t, k]) => {
                const a = r.totales.planilla[k]
                const b = r.totales.cobrosync[k]
                const fmt = (n: number) => (k === 'cantidad' ? n.toLocaleString('es-AR') : formatoPesos(n))
                const dif = Math.abs(a - b) < 0.01 ? null : b - a
                return (
                  <tr key={k} className="border-t border-slate-100">
                    <td className="py-1.5">{t}</td>
                    <td className="py-1.5 text-right">{fmt(a)}</td>
                    <td className="py-1.5 text-right">{fmt(b)}</td>
                    <td className={`py-1.5 text-right font-semibold ${dif === null ? 'text-teal-700' : 'text-red-700'}`}>{dif === null ? 'igual' : fmt(dif)}</td>
                  </tr>
                )
              })}
            </tbody>
          </table>
          <p className="-mt-2 text-xs text-slate-500">Los totales son de las facturas que están en las dos; las que están en un solo lado se ven arriba.</p>

          {/* Diferencias por dato: tocar uno filtra la lista */}
          {ver === 'diferencias' && r.conDiferencias > 0 && (
            <div className="flex flex-wrap items-center gap-1.5 text-xs">
              <span className="text-slate-500">En qué dato:</span>
              {Object.entries(r.porCampo)
                .filter(([, n]) => n > 0)
                .sort((x, y) => y[1] - x[1])
                .map(([c, n]) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setCampo(campo === c ? null : c)}
                    className={`rounded-full border px-2.5 py-1 font-semibold transition ${campo === c ? 'border-amber-500 bg-amber-100 text-amber-950 ring-2 ring-amber-200' : `border-amber-200 bg-amber-50 text-amber-900 ${campo ? 'opacity-50' : ''}`}`}
                  >
                    {c} · {n.toLocaleString('es-AR')}
                  </button>
                ))}
            </div>
          )}

          {filas.length > 0 && (
            <>
              <div className="max-h-[28rem] overflow-auto rounded-lg border border-slate-200">
                <table className="w-full text-[13px]">
                  <thead className="sticky top-0 bg-fondo text-left text-xs uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="px-3 py-2 font-semibold">Factura</th>
                      <th className="px-3 py-2 font-semibold">Sucursal · compañía</th>
                      {ver === 'diferencias' ? (
                        <>
                          <th className="px-3 py-2 font-semibold">Dato</th>
                          <th className="px-3 py-2 font-semibold">En la planilla</th>
                          <th className="px-3 py-2 font-semibold">En CobroSync</th>
                        </>
                      ) : (
                        <th className="px-3 py-2 text-right font-semibold">Importe</th>
                      )}
                    </tr>
                  </thead>
                  <tbody>
                    {filas.slice(0, 500).map((f) => {
                      const campos = (f.campos ?? []).filter((c) => !campo || c.campo === campo)
                      return (
                        <tr key={`${f.ref}-${f.comprobante}`} className="border-t border-slate-100 align-top">
                          <td className="px-3 py-2">
                            <div className="font-semibold">{f.comprobante}</div>
                            <div className="text-xs text-slate-500">
                              Ref. {f.ref || '—'} · {esFecha(f.fecha) ? formatoFecha(f.fecha) : f.fecha}
                            </div>
                          </td>
                          <td className="px-3 py-2 text-xs text-slate-600">
                            {f.sucursal} · {f.compania}
                          </td>
                          {ver === 'diferencias' ? (
                            <>
                              <td className="px-3 py-2">{campos.map((c) => <div key={c.campo} className="font-semibold">{c.campo}</div>)}</td>
                              <td className="px-3 py-2">{campos.map((c) => <div key={c.campo}>{mostrar(c.planilla)}</div>)}</td>
                              <td className="px-3 py-2">{campos.map((c) => <div key={c.campo}>{mostrar(c.cobrosync)}</div>)}</td>
                            </>
                          ) : (
                            <td className="px-3 py-2 text-right tabular-nums">{formatoPesos(f.importe)}</td>
                          )}
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
              <div className="flex flex-wrap items-center justify-between gap-2 text-xs text-slate-500">
                <span>{filas.length > 500 ? `Se ven las primeras 500 de ${filas.length.toLocaleString('es-AR')}; el Excel tiene todas.` : `${filas.length.toLocaleString('es-AR')} en la lista.`}</span>
                <button type="button" onClick={() => bajarExcel(r)} className="inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 font-semibold text-slate-700 hover:bg-fondo">
                  <Download className="h-3.5 w-3.5" /> Bajar todo en Excel
                </button>
              </div>
            </>
          )}
          {ver === 'soloCobroSync' && r.cantidadSoloCobroSync > 0 && (
            <p className="text-xs text-slate-500">Suelen ser facturas que entraron con el Excel de Quiter y todavía no se anotaron en la planilla.</p>
          )}
        </div>
      )}
    </Card>
  )
}
