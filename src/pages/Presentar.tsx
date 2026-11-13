import { Link } from 'react-router-dom'
import { useEffect, useMemo, useState } from 'react'
import { ArrowLeft, CalendarCheck, Check, ChevronRight, Copy, Download, ExternalLink, Mail, MonitorUp, Search, X } from 'lucide-react'
import { EtiquetaMipyme } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { useApp, useComprobantes } from '../context/AppContext'
import { atendidaPorOtra } from '../domain/pedidos'
import { esMipyme } from '../domain/plazos'
import { calcularSemaforo } from '../domain/semaforo'
import type { Aseguradora, Comprobante } from '../domain/tipos'
import { descargarDocumentosDeGoogle } from '../services/google'
import { NOMBRE_VIA, viaDe, type Via } from '../domain/canal'
import { diffDias, sumarDias } from '../lib/fechas'
import { completarEnlace, separarLista } from '../lib/listas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/** Minutos que una factura queda "tomada" por quien está presentando, para que la otra persona no la presente también. */
const MINUTOS_TOMADA = 20

/**
 * Presentar a las compañías: lo de cada día, agrupado por compañía y por cómo recibe las facturas
 * (mail, plataforma o las dos, según Ajustes → Compañías; acá no se cambia). Por compañía: descargar todos los documentos juntos, armar el mail (o abrir
 * la plataforma) y marcar como presentadas de una vez. También vuelven acá las facturas cuya
 * documentación la compañía pidió reenviar.
 */
