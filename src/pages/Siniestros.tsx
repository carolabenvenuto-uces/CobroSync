import { useMemo, useState } from 'react'
import { AlertTriangle, ChevronDown, ChevronRight, Search } from 'lucide-react'
import { BadgeEtapa } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { useApp, useComprobantes } from '../context/AppContext'
import { saldoSinCobro } from '../domain/importes'
import { calcularSemaforo, NOMBRE_DOCUMENTO } from '../domain/semaforo'
import { esperaALaSucursal } from '../domain/sucursales'
import type { Comprobante, Documento } from '../domain/tipos'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { diffDias } from '../lib/fechas'

const POR_COMPANIA = 15
/** Gris (informativo), con borde para que no se pierda contra el fondo */
const NC = 'bg-slate-200 text-slate-800 ring-1 ring-slate-400'
const normalizar = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

const ESTILO_DOC: Record<Documento['estado'], string> = {
  faltante: 'border-amber-300 bg-amber-50 text-amber-900',
  observado: 'border-red-300 bg-red-50 text-red-800',
  en_revision: 'border-sky-200 bg-sky-50 text-sky-800',
  ok: 'border-emerald-200 bg-emerald-50 text-emerald-800',
}
const TEXTO_DOC: Record<Documento['estado'], string> = { faltante: 'falta', observado: 'observada', en_revision: 'en revisión', ok: 'aprobada' }

