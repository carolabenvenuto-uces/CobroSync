import { ArrowLeft, Bell, ExternalLink, Inbox, Search, Star, StickyNote, X } from 'lucide-react'
import { useEffect, useMemo, useRef, useState } from 'react'
import { useMarcadores } from '../lib/marcadores'
import { NavLink, useNavigate } from 'react-router-dom'
import { useApp, type Notificacion } from '../context/AppContext'
import { calcularSemaforo } from '../domain/semaforo'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { diffDias } from '../lib/fechas'
import { partesDe } from '../lib/notificaciones'
import { BadgeEtapa } from './ui/Badges'
import { EncabezadoPagina } from './ui/Card'

/**
 * Acceso a la bandeja desde el menú, con la cantidad sin leer. A la sucursal le avisa lo que hizo
 * Auditoría (observaciones, mensajes, rechazos); a Auditoría, lo que hicieron las sucursales; a
 * Gerencia, solo los escalamientos.
 */
export function Campana({ onCerrar }: { onCerrar?: () => void }) {
  const { misNotificaciones } = useApp()
  const sinLeer = misNotificaciones.filter((n) => !n.leida).length
  return (
    <NavLink
      to="/app/notificaciones"
      onClick={onCerrar}
      className={({ isActive }) =>
        `flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors ${isActive ? 'bg-marca text-white' : 'text-slate-300 hover:bg-white/5 hover:text-white'}`
      }
    >
      <Bell className="h-4 w-4" />
      <span className="flex-1 text-left">Notificaciones</span>
      {sinLeer > 0 && <span className="rounded-full bg-marca px-2 py-0.5 text-[11px] font-bold text-white">{sinLeer}</span>}
    </NavLink>
  )
}

/** Rechazo en rojo (lo más importante: hay que reemplazar un documento); documentación en amarillo. */
function EtiquetaTema({ tema }: { tema: 'rechazo' | 'documentacion' }) {
  return tema === 'rechazo' ? (
    <span className="shrink-0 rounded bg-sem-rojo px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-white">Rechazo</span>
  ) : (
    <span className="shrink-0 rounded bg-amber-100 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wide text-amber-900">Documentación</span>
  )
}

function cuando(fecha: string, hoy: string): string {
  const d = diffDias(fecha, hoy)
  if (d <= 0) return 'Hoy'
  if (d === 1) return 'Ayer'
  if (d < 7) return `Hace ${d} días`
  return formatoFecha(fecha)
}

/**
 * Bandeja de notificaciones con forma de mail, que es lo que todos conocen: a la izquierda la
 * lista (las no leídas en negrita), a la derecha el mensaje completo con la factura y el botón para
 * abrirla. En el celular, primero la lista y al tocar se abre el mensaje.
 */