export default function Presentar() {
  const { datos, hoy, usuario, fuente, abrirLegajo, actualizarComprobante, registrarEvento } = useApp()
  const comprobantes = useComprobantes()
  const { aseguradoras } = datos!
  const compania = (id: string) => aseguradoras.find((a) => a.id === id)
  const [elegidas, setElegidas] = useState<Set<string>>(new Set())
  const [fecha, setFecha] = useState(hoy)
  const [buscar, setBuscar] = useState('')
  const [mails, setMails] = useState<{ a: Aseguradora | undefined; via: Via; lista: Comprobante[] } | null>(null)
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null)
  const [descargando, setDescargando] = useState<string | null>(null)

  const filas = useMemo(
    () => comprobantes.filter((c) => c.tipo === 'FC' && (c.reenviar || calcularSemaforo(c, hoy).etapa === 'pres_pendiente')),
    [comprobantes, hoy],
  )
  const texto = buscar.trim().toLowerCase()
  const visibles = texto ? filas.filter((c) => [formatoComprobante(c), c.siniestro, c.patente, c.ref, c.sucursal].join(' ').toLowerCase().includes(texto)) : filas

  // Agrupadas por compañía y por vía (cómo está definida en Ajustes → Compañías), de la que tiene más facturas a la que menos.
  // Una compañía que recibe por las dos queda dividida según cómo empieza el siniestro.
  const grupos = useMemo(() => {
    const m = new Map<string, { a: Aseguradora | undefined; via: Via; lista: Comprobante[] }>()
    for (const c of visibles) {
      const a = compania(c.aseguradoraId)
      const via = viaDe(a, c)
      const clave = `${c.aseguradoraId}|${via}`
      const g = m.get(clave) ?? { a, via, lista: [] }
      g.lista.push(c)
      m.set(clave, g)
    }
    return [...m.entries()]
      .map(([id, g]) => ({ ...g, id, dividida: g.a?.canal === 'ambas', lista: g.lista.sort((x, y) => x.fecha.localeCompare(y.fecha)) }))
      .sort((x, y) => y.lista.length - x.lista.length)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibles, aseguradoras])

  const tomarlas = (lista: Comprobante[]) => {
    const hasta = new Date(Date.now() + MINUTOS_TOMADA * 60_000).toISOString()
    for (const c of lista) if (!atendidaPorOtra(c, usuario)) actualizarComprobante(c.id, { atendiendo: { por: usuario, hasta } })
  }
  const elegidasDe = (lista: Comprobante[]) => lista.filter((c) => elegidas.has(c.id))
  const alternar = (id: string) => {
    const n = new Set(elegidas)
    if (n.has(id)) n.delete(id)
    else n.add(id)
    setElegidas(n)
  }
  const elegirTodas = (lista: Comprobante[], si: boolean) => {
    const n = new Set(elegidas)
    for (const c of lista) {
      if (si && !atendidaPorOtra(c, usuario)) n.add(c.id)
      else n.delete(c.id)
    }
    setElegidas(n)
  }

  const porDonde: Record<Via, string> = { mail: 'por mail', portal: 'por su plataforma', ambas: 'por mail o su plataforma' }
  function marcarPresentadas(a: Aseguradora | undefined, via: Via, lista: Comprobante[]) {
    for (const c of lista) {
      actualizarComprobante(c.id, {
        fechaPresentacion: fecha,
        vencimiento: sumarDias(fecha, a?.plazoPagoDias ?? 30),
        estado: 'presentada',
        reenviar: null,
        atendiendo: null,
      })
      registrarEvento(c.id, 'presentacion', `${c.reenviar ? 'Documentación reenviada' : 'Presentado'} a ${a?.nombre ?? 'la compañía'} ${porDonde[via]} (con ${lista.length} facturas)`)
    }
    elegirTodas(lista, false)
    setMensaje({ texto: `Listo: ${lista.length} ${lista.length === 1 ? 'factura quedó presentada' : 'facturas quedaron presentadas'} a ${a?.nombre ?? 'la compañía'} el ${formatoFecha(fecha)}.` })
  }

  // Un mail por factura, cada uno con el detalle de su factura y siniestro
  function armarMails(a: Aseguradora | undefined, via: Via, lista: Comprobante[]) {
    tomarlas(lista)
    setMails({ a, via, lista })
  }

  // Todos los PDF de las facturas elegidas, en un solo .zip, con el número de factura en cada nombre
  async function descargar(id: string, a: Aseguradora | undefined, via: Via, lista: Comprobante[]) {
    tomarlas(lista)
    if (fuente.tipo !== 'google') {
      setMensaje({ texto: 'La descarga de los documentos funciona en la versión conectada a la cuenta de la empresa.', error: true })
      return
    }
    setDescargando(id)
    try {
      const r = await descargarDocumentosDeGoogle(lista.map((c) => c.id), `${a?.nombre ?? 'compania'}${a?.canal === 'ambas' ? ` ${{ mail: 'mail', portal: 'plataforma', ambas: 'mail o plataforma' }[via]}` : ''} ${hoy}`)
      const bytes = Uint8Array.from(atob(r.base64), (ch) => ch.charCodeAt(0))
      const url = URL.createObjectURL(new Blob([bytes], { type: 'application/zip' }))
      const enlace = document.createElement('a')
      enlace.href = url
      enlace.download = r.nombre
      document.body.appendChild(enlace)
      enlace.click()
      enlace.remove()
      setTimeout(() => URL.revokeObjectURL(url), 1000)
      setMensaje({ texto: `Descargado: ${r.cantidad} ${r.cantidad === 1 ? 'documento' : 'documentos'}${r.faltan ? ` · ${r.faltan} sin archivo` : ''}.`, error: r.faltan > 0 })
    } catch (e) {
      setMensaje({ texto: e instanceof Error ? e.message : 'No se pudieron descargar los documentos.', error: true })
    } finally {
      setDescargando(null)
    }
  }

  function exportar() {
    descargarExcel(
      `para-presentar-${hoy}`,
      ['Compañía', 'Canal', 'Comprobante', 'Sucursal', 'Siniestro', 'Patente', 'Total', 'Doc. aprobada', 'Reenvío'],
      filas.map((c) => {
        const a = compania(c.aseguradoraId)
        return [a?.nombre ?? '', { mail: 'Mail', portal: 'Plataforma', ambas: 'Mail o plataforma' }[viaDe(a, c)], formatoComprobante(c), c.sucursal, c.siniestro, c.patente, c.total, fechaExcel(c.fechaAprobacion ?? null), c.reenviar ? 'Sí' : '']
      }),
    )
  }

  const boton = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-fondo disabled:opacity-50'
  const [abierta, setAbierta] = useState<string | null>(null)
  const grupo = grupos.find((g) => g.id === abierta) ?? null
  useEffect(() => {
    if (!abierta) return
    const alTeclear = (e: KeyboardEvent) => e.key === 'Escape' && !mails && setAbierta(null)
    window.addEventListener('keydown', alTeclear)
    return () => window.removeEventListener('keydown', alTeclear)
  }, [abierta, mails])

  return (
    <>
      <EncabezadoPagina titulo="Presentar a las compañías" sucursal />

      {/* Búsqueda y exportar */}
      <div className="mb-4 flex flex-wrap items-center gap-3">
        <label className="relative min-w-0 flex-1 basis-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
          <input
            type="search"
            value={buscar}
            onChange={(e) => setBuscar(e.target.value)}
            placeholder="Buscar por número, siniestro, patente o sucursal"
            className="w-full rounded-lg border border-slate-200 bg-white py-2.5 pl-9 pr-3 text-sm shadow-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
          />
        </label>
        <span className="text-sm text-slate-600">
          <strong>{filas.length}</strong> {filas.length === 1 ? 'factura' : 'facturas'} · {formatoPesos(filas.reduce((t, c) => t + c.total, 0))}
        </span>
        <button type="button" onClick={exportar} className={boton}>
          <Download className="h-4 w-4 text-marca" /> Exportar a Excel
        </button>
      </div>

      {mensaje && !grupo && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${mensaje.error ? 'border-sem-amarillo/40 bg-amber-50 text-amber-950' : 'border-esmeralda/30 bg-esmeralda/5 text-teal-900'}`}>{mensaje.texto}</div>
      )}

      {/* Una fila por compañía; al tocarla se abre su pantalla */}
      <div className="space-y-2">
        {grupos.map(({ a, id, via, dividida, lista }) => {
          const mipymes = lista.filter((c) => esMipyme(c)).length
          const reenvios = lista.filter((c) => c.reenviar).length
          const tomadas = lista.filter((c) => atendidaPorOtra(c, usuario)).length
          return (
            <button
              key={id}
              type="button"
              onClick={() => setAbierta(id)}
              className="group flex w-full flex-wrap items-center gap-x-4 gap-y-1 rounded-xl border border-slate-200 border-l-[6px] border-l-marca bg-white px-4 py-3 text-left shadow-sm transition hover:shadow-md"
            >
              <span className="w-12 shrink-0 text-2xl font-extrabold tabular-nums">{lista.length}</span>
              <span className="min-w-0 flex-1">
                <span className="flex flex-wrap items-center gap-2 font-bold">
                  {a?.nombre ?? id}
                  {dividida && <span className="font-semibold text-slate-500">· {NOMBRE_VIA[via].toLowerCase()}</span>}
                  {mipymes > 0 && <EtiquetaMipyme texto={`${mipymes} MiPyME`} />}
                  {reenvios > 0 && <span className="rounded bg-sem-rojo/10 px-1.5 py-0.5 text-[11px] font-bold text-red-800">{reenvios} reenvío{reenvios === 1 ? '' : 's'}</span>}
                  {tomadas > 0 && <span className="rounded bg-sky-500/10 px-1.5 py-0.5 text-[11px] font-semibold text-sky-800">{tomadas} en curso por otra persona</span>}
                </span>
                <span className="flex items-center gap-1.5 text-xs text-slate-500">
                  <IconoVia via={via} />
                  {NOMBRE_VIA[via]}
                </span>
              </span>
              <span className="shrink-0 text-sm font-semibold tabular-nums">{formatoPesos(lista.reduce((t, c) => t + c.total, 0))}</span>
              <span className="hidden shrink-0 items-center gap-1 text-xs font-semibold text-marca group-hover:underline sm:inline-flex">
                Abrir <ChevronRight className="h-4 w-4" />
              </span>
            </button>
          )
        })}
        {grupos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {texto ? 'Sin facturas con esa búsqueda.' : 'Sin facturas para presentar.'}
          </p>
        )}
      </div>

      {/* Pantalla de una compañía: elegir, descargar, enviar y marcar */}
      {grupo &&
        (() => {
          const { a, id, via, dividida, lista } = grupo
          const elegidasAca = elegidasDe(lista)
          const disponibles = lista.filter((c) => !atendidaPorOtra(c, usuario))
          const todas = disponibles.length > 0 && disponibles.every((c) => elegidas.has(c.id))
          return (
            <div className="fixed inset-0 z-40 flex items-stretch justify-center bg-noche/40 sm:p-6" role="dialog" aria-modal="true" aria-labelledby="titulo-compania">
              <div className="flex w-full max-w-6xl flex-col overflow-hidden bg-fondo shadow-2xl sm:rounded-2xl">
                <div className="flex flex-wrap items-center gap-3 border-b border-slate-200 bg-white px-4 py-3 sm:px-6">
                  <button type="button" onClick={() => setAbierta(null)} className="inline-flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-semibold text-marca hover:bg-fondo">
                    <ArrowLeft className="h-4 w-4" /> Presentar
                  </button>
                  <div className="min-w-0 flex-1">
                    <h2 id="titulo-compania" className="font-extrabold">
                      {a?.nombre ?? id}
                      {dividida && ` · ${NOMBRE_VIA[via].toLowerCase()}`} · {lista.length} {lista.length === 1 ? 'factura' : 'facturas'}
                    </h2>
                    {a ? <ContactosCompania a={a} via={via} /> : null}
                  </div>
                  <button type="button" onClick={() => setAbierta(null)} aria-label="Cerrar" className="rounded-lg p-1.5 hover:bg-fondo">
                    <X className="h-5 w-5" />
                  </button>
                </div>

                {/* Acciones sobre las elegidas */}
                <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 bg-white px-4 py-2.5 sm:px-6">
                  <span className="text-sm text-slate-600">
                    {elegidasAca.length ? (
                      <>
                        <strong>{elegidasAca.length}</strong> elegidas · {formatoPesos(elegidasAca.reduce((t, c) => t + c.total, 0))}
                      </>
                    ) : (
                      'Ninguna elegida'
                    )}
                  </span>
                  <div className="ml-auto flex flex-wrap items-center gap-2">
                    <button type="button" disabled={!elegidasAca.length || descargando === id} onClick={() => descargar(id, a, via, elegidasAca)} className={boton}>
                      <Download className="h-4 w-4 text-marca" /> {descargando === id ? 'Preparando…' : 'Descargar documentos'}
                    </button>
                    {via !== 'portal' && (
                      <button type="button" disabled={!elegidasAca.length} onClick={() => armarMails(a, via, elegidasAca)} className={boton}>
                        <Mail className="h-4 w-4 text-marca" /> Armar los mails
                      </button>
                    )}
                    <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className={claseSelect} aria-label="Fecha de presentación" />
                    <button
                      type="button"
                      disabled={!elegidasAca.length}
                      onClick={() => marcarPresentadas(a, via, elegidasAca)}
                      className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
                    >
                      <CalendarCheck className="h-4 w-4" /> Marcar como presentadas
                    </button>
                  </div>
                </div>

                {mensaje && (
                  <div className={`border-b px-6 py-2 text-sm ${mensaje.error ? 'border-sem-amarillo/40 bg-amber-50 text-amber-950' : 'border-esmeralda/30 bg-esmeralda/5 text-teal-900'}`}>{mensaje.texto}</div>
                )}

                <div className="flex-1 overflow-y-auto p-3 sm:p-6">
                  <div className="overflow-x-auto rounded-xl border border-slate-200 bg-white">
                    <table className="w-full text-left text-[13px]">
                      <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                        <tr>
                          <th className="w-10 px-4 py-2">
                            <input type="checkbox" aria-label="Elegir todas" checked={todas} onChange={(e) => elegirTodas(lista, e.target.checked)} />
                          </th>
                          <th className="px-2 py-2">Comprobante</th>
                          <th className="hidden px-2 py-2 sm:table-cell">Sucursal</th>
                          <th className="hidden px-2 py-2 md:table-cell">Siniestro</th>
                          <th className="px-2 py-2 text-right">Total</th>
                          <th className="hidden px-2 py-2 md:table-cell">Doc. aprobada</th>
                          <th className="hidden px-4 py-2 text-right sm:table-cell">Días</th>
                        </tr>
                      </thead>
                      <tbody className="divide-y divide-slate-100">
                        {lista.map((c) => {
                          const otra = atendidaPorOtra(c, usuario)
                          return (
                            <tr key={c.id} onClick={() => abrirLegajo(c.id)} className={`cursor-pointer hover:bg-marca/5 ${otra ? 'bg-slate-50 text-slate-400' : ''}`}>
                              <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                                <input type="checkbox" aria-label="Elegir esta factura" disabled={!!otra} checked={elegidas.has(c.id)} onChange={() => alternar(c.id)} />
                              </td>
                              <td className="px-2 py-2 font-medium sm:whitespace-nowrap">
                                {formatoComprobante(c)}
                                {esMipyme(c) && (
                                  <span className="ml-1.5">
                                    <EtiquetaMipyme chica />
                                  </span>
                                )}
                                {c.reenviar && <span className="ml-1.5 rounded bg-sem-rojo/10 px-1 text-[11px] font-bold text-red-800">Reenvío</span>}
                                {otra && <span className="ml-1.5 rounded bg-sky-500/10 px-1 text-[11px] font-semibold text-sky-800">La está presentando {otra}</span>}
                                {/* en el celular, la sucursal va debajo del número */}
                                <span className="block text-xs font-normal text-slate-500 sm:hidden">
                                  {c.sucursal} · {diffDias(c.fecha, hoy)} días
                                </span>
                              </td>
                              <td className="hidden whitespace-nowrap px-2 py-2 sm:table-cell">{c.sucursal}</td>
                              <td className="hidden whitespace-nowrap px-2 py-2 text-slate-600 md:table-cell">{c.siniestro}</td>
                              <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatoPesos(c.total)}</td>
                              <td className="hidden whitespace-nowrap px-2 py-2 md:table-cell">{formatoFecha(c.fechaAprobacion ?? null)}</td>
                              <td className="hidden px-4 py-2 text-right tabular-nums sm:table-cell">{diffDias(c.fecha, hoy)}</td>
                            </tr>
                          )
                        })}
                      </tbody>
                    </table>
                  </div>
                </div>
              </div>
            </div>
          )
        })()}

      {mails && (
        <MailsPorFactura
          {...mails}
          descargando={descargando}
          onDescargar={(c) => void descargar(`mail-${c.id}`, mails.a, mails.via, [c])}
          onPresentada={(c) => marcarPresentadas(mails.a, mails.via, [c])}
          presentada={(c) => !comprobantes.some((x) => x.id === c.id && (x.reenviar || calcularSemaforo(x, hoy).etapa === 'pres_pendiente'))}
          onCerrar={() => setMails(null)}
        />
      )}
    </>
  )
}

/**
 * Los mails y enlaces de la compañía, a mano para presentar (y para reclamar). Se cambian en
 * Ajustes → Compañías; acá solo se usan: abrir la plataforma, copiar un mail o escribirle.
 */
function ContactosCompania({ a, via }: { a: Aseguradora; via: Via }) {
  const [copiado, setCopiado] = useState<string | null>(null)
  const copiar = async (texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(texto)
      window.setTimeout(() => setCopiado(null), 1500)
    } catch {
      // sin portapapeles: queda el mail a la vista para copiarlo a mano
    }
  }
  // Solo lo que sirve para esta vía (si son las dos, todo)
  const enlaces = via === 'mail' ? [] : separarLista(a.portalUrl)
  const mails = via === 'portal' ? [] : separarLista(a.email)
  const reclamos = separarLista(a.emailReclamos).filter((m) => !mails.includes(m))
  const chipMail = (m: string) => (
    <span key={m} className="inline-flex items-center gap-1 rounded-full border border-slate-200 bg-white py-0.5 pl-2 pr-1 text-xs">
      <a href={`mailto:${m}`} className="text-noche hover:underline">
        {m}
      </a>
      <button type="button" onClick={() => void copiar(m)} className="rounded-full p-0.5 text-slate-400 hover:bg-fondo hover:text-marca" title="Copiar">
        {copiado === m ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />}
      </button>
    </span>
  )
  return (
    <div className="mt-1 space-y-1 text-xs text-slate-500">
      <div className="flex flex-wrap items-center gap-1.5">
        <span className="font-semibold text-slate-600">{NOMBRE_VIA[via]}:</span>
        {enlaces.map((url, i) => (
          <a
            key={url}
            href={completarEnlace(url)}
            target="_blank"
            rel="noreferrer"
            className="inline-flex items-center gap-1 rounded-full border border-marca/30 bg-marca/5 px-2 py-0.5 font-semibold text-marca hover:bg-marca/10"
          >
            {enlaces.length > 1 ? `Plataforma ${i + 1}` : 'Abrir la plataforma'} <ExternalLink className="h-3 w-3" />
          </a>
        ))}
        {mails.map(chipMail)}
        {!enlaces.length && !mails.length && <span className="text-amber-700">Sin mails ni enlaces cargados</span>}
      </div>
      {reclamos.length > 0 && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="font-semibold text-slate-600">Para reclamos:</span>
          {reclamos.map(chipMail)}
        </div>
      )}
      <Link to="/app/companias" className="inline-block text-[11px] text-slate-400 hover:text-marca hover:underline">
        Sumar o cambiar mails y enlaces (Ajustes → Compañías)
      </Link>
    </div>
  )
}

function IconoVia({ via }: { via: Via }) {
  if (via === 'portal') return <MonitorUp className="h-3.5 w-3.5" />
  if (via === 'mail') return <Mail className="h-3.5 w-3.5" />
  return (
    <>
      <Mail className="h-3.5 w-3.5" />
      <MonitorUp className="h-3.5 w-3.5" />
    </>
  )
}

/** Asunto y texto del mail de una factura: cada factura va en su propio mail. */
function mailDeFactura(a: Aseguradora | undefined, c: Comprobante) {
  const numero = formatoComprobante(c)
  const partes = [`Factura ${numero}`, c.siniestro && `Siniestro ${c.siniestro}`, c.patente && `Patente ${c.patente}`].filter(Boolean)
  const detalle = [`Factura: ${numero}`, c.siniestro && `Siniestro: ${c.siniestro}`, c.patente && `Patente: ${c.patente}`, `Importe: ${formatoPesos(c.total)}`]
    .filter(Boolean)
    .join('\n')
  const inicio = c.reenviar
    ? 'Se reenvía la documentación de la siguiente factura, con la orden de reparación o repuestos firmada por el cliente:'
    : 'Se envía para su liquidación la siguiente factura, con la orden de reparación o repuestos firmada por el cliente:'
  return {
    asunto: `${c.reenviar ? 'Reenvío de documentación · ' : ''}${partes.join(' · ')}${a?.razonSocial || a?.nombre ? ` · ${a.razonSocial ?? a.nombre}` : ''}`,
    texto: `Buenos días:\n\n${inicio}\n\n${detalle}\n\nQuedamos a disposición por cualquier consulta.\nSaludos,\nCobranzas`,
  }
}

/** Los mails de las facturas elegidas, uno por factura: abrir en el correo, copiar, bajar sus documentos y marcarla. */
function MailsPorFactura({
  a,
  lista,
  descargando,
  onDescargar,
  onPresentada,
  presentada,
  onCerrar,
}: {
  a: Aseguradora | undefined
  via: Via
  lista: Comprobante[]
  descargando: string | null
  onDescargar: (c: Comprobante) => void
  onPresentada: (c: Comprobante) => void
  presentada: (c: Comprobante) => boolean
  onCerrar: () => void
}) {
  const para = separarLista(a?.email).join(',')
  const [copiado, setCopiado] = useState<string | null>(null)
  const [abiertos, setAbiertos] = useState<Set<string>>(new Set())
  const copiar = async (clave: string, texto: string) => {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(clave)
      window.setTimeout(() => setCopiado(null), 1500)
    } catch {
      // sin portapapeles: el texto queda a la vista
    }
  }
  const listas = lista.filter(presentada).length
  const chico = 'inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold hover:bg-fondo disabled:opacity-50'
  return (
    <>
      <div className="fixed inset-0 z-50 bg-noche/40" onClick={onCerrar} aria-hidden="true" />
      <div className="fixed inset-x-0 top-6 z-50 mx-auto flex max-h-[90vh] w-[min(46rem,95vw)] flex-col rounded-xl bg-white shadow-2xl" role="dialog" aria-label="Mails de presentación">
        <div className="flex items-start justify-between gap-3 border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-extrabold">
              {lista.length} {lista.length === 1 ? 'mail' : 'mails'} para {a?.nombre ?? 'la compañía'}
            </h2>
            <p className="text-xs text-slate-500">
              Uno por factura{para ? ` · Para: ${para}` : ' · Sin mail cargado en Ajustes → Compañías'} · {listas} de {lista.length} marcadas como presentadas
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-fondo">
            <X className="h-5 w-5" />
          </button>
        </div>
        <div className="flex-1 space-y-3 overflow-y-auto p-5">
          {lista.map((c) => {
            const { asunto, texto } = mailDeFactura(a, c)
            const lista_ = presentada(c)
            const mailto = para ? `mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}` : null
            return (
              <div key={c.id} className={`rounded-xl border p-3 ${lista_ ? 'border-esmeralda/40 bg-esmeralda/5' : 'border-slate-200'}`}>
                <div className="flex flex-wrap items-start justify-between gap-2">
                  <div className="min-w-0 flex-1">
                    <div className="text-sm font-semibold">{asunto}</div>
                    <div className="text-xs text-slate-500">{formatoPesos(c.total)}{abiertos.has(c.id) && !lista_ ? ' · abierto en el correo' : ''}</div>
                  </div>
                  {lista_ && (
                    <span className="inline-flex items-center gap-1 rounded-full bg-esmeralda/15 px-2 py-0.5 text-xs font-bold text-teal-800">
                      <Check className="h-3.5 w-3.5" /> Presentada
                    </span>
                  )}
                </div>
                <details className="mt-1 text-xs">
                  <summary className="cursor-pointer text-slate-500 hover:text-marca">Ver el texto</summary>
                  <pre className="mt-1 whitespace-pre-wrap rounded-lg bg-fondo p-2 font-sans">{texto}</pre>
                </details>
                <div className="mt-2 flex flex-wrap gap-2">
                  {mailto && (
                    <a href={mailto} onClick={() => setAbiertos(new Set(abiertos).add(c.id))} className={chico}>
                      <Mail className="h-3.5 w-3.5 text-marca" /> Abrir en el correo
                    </a>
                  )}
                  <button type="button" onClick={() => void copiar(`${c.id}-asunto`, asunto)} className={chico}>
                    {copiado === `${c.id}-asunto` ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />} Copiar asunto
                  </button>
                  <button type="button" onClick={() => void copiar(`${c.id}-texto`, texto)} className={chico}>
                    {copiado === `${c.id}-texto` ? <Check className="h-3.5 w-3.5 text-teal-600" /> : <Copy className="h-3.5 w-3.5" />} Copiar texto
                  </button>
                  <button type="button" onClick={() => onDescargar(c)} disabled={descargando === `mail-${c.id}`} className={chico}>
                    <Download className="h-3.5 w-3.5 text-marca" /> {descargando === `mail-${c.id}` ? 'Preparando…' : 'Sus documentos'}
                  </button>
                  {!lista_ && (
                    <button type="button" onClick={() => onPresentada(c)} className="inline-flex items-center gap-1 rounded-lg bg-marca px-2.5 py-1 text-xs font-semibold text-white hover:bg-marca-oscuro">
                      <CalendarCheck className="h-3.5 w-3.5" /> Enviado: marcar presentada
                    </button>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </>
  )
}
