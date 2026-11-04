import { useMemo, useState } from 'react'
import { CalendarCheck, Download, ExternalLink, Mail, MonitorUp, Search } from 'lucide-react'
import { EtiquetaMipyme } from '../components/ui/Badges'
import { EncabezadoPagina } from '../components/ui/Card'
import { claseSelect } from '../components/ui/Estados'
import { listaParaMail, TextoMail } from '../components/TextoMail'
import { useApp, useComprobantes } from '../context/AppContext'
import { atendidaPorOtra } from '../domain/pedidos'
import { esMipyme } from '../domain/plazos'
import { calcularSemaforo } from '../domain/semaforo'
import type { Aseguradora, Comprobante } from '../domain/tipos'
import { descargarDocumentosDeGoogle } from '../services/google'
import { diffDias, sumarDias } from '../lib/fechas'
import { descargarExcel, fechaExcel } from '../lib/exportar'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'

/** Minutos que una factura queda "tomada" por quien está presentando, para que la otra persona no la presente también. */
const MINUTOS_TOMADA = 20

/**
 * Presentar a las compañías: lo de cada día, agrupado por compañía y por cómo recibe las facturas
 * (mail o plataforma). Por compañía: descargar todos los documentos juntos, armar el mail (o abrir
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
  const [mail, setMail] = useState<{ asunto: string; texto: string; para?: string } | null>(null)
  const [mensaje, setMensaje] = useState<{ texto: string; error?: boolean } | null>(null)
  const [descargando, setDescargando] = useState<string | null>(null)

  const filas = useMemo(
    () => comprobantes.filter((c) => c.tipo === 'FC' && (c.reenviar || calcularSemaforo(c, hoy).etapa === 'pres_pendiente')),
    [comprobantes, hoy],
  )
  const texto = buscar.trim().toLowerCase()
  const visibles = texto ? filas.filter((c) => [formatoComprobante(c), c.siniestro, c.patente, c.ref, c.sucursal].join(' ').toLowerCase().includes(texto)) : filas

  // Agrupadas por compañía, de la que tiene más facturas a la que menos
  const grupos = useMemo(() => {
    const m = new Map<string, Comprobante[]>()
    for (const c of visibles) m.set(c.aseguradoraId, [...(m.get(c.aseguradoraId) ?? []), c])
    return [...m.entries()]
      .map(([id, lista]) => ({ a: compania(id), id, lista: lista.sort((x, y) => x.fecha.localeCompare(y.fecha)) }))
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

  function marcarPresentadas(a: Aseguradora | undefined, lista: Comprobante[]) {
    for (const c of lista) {
      actualizarComprobante(c.id, {
        fechaPresentacion: fecha,
        vencimiento: sumarDias(fecha, a?.plazoPagoDias ?? 30),
        estado: 'presentada',
        reenviar: null,
        atendiendo: null,
      })
      registrarEvento(c.id, 'presentacion', `${c.reenviar ? 'Documentación reenviada' : 'Presentado'} a ${a?.nombre ?? 'la compañía'} ${a?.canal === 'portal' ? 'por su plataforma' : 'por mail'} (con ${lista.length} facturas)`)
    }
    elegirTodas(lista, false)
    setMensaje({ texto: `Listo: ${lista.length} ${lista.length === 1 ? 'factura quedó presentada' : 'facturas quedaron presentadas'} a ${a?.nombre ?? 'la compañía'} el ${formatoFecha(fecha)}.` })
  }

  function armarMail(a: Aseguradora | undefined, lista: Comprobante[]) {
    tomarlas(lista)
    setMail({
      asunto: `Presentación de facturas · ${a?.razonSocial ?? a?.nombre ?? ''}`,
      texto: `Buenos días:\n\nSe envían para su liquidación las siguientes facturas, con la orden de reparación o repuestos firmada por el cliente:\n\n${listaParaMail(
        lista.map((c) => ({ numero: formatoComprobante(c), siniestro: c.siniestro, total: c.total, extra: c.reenviar ? 'reenvío de documentación' : undefined })),
        formatoPesos,
      )}\n\nQuedamos a disposición por cualquier consulta.\nSaludos,\nAuditoría`,
      para: a?.email || undefined,
    })
  }

  // Todos los PDF de las facturas elegidas, en un solo .zip, con el número de factura en cada nombre
  async function descargar(id: string, a: Aseguradora | undefined, lista: Comprobante[]) {
    tomarlas(lista)
    if (fuente.tipo !== 'google') {
      setMensaje({ texto: 'La descarga de los documentos funciona en la versión conectada a la cuenta de la empresa.', error: true })
      return
    }
    setDescargando(id)
    try {
      const r = await descargarDocumentosDeGoogle(lista.map((c) => c.id), `${a?.nombre ?? 'compania'} ${hoy}`)
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
        return [a?.nombre ?? '', a?.canal === 'portal' ? 'Plataforma' : 'Mail', formatoComprobante(c), c.sucursal, c.siniestro, c.patente, c.total, fechaExcel(c.fechaAprobacion ?? null), c.reenviar ? 'Sí' : '']
      }),
    )
  }

  const boton = 'inline-flex items-center gap-1.5 rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm font-semibold hover:bg-fondo disabled:opacity-50'

  return (
    <>
      <EncabezadoPagina
        titulo="Presentar a las compañías"
        subtitulo="Lo aprobado para presentar, por compañía: descargar los documentos, enviar por mail o por su plataforma y marcar como presentadas."
        sucursal
      />

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
        <label className="flex items-center gap-2 text-xs font-semibold text-slate-500">
          Fecha de presentación
          <input type="date" value={fecha} max={hoy} onChange={(e) => setFecha(e.target.value || hoy)} className={claseSelect} />
        </label>
        <button type="button" onClick={exportar} className={boton}>
          <Download className="h-4 w-4 text-marca" /> Exportar a Excel
        </button>
      </div>

      {mensaje && (
        <div className={`mb-4 rounded-lg border px-4 py-3 text-sm ${mensaje.error ? 'border-sem-amarillo/40 bg-amber-50 text-amber-950' : 'border-esmeralda/30 bg-esmeralda/5 text-teal-900'}`}>{mensaje.texto}</div>
      )}

      <p className="mb-3 text-sm text-slate-600">
        <strong>{filas.length}</strong> {filas.length === 1 ? 'factura' : 'facturas'} para presentar en <strong>{grupos.length}</strong>{' '}
        {grupos.length === 1 ? 'compañía' : 'compañías'} · {formatoPesos(filas.reduce((t, c) => t + c.total, 0))}
      </p>

      <div className="space-y-4">
        {grupos.map(({ a, id, lista }) => {
          const elegidasAca = elegidasDe(lista)
          const disponibles = lista.filter((c) => !atendidaPorOtra(c, usuario))
          const todas = disponibles.length > 0 && disponibles.every((c) => elegidas.has(c.id))
          const porPortal = a?.canal === 'portal'
          return (
            <section key={id} className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
              <div className="flex flex-col gap-3 border-b border-slate-200 bg-fondo px-4 py-3 xl:flex-row xl:items-center">
                <div className="min-w-0 flex-1">
                  <h2 className="font-bold">
                    {a?.nombre ?? id} <span className="font-normal text-slate-500">· {lista.length} {lista.length === 1 ? 'factura' : 'facturas'} · {formatoPesos(lista.reduce((t, c) => t + c.total, 0))}</span>
                  </h2>
                  <p className="text-xs text-slate-500">
                    {porPortal ? (
                      <>
                        Por su plataforma
                        {a?.portalUrl && (
                          <>
                            {' · '}
                            <a href={a.portalUrl} target="_blank" rel="noreferrer" className="inline-flex items-center gap-1 font-semibold text-marca hover:underline">
                              Abrir la plataforma <ExternalLink className="h-3 w-3" />
                            </a>
                          </>
                        )}
                      </>
                    ) : (
                      <>Por mail{a?.email ? ` a ${a.email}` : ' (falta el correo en Compañías)'}</>
                    )}
                  </p>
                </div>
                <div className="flex flex-wrap items-center gap-2 xl:justify-end">
                  <span className="text-xs text-slate-500">{elegidasAca.length ? `${elegidasAca.length} elegidas` : 'Ninguna elegida'}</span>
                  <button type="button" disabled={!elegidasAca.length || descargando === id} onClick={() => descargar(id, a, elegidasAca)} className={boton}>
                    <Download className="h-4 w-4 text-marca" /> {descargando === id ? 'Preparando…' : 'Descargar documentos'}
                  </button>
                  {porPortal ? (
                    <span className="inline-flex items-center gap-1.5 text-xs text-slate-500">
                      <MonitorUp className="h-4 w-4" /> Se cargan en la plataforma
                    </span>
                  ) : (
                    <button type="button" disabled={!elegidasAca.length} onClick={() => armarMail(a, elegidasAca)} className={boton}>
                      <Mail className="h-4 w-4 text-marca" /> Armar el mail
                    </button>
                  )}
                  <button
                    type="button"
                    disabled={!elegidasAca.length}
                    onClick={() => marcarPresentadas(a, elegidasAca)}
                    className="inline-flex items-center gap-1.5 rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
                  >
                    <CalendarCheck className="h-4 w-4" /> Marcar como presentadas
                  </button>
                </div>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full text-left text-[13px]">
                  <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                    <tr>
                      <th className="w-10 px-4 py-2">
                        <input type="checkbox" aria-label="Elegir todas las de esta compañía" checked={todas} onChange={(e) => elegirTodas(lista, e.target.checked)} />
                      </th>
                      <th className="px-2 py-2">Comprobante</th>
                      <th className="px-2 py-2">Sucursal</th>
                      <th className="px-2 py-2">Siniestro</th>
                      <th className="px-2 py-2 text-right">Total</th>
                      <th className="px-2 py-2">Doc. aprobada</th>
                      <th className="px-4 py-2 text-right">Días</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100">
                    {lista.map((c) => {
                      const otra = atendidaPorOtra(c, usuario)
                      return (
                        <tr key={c.id} onClick={() => abrirLegajo(c.id)} className={`cursor-pointer hover:bg-marca/5 ${otra ? 'bg-slate-50 text-slate-400' : ''}`}>
                          <td className="px-4 py-2" onClick={(e) => e.stopPropagation()}>
                            <input
                              type="checkbox"
                              aria-label="Elegir esta factura"
                              disabled={!!otra}
                              checked={elegidas.has(c.id)}
                              onChange={() => alternar(c.id)}
                            />
                          </td>
                          <td className="whitespace-nowrap px-2 py-2 font-medium">
                            {formatoComprobante(c)}
                            {esMipyme(c) && <span className="ml-1.5"><EtiquetaMipyme chica /></span>}
                            {c.reenviar && <span className="ml-1.5 rounded bg-sem-rojo/10 px-1 text-[11px] font-bold text-red-800">Reenvío</span>}
                            {otra && <span className="ml-1.5 rounded bg-sky-500/10 px-1 text-[11px] font-semibold text-sky-800">La está presentando {otra}</span>}
                          </td>
                          <td className="whitespace-nowrap px-2 py-2">{c.sucursal}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-slate-600">{c.siniestro}</td>
                          <td className="whitespace-nowrap px-2 py-2 text-right tabular-nums">{formatoPesos(c.total)}</td>
                          <td className="whitespace-nowrap px-2 py-2">{formatoFecha(c.fechaAprobacion ?? null)}</td>
                          <td className="px-4 py-2 text-right tabular-nums">{diffDias(c.fecha, hoy)}</td>
                        </tr>
                      )
                    })}
                  </tbody>
                </table>
              </div>
            </section>
          )
        })}
        {grupos.length === 0 && (
          <p className="rounded-xl border border-slate-200 bg-white p-8 text-center text-sm text-slate-500">
            {texto ? 'Sin facturas con esa búsqueda.' : 'Sin facturas para presentar: todo lo aprobado ya se presentó.'}
          </p>
        )}
      </div>

      {mail && <TextoMail titulo="Mail de presentación" {...mail} onCerrar={() => setMail(null)} />}
    </>
  )
}
