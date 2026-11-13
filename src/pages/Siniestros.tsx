import { useMemo, useState } from 'react'
import { AlertTriangle, ArrowLeft, CornerDownRight, FolderOpen, Search } from 'lucide-react'
import { BadgeEtapa } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { useApp, useComprobantes } from '../context/AppContext'
import { saldoSinCobro } from '../domain/importes'
import { antesDelInicio } from '../domain/plazos'
import { calcularSemaforo, NOMBRE_DOCUMENTO } from '../domain/semaforo'
import { esperaALaSucursal } from '../domain/sucursales'
import type { Comprobante, Documento } from '../domain/tipos'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { diffDias } from '../lib/fechas'

const POR_PAGINA = 50
const normalizar = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

const ESTILO_DOC: Record<Documento['estado'], string> = {
  faltante: 'border-amber-300 bg-amber-50 text-amber-900',
  observado: 'border-red-300 bg-red-50 text-red-800',
  en_revision: 'border-sky-200 bg-sky-50 text-sky-800',
  ok: 'border-teal-200 bg-teal-50 text-teal-800',
}
const TEXTO_DOC: Record<Documento['estado'], string> = { faltante: 'falta', observado: 'observada', en_revision: 'en revisión', ok: 'aprobada' }

/** En qué está el siniestro, con su color (el mismo significado que en toda la plataforma) */
type EstadoSiniestro = 'documentacion' | 'refacturar' | 'revision' | 'presentado' | 'vencido' | 'cobrado' | 'anulado'
const ESTADO_SINIESTRO: Record<EstadoSiniestro, { texto: string; punto: string; chip: string }> = {
  documentacion: { texto: 'Falta documentación', punto: 'bg-sem-amarillo', chip: 'bg-amber-50 text-amber-900 border-amber-200' },
  refacturar: { texto: 'Pendiente de facturar', punto: 'bg-orange-500', chip: 'bg-orange-50 text-orange-900 border-orange-200' },
  revision: { texto: 'En Cobranzas', punto: 'bg-marca', chip: 'bg-marca/10 text-indigo-900 border-marca/20' },
  presentado: { texto: 'Presentado', punto: 'bg-etapa-compania', chip: 'bg-blue-50 text-blue-900 border-blue-200' },
  vencido: { texto: 'Vencido', punto: 'bg-red-800', chip: 'bg-red-50 text-red-900 border-red-200' },
  cobrado: { texto: 'Cobrado', punto: 'bg-sem-verde', chip: 'bg-teal-50 text-teal-900 border-teal-200' },
  anulado: { texto: 'Anulado', punto: 'bg-slate-400', chip: 'bg-slate-100 text-slate-700 border-slate-200' },
}
const ORDEN_ESTADOS: EstadoSiniestro[] = ['documentacion', 'refacturar', 'revision', 'presentado', 'vencido', 'cobrado', 'anulado']

interface Grupo {
  estado: EstadoSiniestro
  /** monto aprobado de la orden (lo carga Cobranzas) y lo que falta facturar contra él */
  montoOrden: number | null
  neto: number
  clave: string
  siniestro: string
  companiaId: string
  compania: string
  patente: string
  facturas: Comprobante[]
  notas: Comprobante[]
  ultimaFecha: string
  /** lo que le queda por hacer a la sucursal en este siniestro */
  pendientes: { tipo: 'doc' | 'refacturar'; texto: string }[]
  /** tiene alguna factura sin cobrar (ni anulada) */
  enCurso: boolean
  /** saldo sin cobrar de las facturas vigentes */
  saldo: number
  /** para que sepa en qué está (no tiene que hacer nada) */
  info: string[]
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
  const [estado, setEstado] = useState<EstadoSiniestro | ''>('')
  const [companiaElegida, setCompaniaElegida] = useState('')
  const [elegido, setElegido] = useState<string | null>(null)
  const [cantidad, setCantidad] = useState(POR_PAGINA)
  const nombreCompania = (id: string) => datos!.aseguradoras.find((a) => a.id === id)?.nombre ?? id