export default function BandejaNotificaciones() {
  const { rol, fuente, datos, hoy, misNotificaciones, marcarLeida, marcarTodasLeidas, abrirLegajo, cuenta, usuario } = useApp()
  // Destacadas y notas propias: de cada persona, en este navegador
  const marcas = useMarcadores(cuenta?.email ?? `${rol}-${usuario}`)
  const navigate = useNavigate()
  // Sucursal: todas, rechazos o documentación faltante (lo no leído ya se distingue en negrita).
  // Auditoría y Gerencia: todas o sin leer.
  const [ver, setVer] = useState<'todas' | 'sin_leer' | 'rechazos' | 'documentacion' | 'destacadas'>('todas')
  const [buscar, setBuscar] = useState('')
  const [elegida, setElegida] = useState<string | null>(null)

  const porId = useMemo(() => new Map((datos?.comprobantes ?? []).map((c) => [c.id, c])), [datos])
  const nombreCompania = (id: string) => datos?.aseguradoras.find((a) => a.id === id)?.nombre ?? id
  const sinLeer = misNotificaciones.filter((n) => !n.leida).length
  const rechazos = misNotificaciones.filter((n) => n.tema === 'rechazo').length
  const documentacion = misNotificaciones.filter((n) => n.tema === 'documentacion').length
  const normal = (t: string) => t.toLowerCase().replace(/[^0-9a-z]/g, '')
  const lista = useMemo(
    () =>
      [...misNotificaciones]
        .filter((n) => {
          if (n.id === elegida) return true
          if (ver === 'rechazos' && n.tema !== 'rechazo') return false
          if (ver === 'documentacion' && n.tema !== 'documentacion') return false
          if (ver === 'sin_leer' && n.leida) return false
          if (ver === 'destacadas' && !marcas.esDestacada(n.id)) return false
          // Búsqueda por número de factura (o cualquier texto del mensaje)
          const t = normal(buscar)
          if (t.length >= 2) {
            // los avisos que juntan varias facturas se encuentran por cualquiera de ellas
            const cs = (n.facturas ?? [n.comprobanteId]).map((id) => porId.get(id)).filter((x) => x !== undefined)
            const textos = [n.texto, n.sucursal ?? '', ...cs.flatMap((c) => [formatoComprobante(c), c.siniestro ?? '', `${c.puntoVenta}${c.numero}`])]
            if (!textos.some((x) => normal(x).includes(t))) return false
          }
          return true
        })
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [misNotificaciones, ver, elegida, buscar, porId, marcas],
  )
  const actual = misNotificaciones.find((n) => n.id === elegida) ?? null

  const remitente = (n: Notificacion) => {
    if (rol === 'sucursal') return 'Auditoría'
    if (rol === 'gerencia') return n.sucursal ? `Auditoría · ${n.sucursal}` : 'Auditoría'
    return n.sucursal ?? porId.get(n.comprobanteId)?.sucursal ?? 'Sucursal'
  }

  const abrir = (n: Notificacion) => {
    setElegida(n.id)
    if (!n.leida) marcarLeida(n.id)
  }

  const irALaFactura = (n: Notificacion) => {
    if (n.ruta) navigate(n.ruta)
    else abrirLegajo(n.comprobanteId)
  }

  const detalle = (n: Notificacion) => {
    const c = porId.get(n.comprobanteId)
    const varias = (n.facturas ?? []).map((id) => porId.get(id)).filter((x) => x !== undefined)
    return (
      <article className="flex h-full flex-col">
        <button type="button" onClick={() => setElegida(null)} className="mb-4 flex items-center gap-1 text-sm font-semibold text-marca hover:underline">
          <ArrowLeft className="h-4 w-4" /> Volver a la bandeja
        </button>
        {n.tema && n.tema !== 'mensaje' && (
          <div className="mb-1">
            <EtiquetaTema tema={n.tema} />
          </div>
        )}
        <div className="flex items-start justify-between gap-3">
          <h2 className="text-lg font-extrabold leading-snug">{partesDe(n.texto).asunto}</h2>
          <button
            type="button"
            onClick={() => marcas.alternarDestacada(n.id)}
            aria-pressed={marcas.esDestacada(n.id)}
            className={`inline-flex shrink-0 items-center gap-1 rounded-lg border px-2.5 py-1 text-xs font-semibold ${marcas.esDestacada(n.id) ? 'border-amber-300 bg-amber-50 text-amber-900' : 'border-slate-200 text-slate-600 hover:bg-fondo'}`}
          >
            <Star className={`h-3.5 w-3.5 ${marcas.esDestacada(n.id) ? 'fill-amber-400 text-amber-500' : ''}`} /> {marcas.esDestacada(n.id) ? 'Destacada' : 'Destacar'}
          </button>
        </div>
        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
          <span>
            De: <strong className="text-slate-700">{remitente(n)}</strong>
          </span>
          {partesDe(n.texto).factura && <span>Factura: <strong className="text-slate-700">{partesDe(n.texto).factura}</strong></span>}
          <span>{formatoFecha(n.fecha)}</span>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-800">{partesDe(n.texto).cuerpo}</p>

        {/* Nota para uno mismo, para no olvidarse de algo (solo la ve quien la escribe) */}
        <label className="mt-4 block rounded-xl border border-amber-200 bg-amber-50/60 p-3 text-xs font-semibold text-amber-900">
          <span className="flex items-center gap-1.5">
            <StickyNote className="h-3.5 w-3.5" /> Nota para mí
          </span>
          <textarea
            key={n.id}
            defaultValue={marcas.nota(n.id)}
            onBlur={(e) => marcas.guardarNota(n.id, e.target.value)}
            rows={2}
            placeholder="Por ejemplo: llamar el lunes a la sucursal"
            className="mt-1.5 w-full rounded-lg border border-amber-200 bg-white px-2.5 py-1.5 text-sm font-normal text-noche focus:border-amber-400 focus:outline-none"
          />
          <span className="mt-1 block text-[11px] font-normal text-amber-800/80">Se guarda sola al salir del campo. Solo la ve quien la escribe.</span>
        </label>

        {c && varias.length <= 1 && (
          <button
            type="button"
            onClick={() => irALaFactura(n)}
            className="mt-5 flex w-full flex-wrap items-center justify-between gap-2 rounded-xl border border-slate-200 bg-fondo p-3 text-left hover:border-marca"
          >
            <span>
              <span className="block font-bold">{formatoComprobante(c)}</span>
              <span className="block text-xs text-slate-500">
                {nombreCompania(c.aseguradoraId)}
                {c.siniestro ? ` · Siniestro ${c.siniestro}` : ''} · {formatoFecha(c.fecha)} · {formatoPesos(c.total)}
              </span>
            </span>
            <BadgeEtapa etapa={calcularSemaforo(c, hoy).etapa} />
          </button>
        )}

        {varias.length > 1 && (
          <div className="mt-5 rounded-xl border border-slate-200">
            <div className="border-b border-slate-100 px-3 py-2 text-xs font-semibold text-slate-500">{varias.length} facturas</div>
            <ul className="max-h-72 divide-y divide-slate-100 overflow-y-auto">
              {varias.map((f) => (
                <li key={f.id}>
                  <button type="button" onClick={() => abrirLegajo(f.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left text-sm hover:bg-fondo">
                    <span>
                      <span className="font-medium">{formatoComprobante(f)}</span>
                      <span className="ml-2 text-xs text-slate-500">
                        {f.sucursal} · {formatoPesos(f.total)}
                      </span>
                    </span>
                    {n.clase === 'subidas' ? (
                      <span className="shrink-0 text-xs text-slate-500">{nombreCompania(f.aseguradoraId)}</span>
                    ) : (
                      <span className="shrink-0 text-xs font-semibold text-sem-rojo">{diffDias(f.fecha, hoy)} {diffDias(f.fecha, hoy) === 1 ? 'día' : 'días'}</span>
                    )}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        {(n.ruta || varias.length <= 1) && <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => irALaFactura(n)}
            className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro"
          >
            <ExternalLink className="h-4 w-4" /> {n.ruta ? 'Ver las facturas' : rol === 'sucursal' ? 'Abrir la factura y resolver' : 'Abrir la factura'}
          </button>
        </div>}
      </article>
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Notificaciones"
        subtitulo={
          rol === 'sucursal'
            ? 'Respuestas y pedidos de Auditoría. Cada mensaje se abre con su factura.'
            : rol === 'gerencia'
              ? 'Escalamientos: documentación crítica y reclamos sin respuesta'
              : 'Lo que hicieron las sucursales: subidas, respuestas, fechas estimadas y notas de crédito'
        }
      />

      {/* Como un mail: la bandeja a lo ancho; al abrir un mensaje, se lee a lo ancho y se vuelve a la bandeja */}
      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm">
        {/* Bandeja */}
        <div className={`flex-col ${actual ? 'hidden' : 'flex'}`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
            {(
              [
                ['todas', `Todas (${misNotificaciones.length})`],
                ...(rol === 'sucursal'
                  ? ([
                      ['rechazos', `Rechazos (${rechazos})`],
                      ['documentacion', `Documentación faltante (${documentacion})`],
                    ] as const)
                  : ([['sin_leer', `Sin leer (${sinLeer})`]] as const)),
                ['destacadas', `★ Destacadas (${marcas.cantidadDestacadas})`],
              ] as const
            ).map(([clave, t]) => (
              <button
                key={clave}
                type="button"
                onClick={() => setVer(clave)}
                className={`rounded-full px-3 py-1 text-xs font-semibold ${ver === clave ? 'bg-marca text-white' : 'bg-fondo text-slate-600 hover:bg-slate-200'}`}
              >
                {t}
              </button>
            ))}
            {sinLeer > 0 && (
              <button type="button" onClick={marcarTodasLeidas} className="ml-auto text-xs font-semibold text-marca hover:underline">
                Marcar todas como leídas
              </button>
            )}
          </div>
          <div className="relative border-b border-slate-200 px-3 py-2">
            <Search className="pointer-events-none absolute left-5 top-1/2 h-3.5 w-3.5 -translate-y-1/2 text-slate-400" />
            <input
              type="search"
              value={buscar}
              onChange={(e) => setBuscar(e.target.value)}
              placeholder="Buscar por número de factura o siniestro"
              className="w-full rounded-lg border border-slate-200 bg-white py-1.5 pl-8 pr-2 text-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
            />
          </div>
          <ul className="divide-y divide-slate-100">
            {lista.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-slate-500">
                <Inbox className="h-8 w-8 text-slate-300" />
                {buscar.trim() ? 'Sin mensajes con esa búsqueda.' : ver === 'sin_leer' ? 'Sin mensajes por leer.' : 'Sin notificaciones.'}
              </li>
            )}
            {lista.map((n) => (
              <li key={n.id} className="flex items-stretch">
                <button
                  type="button"
                  onClick={() => marcas.alternarDestacada(n.id)}
                  aria-label={marcas.esDestacada(n.id) ? 'Quitar de destacadas' : 'Destacar'}
                  className="shrink-0 pl-3 pr-1 text-slate-300 hover:text-amber-500"
                >
                  <Star className={`h-4 w-4 ${marcas.esDestacada(n.id) ? 'fill-amber-400 text-amber-500' : ''}`} />
                </button>
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className={`flex min-w-0 flex-1 gap-3 border-l-4 px-3 py-3 text-left ${n.tema === 'rechazo' ? 'border-sem-rojo' : 'border-transparent'} ${n.id === elegida ? 'bg-marca/10' : 'hover:bg-fondo'} ${n.leida ? 'text-slate-500' : 'text-noche'}`}
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.leida ? 'bg-transparent' : 'bg-marca'}`} />
                  {/* En la compu, una sola línea como en un mail; en el celular, en tres renglones */}
                  <span className="min-w-0 flex-1 md:flex md:items-center md:gap-4">
                    <span className="flex items-baseline justify-between gap-2 md:w-56 md:shrink-0">
                      <span className={`truncate text-sm ${n.leida ? '' : 'font-bold'}`}>{remitente(n)}</span>
                      <span className={`shrink-0 text-[11px] md:hidden ${n.leida ? '' : 'font-semibold text-marca'}`}>{cuando(n.fecha, hoy)}</span>
                    </span>
                    <span className="flex min-w-0 flex-1 items-center gap-1.5 text-sm">
                      {n.tema && n.tema !== 'mensaje' && <EtiquetaTema tema={n.tema} />}
                      {marcas.nota(n.id) && <StickyNote className="h-3.5 w-3.5 shrink-0 text-amber-600" aria-label="Tiene una nota" />}
                      <span className={`truncate ${n.leida ? '' : 'font-semibold'}`}>{partesDe(n.texto).asunto}</span>
                      <span className="hidden min-w-0 truncate text-slate-500 md:inline">
                        {' — '}
                        {partesDe(n.texto).factura ? `${partesDe(n.texto).factura} · ` : ''}
                        {partesDe(n.texto).cuerpo}
                      </span>
                    </span>
                    <span className="block truncate text-xs text-slate-500 md:hidden">
                      {partesDe(n.texto).factura ? `${partesDe(n.texto).factura} · ` : ''}
                      {partesDe(n.texto).cuerpo}
                    </span>
                    <span className={`hidden shrink-0 text-xs md:inline ${n.leida ? 'text-slate-500' : 'font-semibold text-marca'}`}>{cuando(n.fecha, hoy)}</span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          {fuente.tipo === 'google' && <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            {fuente.tipo === 'google'
              ? 'Se actualiza sola cada minuto. Lo leído queda marcado en la cuenta, en cualquier computadora o celular.'
              : ''}
          </p>}
        </div>

        {/* Mensaje abierto, a lo ancho */}
        {actual && <div className="mx-auto max-w-4xl p-6">{detalle(actual)}</div>}
      </div>
    </>
  )
}

/**
 * Aviso en una esquina cuando llega una notificación nueva (como un mensaje de WhatsApp Web).
 * No aparece con las que ya estaban al abrir la plataforma; se cierra solo a los 8 segundos.
 */
export function AvisoNotificacion() {
  const { misNotificaciones, rol, marcarLeida } = useApp()
  const navigate = useNavigate()
  const vistas = useRef<Set<string> | null>(null)
  const [aviso, setAviso] = useState<Notificacion | null>(null)
  useEffect(() => {
    const ids = new Set(misNotificaciones.map((n) => n.id))
    if (vistas.current === null) {
      vistas.current = ids
      return
    }
    const nuevas = misNotificaciones.filter((n) => !n.leida && !vistas.current!.has(n.id))
    vistas.current = ids
    if (nuevas.length) setAviso(nuevas.sort((a, b) => b.fecha.localeCompare(a.fecha))[0])
  }, [misNotificaciones])
  // Al cambiar de usuario se empieza de nuevo
  useEffect(() => {
    vistas.current = null
  }, [rol])
  useEffect(() => {
    if (!aviso) return
    const t = window.setTimeout(() => setAviso(null), 8000)
    return () => window.clearTimeout(t)
  }, [aviso])
  if (!aviso) return null
  const { asunto, factura } = partesDe(aviso.texto)
  return (
    <div className="fixed bottom-5 right-5 z-[80] w-80 max-w-[calc(100vw-2.5rem)] animate-[aparecer_0.25s_ease-out] rounded-xl border border-slate-200 bg-white shadow-xl" role="status">
      <div className="flex items-start gap-3 p-3">
        <span className="mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-marca text-white">
          <Bell className="h-4 w-4" />
        </span>
        <button
          type="button"
          onClick={() => {
            marcarLeida(aviso.id)
            setAviso(null)
            navigate('/app/notificaciones')
          }}
          className="min-w-0 flex-1 text-left"
        >
          <span className="block text-xs font-semibold text-marca">Notificación nueva</span>
          <span className="block truncate text-sm font-bold text-noche">{asunto}</span>
          {factura && <span className="block truncate text-xs text-slate-500">{factura}</span>}
        </button>
        <button type="button" onClick={() => setAviso(null)} aria-label="Cerrar" className="rounded p-1 text-slate-400 hover:bg-fondo">
          <X className="h-4 w-4" />
        </button>
      </div>
    </div>
  )
}