interface Grupo {
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
  const [estado, setEstado] = useState<'curso' | 'cobrados' | 'todos'>('curso')
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
              ? `Se avisó una nota de crédito parcial de ${numero} por ${formatoPesos(f.anulacionInformada.importe ?? 0)}: Auditoría espera que aparezca en el ERP`
              : `Se avisó que ${numero} se anula: Auditoría espera la nota de crédito del ERP`,
          )
        }
      }
    }
    for (const g of mapa.values()) {
      const vigentes = g.facturas.filter((f) => f.estado !== 'anulada')
      g.enCurso = vigentes.some((f) => f.estado !== 'cobrada')
      g.saldo = vigentes.reduce((t, f) => t + saldoSinCobro(f), 0)
    }
    // Ordenados por compañía; dentro de cada una, primero lo que falta refacturar, después lo que tiene algo para hacer y lo más nuevo
    const refacturar = (g: Grupo) => g.pendientes.some((x) => x.tipo === 'refacturar')
    return [...mapa.values()].sort(
      (a, b) =>
        a.compania.localeCompare(b.compania, 'es') ||
        Number(refacturar(b)) - Number(refacturar(a)) ||
        Number(b.pendientes.length > 0) - Number(a.pendientes.length > 0) ||
        b.ultimaFecha.localeCompare(a.ultimaFecha),
    )
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [comprobantes, datos, hoy])

  const tieneNc = (g: Grupo) => g.notas.length > 0 || g.facturas.some((f) => f.estado === 'anulada' || (f.acreditado ?? 0) > 0 || f.anulacionInformada)
  const docPendiente = (g: Grupo) => g.pendientes.filter((x) => x.tipo === 'doc').length
  const porRefacturar = (g: Grupo) => g.pendientes.filter((x) => x.tipo === 'refacturar').length

  const [companiasAbiertas, setCompaniasAbiertas] = useState<Set<string>>(new Set())
  const [siniestrosAbiertos, setSiniestrosAbiertos] = useState<Set<string>>(new Set())
  const [verTodos, setVerTodos] = useState<Set<string>>(new Set())
  const alternar = (set: Set<string>, setter: (s: Set<string>) => void, clave: string) => {
    const n = new Set(set)
    if (n.has(clave)) n.delete(clave)
    else n.add(clave)
    setter(n)
  }

  const texto = normalizar(busqueda)
  const buscando = texto.length >= 3
  const delEstado = (g: Grupo) => (estado === 'todos' ? true : estado === 'curso' ? g.enCurso : !g.enCurso)
  const coincide = (g: Grupo) =>
    !buscando ||
    [g.siniestro, g.patente, g.compania, ...g.facturas.map((f) => `${f.puntoVenta}${String(f.numero).padStart(8, '0')} ${f.puntoVenta}${f.numero} ${f.numero} ${f.ref}`)]
      .map(normalizar)
      .some((x) => x.includes(texto))

  const cuantos = { curso: grupos.filter((g) => g.enCurso).length, cobrados: grupos.filter((g) => !g.enCurso).length, todos: grupos.length }

  // Agrupados por compañía, cada una plegable
  const porCompania = useMemo(() => {
    const m = new Map<string, { id: string; nombre: string; grupos: Grupo[] }>()
    for (const g of grupos) {
      if (!delEstado(g) || !coincide(g)) continue
      const x = m.get(g.companiaId) ?? { id: g.companiaId, nombre: g.compania, grupos: [] }
      x.grupos.push(g)
      m.set(g.companiaId, x)
    }
    return [...m.values()]
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [grupos, estado, texto])

  const totalVisibles = porCompania.reduce((t, c) => t + c.grupos.length, 0)
  // Al buscar se abre todo lo que coincide; si hay una sola compañía, también
  const companiaAbierta = (id: string) => buscando || porCompania.length === 1 || companiasAbiertas.has(id)
  const siniestroAbierto = (g: Grupo, cantidad: number) => siniestrosAbiertos.has(g.clave) || (buscando && cantidad <= 3)

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

  const etiqueta = (clase: string, t: string) => <span className={`whitespace-nowrap rounded-md px-1.5 py-0.5 text-[11px] font-bold ${clase}`}>{t}</span>

  const detalle = (g: Grupo) => (
    <div className="border-t border-slate-100">
      {/* Una fila por comprobante; en el celular los datos bajan de renglón en vez de correrse de costado */}
      <ul className="divide-y divide-slate-100 text-[13px]">
        {g.facturas.map((f) => (
          <li key={f.id}>
            <button type="button" onClick={() => abrirLegajo(f.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1.5 px-4 py-2 text-left hover:bg-marca/5">
              <span className="min-w-[9rem] font-medium">
                {formatoComprobante(f)}
                <span className="ml-2 text-xs font-normal text-slate-500">{formatoFecha(f.fecha)}</span>
              </span>
              <span className="tabular-nums">{formatoPesos(f.total)}</span>
              <BadgeEtapa etapa={calcularSemaforo(f, hoy).etapa} />
              <span className="flex flex-wrap gap-1 sm:ml-auto">{f.documentos.map(documento)}</span>
            </button>
          </li>
        ))}
        {g.notas.map((nc) => {
          const f = g.facturas.find((x) => x.id === nc.ncReferencia)
          return (
            <li key={nc.id}>
              <button type="button" onClick={() => abrirLegajo(nc.id)} className="flex w-full flex-wrap items-center gap-x-4 gap-y-1 bg-red-50/40 px-4 py-2 text-left hover:bg-marca/5">
                <span className="min-w-[9rem] font-medium text-red-800">
                  {formatoComprobante(nc)}
                  <span className="ml-2 text-xs font-normal text-slate-500">{formatoFecha(nc.fecha)}</span>
                </span>
                <span className="tabular-nums text-red-800">−{formatoPesos(Math.abs(nc.total))}</span>
                <span className="text-xs text-slate-600">
                  {!f ? 'Nota de crédito' : f.estado === 'anulada' ? `Anula completa ${formatoComprobante(f)}` : `Acredita una parte de ${formatoComprobante(f)}`}
                </span>
              </button>
            </li>
          )
        })}
      </ul>
      {g.pendientes.length > 0 && (
        <div className="border-t border-amber-200 bg-amber-50 px-4 py-2 text-xs text-amber-900">
          <div className="mb-1 font-bold">{rol === 'sucursal' ? 'Pendiente:' : 'Pendiente de la sucursal:'}</div>
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
        <ul className="space-y-1 border-t border-slate-100 bg-fondo px-4 py-2 text-xs text-slate-600">
          {g.info.map((a) => (
            <li key={a}>{a}</li>
          ))}
        </ul>
      )}
      <p className="border-t border-slate-100 px-4 py-1.5 text-[11px] text-slate-500">Cada factura se abre con sus documentos y lo que falta subir.</p>
    </div>
  )

  return (
    <>
      <EncabezadoPagina
        titulo={rol === 'sucursal' ? `Mis siniestros · ${sucursal}` : 'Siniestros'}
        subtitulo="Todas las facturas de cada siniestro, con sus documentos (también los ya aprobados) y las notas de crédito"
        sucursal={rol !== 'sucursal'}
      />

      {/* Lo primero es buscar: casi siempre se viene a ver un siniestro puntual */}
      <div className="relative mb-3">
        <Search className="pointer-events-none absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-slate-400" />
        <input
          type="search"
          value={busqueda}
          onChange={(e) => setBusqueda(e.target.value)}
          placeholder="Buscar por número de siniestro, patente o número de factura"
          className="w-full rounded-xl border border-slate-200 bg-white py-3 pl-11 pr-3 text-base shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
        />
      </div>

      <div className="mb-4 flex flex-wrap items-center gap-2">
        {(
          [
            ['curso', 'En curso', 'tienen alguna factura sin cobrar'],
            ['cobrados', 'Terminados', 'todo cobrado o anulado'],
            ['todos', 'Todos', ''],
          ] as const
        ).map(([clave, t, ayuda]) => (
          <button
            key={clave}
            type="button"
            onClick={() => setEstado(clave)}
            title={ayuda}
            className={`rounded-full border px-3 py-1.5 text-sm font-semibold ${estado === clave ? 'border-marca bg-marca text-white' : 'border-slate-200 bg-white hover:bg-fondo'}`}
          >
            {t} ({cuantos[clave].toLocaleString('es-AR')})
          </button>
        ))}
        <span className="text-xs text-slate-500">
          {estado === 'curso' ? 'En curso: tienen alguna factura sin cobrar.' : estado === 'cobrados' ? 'Terminados: todo cobrado o anulado.' : ''}
        </span>
      </div>

      <div className="mb-3 flex flex-wrap items-center gap-2 text-xs text-slate-600">
        <span className="font-semibold">Qué significan las etiquetas:</span>
        {/* Cada etiqueta con su explicación en un mismo bloque, para que no se separen al bajar de renglón */}
        {(
          [
            ['bg-amber-100 text-amber-900 ring-1 ring-amber-300', 'Falta documentación', 'subir o reemplazar un documento'],
            ['bg-red-100 text-red-800 ring-1 ring-red-300', 'Falta refacturar', 'hubo nota de crédito y no está la factura nueva'],
            [NC, 'Con nota de crédito', 'solo informativo'],
          ] as const
        ).map(([clase, nombre, ayuda]) => (
          <span key={nombre} className="inline-flex items-center gap-1.5 rounded-lg bg-white px-2 py-1 ring-1 ring-slate-200">
            {etiqueta(clase, nombre)}
            <span>{ayuda}</span>
          </span>
        ))}
      </div>

      <div className="space-y-2">
        {porCompania.map((c) => {
          const abierta = companiaAbierta(c.id)
          const conDoc = c.grupos.filter((g) => docPendiente(g) > 0).length
          const conRef = c.grupos.filter((g) => porRefacturar(g) > 0).length
          const saldo = c.grupos.reduce((t, g) => t + g.saldo, 0)
          const todos = verTodos.has(c.id) || buscando
          const lista = todos ? c.grupos : c.grupos.slice(0, POR_COMPANIA)
          return (
            <section key={c.id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <button
                type="button"
                onClick={() => alternar(companiasAbiertas, setCompaniasAbiertas, c.id)}
                aria-expanded={abierta}
                className={`flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-3 text-left hover:bg-fondo ${abierta ? 'border-b border-slate-200 bg-fondo' : ''}`}
              >
                {abierta ? <ChevronDown className="h-5 w-5 shrink-0 text-slate-500" /> : <ChevronRight className="h-5 w-5 shrink-0 text-slate-500" />}
                <span className="text-base font-bold">{c.nombre}</span>
                <span className="text-sm text-slate-500">
                  {c.grupos.length} {c.grupos.length === 1 ? 'siniestro' : 'siniestros'}
                </span>
                {conDoc > 0 && etiqueta('bg-amber-100 text-amber-900 ring-1 ring-amber-300', `${conDoc} con documentación pendiente`)}
                {conRef > 0 && etiqueta('bg-red-100 text-red-800 ring-1 ring-red-300', `${conRef} por refacturar`)}
                {saldo > 0 && <span className="ml-auto text-sm font-semibold tabular-nums">{formatoPesos(saldo)} sin cobrar</span>}
              </button>
              {abierta && (
                <ul className="divide-y divide-slate-100">
                  {lista.map((g) => {
                    const abierto = siniestroAbierto(g, c.grupos.length)
                    return (
                      <li key={g.clave}>
                        <button
                          type="button"
                          onClick={() => alternar(siniestrosAbiertos, setSiniestrosAbiertos, g.clave)}
                          aria-expanded={abierto}
                          className="flex w-full flex-wrap items-center gap-x-3 gap-y-1 px-4 py-2.5 text-left hover:bg-marca/5"
                        >
                          {abierto ? <ChevronDown className="h-4 w-4 shrink-0 text-slate-400" /> : <ChevronRight className="h-4 w-4 shrink-0 text-slate-400" />}
                          <span className="font-semibold">{g.siniestro ? `Siniestro ${g.siniestro}` : 'Sin número de siniestro'}</span>
                          <span className="text-sm text-slate-500">
                            {g.patente ? `${g.patente} · ` : ''}
                            {g.facturas.length} {g.facturas.length === 1 ? 'factura' : 'facturas'} · {formatoFecha(g.ultimaFecha)}
                          </span>
                          {docPendiente(g) > 0 && etiqueta('bg-amber-100 text-amber-900 ring-1 ring-amber-300', 'Falta documentación')}
                          {porRefacturar(g) > 0 && etiqueta('bg-red-100 text-red-800 ring-1 ring-red-300', 'Falta refacturar')}
                          {porRefacturar(g) === 0 && tieneNc(g) && etiqueta(NC, 'Con nota de crédito')}
                          {!g.enCurso && etiqueta('bg-emerald-50 text-emerald-800 ring-1 ring-emerald-300', 'Terminado')}
                          {g.saldo > 0 && <span className="ml-auto text-sm tabular-nums text-slate-700">{formatoPesos(g.saldo)}</span>}
                        </button>
                        {abierto && detalle(g)}
                      </li>
                    )
                  })}
                  {!todos && c.grupos.length > POR_COMPANIA && (
                    <li>
                      <button
                        type="button"
                        onClick={() => alternar(verTodos, setVerTodos, c.id)}
                        className="w-full px-4 py-2.5 text-center text-sm font-semibold text-marca hover:bg-marca/5"
                      >
                        Ver los otros {c.grupos.length - POR_COMPANIA} siniestros de {c.nombre}
                      </button>
                    </li>
                  )}
                </ul>
              )}
            </section>
          )
        })}
        {totalVisibles === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-slate-500">
            {buscando ? 'No hay siniestros con esta búsqueda. Conviene probar con menos números o con la patente.' : 'No hay siniestros para mostrar.'}
          </p>
        )}
      </div>
    </>
  )
}