  const grupos = useMemo(() => {
    const mapa = new Map<string, Grupo>()
    const facturas = comprobantes.filter((c) => c.tipo === 'FC')
    for (const c of facturas) {
      const s = normalizar(c.siniestro ?? '')
      const clave = s.length >= 4 ? `${c.aseguradoraId}|${s}` : `sola|${c.id}`
      const g = mapa.get(clave) ?? {
        clave,
        siniestro: c.siniestro,
        companiaId: c.aseguradoraId,
        compania: nombreCompania(c.aseguradoraId),
        patente: c.patente,
        facturas: [],
        notas: [],
        ultimaFecha: '',
        pendientes: [],
        info: [],
        enCurso: false,
        saldo: 0,
        estado: 'documentacion' as EstadoSiniestro,
        montoOrden: null,
        neto: 0,
      }
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
      // ¿Hay una factura del siniestro emitida después? Entonces lo anulado ya se refacturó
      const refacturada = (f: Comprobante) => vigentes.some((v) => v.id !== f.id && v.fecha > f.fecha)
      for (const f of g.facturas) {
        const numero = formatoComprobante(f)
        if (esperaALaSucursal(f, hoy)) {
          for (const d of f.documentos) {
            if (d.estado === 'faltante') g.pendientes.push({ tipo: 'doc', texto: `Subir la ${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()} de ${numero}` })
            if (d.estado === 'observado') g.pendientes.push({ tipo: 'doc', texto: `Reemplazar la ${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()} de ${numero}${d.motivo ? ` (${d.motivo.toLowerCase()})` : ''}` })
          }
        }
        if ((f.acreditado ?? 0) > 0 && !refacturada(f)) {
          g.pendientes.push({ tipo: 'refacturar', texto: `${numero} tuvo una nota de crédito parcial por ${formatoPesos(f.acreditado ?? 0)}: si esa parte se vuelve a facturar, falta la factura nueva` })
        }
        if (f.estado === 'anulada' && !refacturada(f) && diffDias(f.fecha, hoy) <= 60) {
          g.pendientes.push({ tipo: 'refacturar', texto: `${numero} se anuló con una nota de crédito: si se refactura, falta la factura nueva` })
        }
        if (f.anulacionInformada && f.estado !== 'anulada') {
          g.info.push(
            f.anulacionInformada.parcial
              ? `Se avisó una nota de crédito parcial de ${numero} por ${formatoPesos(f.anulacionInformada.importe ?? 0)}: Cobranzas espera que aparezca en el ERP`
              : `Se avisó que ${numero} se anula: Cobranzas espera la nota de crédito del ERP`,
          )
        }
      }
    }
    for (const g of mapa.values()) {
      const vigentes = g.facturas.filter((f) => f.estado !== 'anulada')
      g.enCurso = vigentes.some((f) => f.estado !== 'cobrada')
      g.saldo = vigentes.reduce((t, f) => t + saldoSinCobro(f), 0)
      g.neto = g.facturas.reduce((t, f) => t + f.total, 0) - g.notas.reduce((t, n) => t + Math.abs(n.total), 0)
      g.montoOrden = g.facturas.map((f) => f.montoOrden ?? null).find((m) => m != null) ?? null
      const etapas = vigentes.map((f) => calcularSemaforo(f, hoy).etapa)
      const faltaFacturar = (g.montoOrden != null && g.montoOrden - g.neto > 1) || g.pendientes.some((x) => x.tipo === 'refacturar')
      g.estado = !vigentes.length
        ? 'anulado'
        : etapas.includes('vencida')
          ? 'vencido'
          : etapas.some((e) => e === 'doc_pendiente' || e === 'doc_atrasada' || e === 'doc_observada')
            ? 'documentacion'
            : faltaFacturar
              ? 'refacturar'
              : etapas.some((e) => e === 'en_revision' || e === 'pres_pendiente')
                ? 'revision'
                : etapas.includes('al_dia')
                  ? 'presentado'
                  : 'cobrado'
    }
    // Lo más reciente primero
    return [...mapa.values()].sort((a, b) => b.ultimaFecha.localeCompare(a.ultimaFecha))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobantes, datos, hoy])

