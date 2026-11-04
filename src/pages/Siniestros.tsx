import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronLeft, ChevronRight, Search } from 'lucide-react'
import { BadgeEtapa } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { useApp, useComprobantes } from '../context/AppContext'
import { saldoSinCobro } from '../domain/importes'
import { calcularSemaforo, NOMBRE_DOCUMENTO } from '../domain/semaforo'
import type { Comprobante, Documento } from '../domain/tipos'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { diffDias } from '../lib/fechas'

const POR_PAGINA = 20
const normalizar = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

const ESTILO_DOC: Record<Documento['estado'], string> = {
  faltante: 'border-amber-300 bg-amber-50 text-amber-900',
  observado: 'border-red-300 bg-red-50 text-red-800',
  en_revision: 'border-sky-200 bg-sky-50 text-sky-800',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}
const TEXTO_DOC: Record<Documento['estado'], string> = { faltante: 'falta', observado: 'observado', en_revision: 'en revisión', ok: 'aprobado' }

interface Grupo {
  clave: string
  siniestro: string
  compania: string
  patente: string
  facturas: Comprobante[]
  notas: Comprobante[]
  ultimaFecha: string
  avisos: string[]
}

/**
 * Mis siniestros: todo lo de cada siniestro en un lugar. Qué facturas hay, sus documentos (para
 * volver a ver una orden ya aprobada) y las notas de crédito, con lo que puede quedar para
 * refacturar.
 */