  const texto = normalizar(busqueda)
  const buscando = texto.length >= 3
  const coincide = (g: Grupo) =>
    !buscando ||
    [g.siniestro, g.patente, g.compania, ...g.facturas.map((f) => `${f.puntoVenta}${String(f.numero).padStart(8, '0')} ${f.puntoVenta}${f.numero} ${f.numero} ${f.ref}`)]
      .map(normalizar)
      .some((x) => x.includes(texto))

  const companias = useMemo(() => {
    const m = new Map<string, { nombre: string; cantidad: number }>()
    for (const g of grupos) m.set(g.companiaId, { nombre: g.compania, cantidad: (m.get(g.companiaId)?.cantidad ?? 0) + 1 })
    return [...m.entries()].sort((a, b) => a[1].nombre.localeCompare(b[1].nombre, 'es'))
  }, [grupos])

  const visibles = useMemo(
    () =>
      grupos.filter(
        (g) => (!estado || g.estado === estado) && (!companiaElegida || g.companiaId === companiaElegida) && coincide(g),
      ),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [grupos, estado, companiaElegida, texto],
  )
  const actual = grupos.find((g) => g.clave === elegido) ?? null
  // Si la búsqueda deja un solo siniestro, se abre solo
  const mostrado = actual ?? (buscando && visibles.length === 1 ? visibles[0] : null)

  const documento = (d: Documento) => {
    const enlaces = d.adjuntos ?? (d.url ? [{ archivo: d.archivo ?? '', url: d.url }] : [])
    return (
      <span key={d.tipo} className={`inline-flex items-center gap-1 rounded-md border px-1.5 py-0.5 text-[11px] font-semibold ${ESTILO_DOC[d.estado]}`}>
        {d.estado === 'faltante' ? `Falta la ${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()}` : `${NOMBRE_DOCUMENTO[d.tipo]} ${TEXTO_DOC[d.estado]}`}
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

  /** Detalle de un siniestro: sus números y cada factura con sus documentos y, debajo, sus notas de crédito. */
  const detalle = (g: Grupo) => {
    const facturado = g.facturas.reduce((t, f) => t + f.total, 0)
    const acreditado = g.notas.reduce((t, n) => t + Math.abs(n.total), 0)
    const cobrado = g.facturas.reduce((t, f) => t + (f.estado === 'cobrada' ? f.total - (f.acreditado ?? 0) : 0), 0)
    const pendiente = g.montoOrden != null ? g.montoOrden - g.neto : null
    return (
      <article>
        <button type="button" onClick={() => setElegido(null)} className="mb-3 flex items-center gap-1 text-sm font-semibold text-marca lg:hidden">
          <ArrowLeft className="h-4 w-4" /> Volver a la lista
        </button>
        <div className="flex flex-wrap items-center gap-2">
          <h2 className="text-lg font-extrabold">{g.siniestro ? `Siniestro ${g.siniestro}` : `Pendiente de documentación · ${formatoComprobante(g.facturas[0])}`}</h2>
          <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${ESTADO_SINIESTRO[g.estado].chip}`}>{ESTADO_SINIESTRO[g.estado].texto}</span>
        </div>
        {!g.siniestro && <p className="text-xs text-slate-500">El número de siniestro se completa al subir la orden firmada.</p>}
        <p className="text-sm text-slate-500">
          {g.compania}
          {g.patente ? ` · ${g.patente}` : ''} · {g.facturas.length} {g.facturas.length === 1 ? 'factura' : 'facturas'}
        </p>

        <dl className="mt-4 grid grid-cols-2 gap-3 2xl:grid-cols-4">
          {[
            { t: 'Facturado', v: formatoPesos(facturado), c: 'text-noche' },
            { t: 'Notas de crédito', v: acreditado ? `−${formatoPesos(acreditado)}` : '—', c: acreditado ? 'text-red-800' : 'text-slate-400' },
            { t: 'Cobrado', v: cobrado ? formatoPesos(cobrado) : '—', c: cobrado ? 'text-teal-700' : 'text-slate-400' },
            { t: 'Falta cobrar', v: g.saldo ? formatoPesos(g.saldo) : '—', c: g.saldo ? 'text-noche' : 'text-slate-400' },
          ].map((x) => (
            <div key={x.t} className="rounded-lg bg-fondo px-3 py-2">
              <dt className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">{x.t}</dt>
              <dd className={`text-sm font-bold tabular-nums ${x.c}`}>{x.v}</dd>
            </div>
          ))}
        </dl>

        {/* Contra la orden: cuánto se aprobó y cuánto falta facturar (después de notas de crédito y refacturaciones) */}
        <MontoOrden g={g} pendiente={pendiente} />

        <h3 className="mb-2 mt-5 text-xs font-bold uppercase tracking-wide text-slate-500">Movimientos</h3>
        <ul className="space-y-2">
          {g.facturas.map((f) => (
            <li key={f.id} className="rounded-xl border border-slate-200">
              <button type="button" onClick={() => abrirLegajo(f.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-3 py-2.5 text-left text-[13px] hover:bg-marca/5">
                <span className="min-w-[9rem] font-semibold">
                  {formatoComprobante(f)}
                  <span className="ml-2 text-xs font-normal text-slate-500">{formatoFecha(f.fecha)}</span>
                </span>
                <span className="tabular-nums">{formatoPesos(f.total)}</span>
                <BadgeEtapa etapa={calcularSemaforo(f, hoy).etapa} />
                {/* Solo lo que hay que hacer (falta u observado); lo demás ya lo dice la etiqueta. Los PDF se pueden abrir */}
                {!antesDelInicio(f) && f.documentos.some((d) => d.estado === 'faltante' || d.estado === 'observado') && (
                  <span className="flex w-full flex-wrap gap-1">{f.documentos.filter((d) => d.estado === 'faltante' || d.estado === 'observado').map(documento)}</span>
                )}
                {f.documentos.some((d) => d.url || d.adjuntos?.length) && (
                  <span className="flex gap-3 text-xs">
                    {f.documentos
                      .filter((d) => d.url || d.adjuntos?.length)
                      .map((d) => (
                        <a key={d.tipo} href={d.url ?? d.adjuntos?.[0]?.url} target="_blank" rel="noreferrer" onClick={(e) => e.stopPropagation()} className="font-semibold text-marca hover:underline">
                          Ver {NOMBRE_DOCUMENTO[d.tipo].toLowerCase()}
                        </a>
                      ))}
                  </span>
                )}
              </button>
              {/* Las notas de crédito, colgadas de la factura que acreditan */}
              {g.notas
                .filter((nc) => nc.ncReferencia === f.id)
                .map((nc) => (
                  <button
                    key={nc.id}
                    type="button"
                    onClick={() => abrirLegajo(nc.id)}
                    className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 border-t border-dashed border-slate-200 bg-red-50/40 px-3 py-2 text-left text-[13px] hover:bg-marca/5"
                  >
                    <CornerDownRight className="h-4 w-4 text-red-700" />
                    <span className="font-medium text-red-800">{formatoComprobante(nc)}</span>
                    <span className="tabular-nums text-red-800">−{formatoPesos(Math.abs(nc.total))}</span>
                    <span className="text-xs text-slate-600">
                      {f.estado === 'anulada' ? 'anula la factura completa' : 'acredita una parte'} · {formatoFecha(nc.fecha)}
                    </span>
                  </button>
                ))}
            </li>
          ))}
        </ul>

        {g.pendientes.length > 0 && (
          <div className="mt-4 rounded-lg border border-amber-200 bg-amber-50 px-3 py-2 text-xs text-amber-900">
            <div className="mb-1 font-bold">Pendiente</div>
            <ul className="space-y-1">
              {g.pendientes.map((a) => (
                <li key={a.texto} className="flex items-start gap-1.5">
                  <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" /> {a.texto}
                </li>
              ))}
            </ul>
          </div>
        )}
        {g.info.length > 0 && (
          <ul className="mt-3 space-y-1 rounded-lg bg-fondo px-3 py-2 text-xs text-slate-600">
            {g.info.map((a) => (
              <li key={a}>{a}</li>
            ))}
          </ul>
        )}
      </article>
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo={rol === 'sucursal' ? `Mis siniestros · ${sucursal}` : 'Siniestros'}
        subtitulo={rol === 'sucursal' ? 'Cada siniestro con todas sus facturas, sus documentos y sus notas de crédito' : 'Cada siniestro con sus facturas, documentos y notas de crédito. Cobranzas carga el monto de la orden para ver cuánto falta facturar.'}
        sucursal={rol !== 'sucursal'}
      />

      {/* Búsqueda y compañía */}
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={busqueda}
            onChange={(e) => {
              setBusqueda(e.target.value)
              setElegido(null)
            }}
            placeholder="Siniestro, patente o número de factura"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
          />
        </label>
        <select
          aria-label="Compañía"
          value={companiaElegida}
          onChange={(e) => setCompaniaElegida(e.target.value)}
          className="rounded-lg border border-slate-200 bg-white py-2.5 pl-2 pr-7 text-sm shadow-sm"
        >
          <option value="">Todas las compañías</option>
          {companias.map(([id, x]) => (
            <option key={id} value={id}>
              {x.nombre} ({x.cantidad})
            </option>
          ))}
        </select>

      </div>

      {/* Filtro por estado: un botón por color */}
      <div className="mb-3 flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setEstado('')} className={`rounded-full border px-3 py-1 text-xs font-semibold ${!estado ? 'border-marca bg-marca text-white' : 'border-slate-200 bg-white hover:bg-fondo'}`}>
          Todos · {grupos.length}
        </button>
        {ORDEN_ESTADOS.map((e) => {
          const n = grupos.filter((g) => g.estado === e).length
          if (!n) return null
          return (
            <button
              key={e}
              type="button"
              onClick={() => setEstado(estado === e ? '' : e)}
              className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-semibold ${estado === e ? 'border-marca bg-marca text-white' : `${ESTADO_SINIESTRO[e].chip} hover:brightness-95`}`}
            >
              <span className={`h-2 w-2 rounded-full ${ESTADO_SINIESTRO[e].punto}`} /> {ESTADO_SINIESTRO[e].texto} · {n}
            </button>
          )
        })}
      </div>

      {/* Lista a la izquierda, detalle a la derecha (en el celular, uno por vez) */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid lg:h-[calc(100vh-13rem)] lg:min-h-[28rem] lg:grid-cols-[minmax(18rem,24rem)_1fr]">
        <div className={`min-h-0 flex-col border-slate-200 lg:flex lg:border-r ${mostrado ? 'hidden' : 'flex'}`}>
          <div className="border-b border-slate-100 px-4 py-2 text-xs text-slate-500">
            {visibles.length.toLocaleString('es-AR')} {visibles.length === 1 ? 'siniestro' : 'siniestros'} · lo más reciente primero
          </div>
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {visibles.slice(0, cantidad).map((g) => (
              <li key={g.clave}>
                <button
                  type="button"
                  onClick={() => setElegido(g.clave)}
                  className={`flex w-full items-start gap-3 px-4 py-2.5 text-left ${mostrado?.clave === g.clave ? 'bg-marca/10' : 'hover:bg-fondo'}`}
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${ESTADO_SINIESTRO[g.estado].punto}`} title={ESTADO_SINIESTRO[g.estado].texto} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className="truncate text-sm font-semibold">{g.siniestro || `Pendiente de doc. · ${formatoComprobante(g.facturas[0])}`}</span>
                      <span className="shrink-0 text-[11px] text-slate-500">{formatoFecha(g.ultimaFecha)}</span>
                    </span>
                    <span className="block truncate text-xs text-slate-500">
                      {g.compania}
                      {g.patente ? ` · ${g.patente}` : ''} · {g.facturas.length} {g.facturas.length === 1 ? 'factura' : 'facturas'}
                      {g.notas.length > 0 ? ` · ${g.notas.length} NC` : ''}
                    </span>
                  </span>
                </button>
              </li>
            ))}
            {visibles.length === 0 && (
              <li className="px-4 py-10 text-center text-sm text-slate-500">
                {buscando ? 'Sin siniestros con esta búsqueda. Conviene probar con menos números o con la patente.' : 'Sin siniestros para mostrar.'}
              </li>
            )}
            {visibles.length > cantidad && (
              <li>
                <button type="button" onClick={() => setCantidad(cantidad + POR_PAGINA)} className="w-full px-4 py-2.5 text-center text-sm font-semibold text-marca hover:bg-marca/5">
                  Ver {Math.min(POR_PAGINA, visibles.length - cantidad)} más
                </button>
              </li>
            )}
          </ul>
        </div>

        <div className={`min-h-0 overflow-y-auto p-5 ${mostrado ? 'block' : 'hidden lg:block'}`}>
          {mostrado ? (
            detalle(mostrado)
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
              <FolderOpen className="h-10 w-10 text-slate-300" />
              Ningún siniestro seleccionado.
            </div>
          )}
        </div>
      </div>
    </>
  )
}

/** Monto aprobado de la orden y lo que falta facturar contra él. Cobranzas lo carga; la sucursal lo ve. */
function MontoOrden({ g, pendiente }: { g: Grupo; pendiente: number | null }) {
  const { rol, actualizarComprobante, registrarEvento } = useApp()
  const [editando, setEditando] = useState(false)
  const [valor, setValor] = useState('')
  const primera = g.facturas[0]
  const guardar = () => {
    const n = Number(valor.replace(/\./g, '').replace(',', '.').replace(/[^\d.-]/g, ''))
    if (!Number.isFinite(n) || n <= 0) return
    actualizarComprobante(primera.id, { montoOrden: Math.round(n * 100) / 100 })
    registrarEvento(primera.id, 'mensaje', `Cargó el monto aprobado de la orden: ${formatoPesos(n)}`)
    setEditando(false)
  }
  const tono =
    pendiente == null ? 'border-slate-200 bg-fondo' : pendiente > 1 ? 'border-orange-200 bg-orange-50' : pendiente < -1 ? 'border-red-200 bg-red-50' : 'border-teal-200 bg-teal-50'
  return (
    <div className={`mt-3 flex flex-wrap items-center justify-between gap-3 rounded-lg border px-3 py-2.5 text-sm ${tono}`}>
      <div>
        <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">Monto aprobado de la orden</div>
        {editando ? (
          <span className="mt-1 flex items-center gap-2">
            <input
              autoFocus
              value={valor}
              onChange={(e) => setValor(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && guardar()}
              placeholder="$ 0,00"
              className="w-36 rounded-md border border-slate-300 px-2 py-1 text-sm"
            />
            <button type="button" onClick={guardar} className="rounded-md bg-marca px-2.5 py-1 text-xs font-semibold text-white">
              Guardar
            </button>
            <button type="button" onClick={() => setEditando(false)} className="text-xs text-slate-500">
              Cancelar
            </button>
          </span>
        ) : (
          <span className="font-bold tabular-nums">
            {g.montoOrden != null ? formatoPesos(g.montoOrden) : <span className="font-normal text-slate-500">Sin cargar</span>}
            {rol === 'auditoria' && (
              <button
                type="button"
                onClick={() => {
                  setValor(g.montoOrden != null ? String(g.montoOrden).replace('.', ',') : '')
                  setEditando(true)
                }}
                className="ml-2 text-xs font-semibold text-marca hover:underline"
              >
                {g.montoOrden != null ? 'Cambiar' : 'Cargar'}
              </button>
            )}
          </span>
        )}
      </div>
      {pendiente != null && (
        <div className="text-right">
          <div className="text-[10px] font-semibold uppercase tracking-wide text-slate-500">
            {pendiente > 1 ? 'Pendiente de facturar' : pendiente < -1 ? 'Facturado de más' : 'Facturación'}
          </div>
          <div className={`font-bold tabular-nums ${pendiente > 1 ? 'text-orange-800' : pendiente < -1 ? 'text-red-800' : 'text-teal-800'}`}>
            {Math.abs(pendiente) > 1 ? formatoPesos(Math.abs(pendiente)) : 'Completa'}
          </div>
          <div className="text-[11px] text-slate-500">Facturado neto (sin notas de crédito): {formatoPesos(g.neto)}</div>
        </div>
      )}
    </div>
  )
}