export default function Siniestros() {
  const { datos, hoy, sucursal, rol, abrirLegajo } = useApp()
  const comprobantes = useComprobantes()
  const [busqueda, setBusqueda] = useState('')
  const [filtro, setFiltro] = useState<'todos' | 'pendiente' | 'nc'>('todos')
  const [pagina, setPagina] = useState(1)
  const nombreCompania = (id: string) => datos!.aseguradoras.find((a) => a.id === id)?.nombre ?? id

  const grupos = useMemo(() => {
    const mapa = new Map<string, Grupo>()
    const facturas = comprobantes.filter((c) => c.tipo === 'FC')
    for (const c of facturas) {
      const s = normalizar(c.siniestro ?? '')
      const clave = s.length >= 4 ? `${c.aseguradoraId}|${s}` : `sola|${c.id}`
      const g = mapa.get(clave) ?? { clave, siniestro: c.siniestro, compania: nombreCompania(c.aseguradoraId), patente: c.patente, facturas: [], notas: [], ultimaFecha: '', avisos: [] }
      g.facturas.push(c)
      if (c.fecha > g.ultimaFecha) g.ultimaFecha = c.fecha
      if (!g.patente && c.patente) g.patente = c.patente
      mapa.set(clave, g)
    }
    // Las notas de crédito van con la factura que acreditan
    const grupoDe = new Map<string, Grupo>()
    for (const g of mapa.values()) for (const f of g.facturas) grupoDe.set(f.id, g)
    for (const nc of comprobantes.filter((c) => c.tipo === 'NC' && c.ncReferencia)) grupoDe.get(nc.ncReferencia!)?.notas.push(nc)

    for (const g of mapa.values()) {
      g.facturas.sort((a, b) => a.fecha.localeCompare(b.fecha))
      const vigentes = g.facturas.filter((f) => f.estado !== 'anulada')
      // Lo que conviene que la sucursal sepa
      for (const f of g.facturas) {
        if ((f.acreditado ?? 0) > 0) {
          g.avisos.push(`${formatoComprobante(f)}: nota de crédito parcial por ${formatoPesos(f.acreditado ?? 0)}. Si corresponde, hay que refacturar esa diferencia.`)
        }
        if (f.anulacionInformada && !f.anulacionInformada.parcial && f.estado !== 'anulada') {
          g.avisos.push(`${formatoComprobante(f)}: informaste que se anula; falta que la nota de crédito aparezca en el ERP.`)
        }
        if (f.anulacionInformada?.parcial && !(f.acreditado ?? 0)) {
          g.avisos.push(`${formatoComprobante(f)}: informaste una nota de crédito parcial por ${formatoPesos(f.anulacionInformada.importe ?? 0)}; falta que aparezca en el ERP.`)
        }
      }
      // Solo si la anulación es reciente: lo viejo ya se resolvió (o no se refactura)
      if (vigentes.length === 0 && diffDias(g.ultimaFecha, hoy) <= 60) g.avisos.push('Todas las facturas de este siniestro están anuladas: si se refactura, todavía no está la factura nueva.')
    }
    return [...mapa.values()].sort((a, b) => b.ultimaFecha.localeCompare(a.ultimaFecha))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobantes, datos, hoy])

  const conPendiente = (g: Grupo) =>
    g.avisos.length > 0 || g.facturas.some((f) => f.estado !== 'anulada' && f.estado !== 'cobrada' && f.documentos.some((d) => d.estado === 'faltante' || d.estado === 'observado'))

  const visibles = useMemo(() => {
    const t = normalizar(busqueda)
    return grupos.filter((g) => {
      if (filtro === 'pendiente' && !conPendiente(g)) return false
      if (filtro === 'nc' && g.notas.length === 0 && !g.facturas.some((f) => f.anulacionInformada || (f.acreditado ?? 0) > 0)) return false
      if (t.length < 3) return true
      return [g.siniestro, g.patente, g.compania, ...g.facturas.map((f) => `${f.puntoVenta}${String(f.numero).padStart(8, '0')} ${f.numero} ${f.ref}`)]
        .map(normalizar)
        .some((x) => x.includes(t))
    })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, busqueda, filtro])

  const totalPaginas = Math.max(1, Math.ceil(visibles.length / POR_PAGINA))
  const actual = Math.min(pagina, totalPaginas)
  const deLaPagina = visibles.slice((actual - 1) * POR_PAGINA, actual * POR_PAGINA)

  const documento = (d: Documento) => {
    const enlaces = d.adjuntos ?? (d.url ? [{ archivo: d.archivo ?? '', url: d.url }] : [])
    return (
      <span key={d.tipo} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${ESTILO_DOC[d.estado]}`}>
        {NOMBRE_DOCUMENTO[d.tipo].split(' ')[0]}: {TEXTO_DOC[d.estado]}
        {enlaces.map((a, i) =>
          a.url ? (
            <a key={i} href={a.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="underline">
              {enlaces.length > 1 ? `p. ${i + 1}` : 'ver'}
            </a>
          ) : null,
        )}
      </span>
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo={rol === 'sucursal' ? `Mis siniestros · ${sucursal}` : 'Siniestros'}
        subtitulo="Todas las facturas de cada siniestro, con sus documentos (también los ya aprobados) y las notas de crédito"
        sucursal={rol !== 'sucursal'}
      />

      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-72 flex-1">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setPagina(1)
            }}
            placeholder="Buscá por siniestro, patente o número de factura"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
          />
        </label>
        {(
          [
            ['todos', 'Todos'],
            ['pendiente', 'Con algo pendiente'],
            ['nc', 'Con nota de crédito'],
          ] as const
        ).map(([clave, texto]) => (
          <button
            key={clave}
            type="button"
            onClick={() => {
              setFiltro(clave)
              setPagina(1)
            }}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${filtro === clave ? 'border-marca bg-marca text-white' : 'border-slate-200 bg-white hover:bg-fondo'}`}
          >
            {texto}
          </button>
        ))}
        <span className="text-sm text-slate-500">{visibles.length.toLocaleString('es-AR')} siniestros</span>
      </div>

      <div className="space-y-3">
        {deLaPagina.map((g) => {
          const total = g.facturas.filter((f) => f.estado !== 'anulada').reduce((t, f) => t + saldoSinCobro(f), 0)
          return (
            <div key={g.clave} className="rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-wrap items-baseline justify-between gap-2 border-b border-slate-100 px-4 py-3">
                <div>
                  <span className="font-bold">{g.siniestro ? `Siniestro ${g.siniestro}` : 'Sin número de siniestro'}</span>
                  <span className="ml-2 text-sm text-slate-500">
                    {g.compania}
                    {g.patente ? ` · ${g.patente}` : ''} · {g.facturas.length} {g.facturas.length === 1 ? 'factura' : 'facturas'}
                  </span>
                </div>
                <span className="text-sm font-semibold tabular-nums">{formatoPesos(total)}</span>
              </div>
              <table className="w-full text-left text-[13px]">
                <tbody className="divide-y divide-slate-100">
                  {g.facturas.map((f) => (
                    <tr key={f.id} onClick={() => abrirLegajo(f.id)} className="cursor-pointer hover:bg-marca/5">
                      <td className="whitespace-nowrap px-4 py-2 font-medium">{formatoComprobante(f)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">{formatoFecha(f.fecha)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatoPesos(f.total)}</td>
                      <td className="px-2 py-2">
                        <BadgeEtapa etapa={calcularSemaforo(f, hoy).etapa} />
                      </td>
                      <td className="px-4 py-2">
                        <div className="flex flex-wrap gap-1">{f.documentos.map(documento)}</div>
                      </td>
                    </tr>
                  ))}
                  {g.notas.map((nc) => (
                    <tr key={nc.id} onClick={() => abrirLegajo(nc.id)} className="cursor-pointer bg-red-50/40 hover:bg-marca/5">
                      <td className="whitespace-nowrap px-4 py-2 font-medium text-red-800">{formatoComprobante(nc)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-slate-500">{formatoFecha(nc.fecha)}</td>
                      <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums text-red-800">{formatoPesos(nc.total)}</td>
                      <td colSpan={2} className="px-2 py-2 text-xs text-slate-600">Nota de crédito</td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {g.avisos.length > 0 && (
                <ul className="space-y-1 border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
                  {g.avisos.map((a) => (
                    <li key={a} className="flex items-start gap-1.5">
                      <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a}
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )
        })}
        {deLaPagina.length === 0 && <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">No hay siniestros con esta búsqueda.</p>}
      </div>

      {totalPaginas > 1 && (
        <div className="mt-4 flex items-center justify-between text-sm">
          <span className="text-slate-500">
            Página {actual} de {totalPaginas}
          </span>
          <div className="flex gap-2">
            <button type="button" onClick={() => setPagina(actual - 1)} disabled={actual === 1} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Página anterior">
              <ChevronLeft className="h-4 w-4" />
            </button>
            <button type="button" onClick={() => setPagina(actual + 1)} disabled={actual === totalPaginas} className="rounded-lg border border-slate-200 bg-white p-1.5 disabled:opacity-40" aria-label="Página siguiente">
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </div>
      )}
    </>
  )
}
