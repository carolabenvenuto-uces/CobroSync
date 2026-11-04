import { ArrowLeft, Bell, ExternalLink, Inbox, MailOpen } from 'lucide-react'
import { useMemo, useState } from 'react'
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
      {sinLeer > 0 && <span className="rounded-full bg-sem-rojo px-2 py-0.5 text-[11px] font-bold text-white">{sinLeer}</span>}
    </NavLink>
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
  const { rol, fuente, datos, hoy, misNotificaciones, marcarLeida, marcarTodasLeidas, abrirLegajo } = useApp()
  const navigate = useNavigate()
  const [ver, setVer] = useState<'sin_leer' | 'todas'>(() => (misNotificaciones.some((n) => !n.leida) ? 'sin_leer' : 'todas'))
  const [elegida, setElegida] = useState<string | null>(null)

  const porId = useMemo(() => new Map((datos?.comprobantes ?? []).map((c) => [c.id, c])), [datos])
  const nombreCompania = (id: string) => datos?.aseguradoras.find((a) => a.id === id)?.nombre ?? id
  const sinLeer = misNotificaciones.filter((n) => !n.leida).length
  const lista = useMemo(
    () => [...misNotificaciones].filter((n) => ver === 'todas' || !n.leida || n.id === elegida).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [misNotificaciones, ver, elegida],
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
        <button type="button" onClick={() => setElegida(null)} className="mb-3 flex items-center gap-1 text-sm font-semibold text-marca lg:hidden">
          <ArrowLeft className="h-4 w-4" /> Volver a la bandeja
        </button>
        <h2 className="text-lg font-extrabold leading-snug">{partesDe(n.texto).asunto}</h2>
        <div className="mt-1 flex flex-wrap gap-x-4 text-xs text-slate-500">
          <span>
            De: <strong className="text-slate-700">{remitente(n)}</strong>
          </span>
          {partesDe(n.texto).factura && <span>Factura: <strong className="text-slate-700">{partesDe(n.texto).factura}</strong></span>}
          <span>{formatoFecha(n.fecha)}</span>
        </div>
        <p className="mt-4 whitespace-pre-line text-sm leading-relaxed text-slate-800">{partesDe(n.texto).cuerpo}</p>

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
                    <span className="shrink-0 text-xs font-semibold text-sem-rojo">{diffDias(f.fecha, hoy)} días</span>
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}

        <div className="mt-5 flex flex-wrap gap-2">
          <button
            type="button"
            onClick={() => irALaFactura(n)}
            className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2.5 text-sm font-semibold text-white hover:bg-marca-oscuro"
          >
            <ExternalLink className="h-4 w-4" /> {n.ruta ? 'Ver las facturas' : rol === 'sucursal' ? 'Abrir la factura y resolver' : 'Abrir la factura'}
          </button>
        </div>
      </article>
    )
  }

  return (
    <>
      <EncabezadoPagina
        titulo="Notificaciones"
        subtitulo={
          rol === 'sucursal'
            ? 'Lo que te respondió o pidió Auditoría. Tocá un mensaje para leerlo y abrir la factura.'
            : rol === 'gerencia'
              ? 'Escalamientos: documentación crítica y reclamos sin respuesta'
              : 'Lo que hicieron las sucursales: subidas, respuestas, fechas estimadas y notas de crédito'
        }
      />

      <div className="overflow-hidden rounded-xl border border-slate-200 bg-white shadow-sm lg:grid lg:h-[calc(100vh-11rem)] lg:min-h-[28rem] lg:grid-cols-[minmax(18rem,24rem)_1fr]">
        {/* Bandeja */}
        <div className={`flex min-h-0 flex-col border-slate-200 lg:border-r ${actual ? 'hidden lg:flex' : 'flex'}`}>
          <div className="flex flex-wrap items-center gap-2 border-b border-slate-200 px-3 py-2">
            {(
              [
                ['sin_leer', `Sin leer (${sinLeer})`],
                ['todas', `Todas (${misNotificaciones.length})`],
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
          <ul className="min-h-0 flex-1 divide-y divide-slate-100 overflow-y-auto">
            {lista.length === 0 && (
              <li className="flex flex-col items-center gap-2 px-5 py-12 text-center text-sm text-slate-500">
                <Inbox className="h-8 w-8 text-slate-300" />
                {ver === 'sin_leer' ? 'No tenés mensajes sin leer.' : 'No hay notificaciones.'}
              </li>
            )}
            {lista.map((n) => (
              <li key={n.id}>
                <button
                  type="button"
                  onClick={() => abrir(n)}
                  className={`flex w-full gap-3 px-4 py-3 text-left ${n.id === elegida ? 'bg-marca/10' : 'hover:bg-fondo'} ${n.leida ? 'text-slate-500' : 'text-noche'}`}
                >
                  <span className={`mt-1.5 h-2.5 w-2.5 shrink-0 rounded-full ${n.leida ? 'bg-transparent' : 'bg-marca'}`} />
                  <span className="min-w-0 flex-1">
                    <span className="flex items-baseline justify-between gap-2">
                      <span className={`truncate text-sm ${n.leida ? '' : 'font-bold'}`}>{remitente(n)}</span>
                      <span className={`shrink-0 text-[11px] ${n.leida ? '' : 'font-semibold text-marca'}`}>{cuando(n.fecha, hoy)}</span>
                    </span>
                    <span className={`block truncate text-sm ${n.leida ? '' : 'font-semibold'}`}>{partesDe(n.texto).asunto}</span>
                    <span className="block truncate text-xs text-slate-500">
                      {partesDe(n.texto).factura ? `${partesDe(n.texto).factura} · ` : ''}
                      {partesDe(n.texto).cuerpo}
                    </span>
                  </span>
                </button>
              </li>
            ))}
          </ul>
          <p className="border-t border-slate-100 px-4 py-2 text-[11px] text-slate-400">
            {fuente.tipo === 'google'
              ? 'Se actualiza sola cada minuto. Lo que leés queda marcado en tu cuenta, en cualquier computadora o celular.'
              : 'En la demo las notificaciones viven en este navegador.'}
          </p>
        </div>

        {/* Mensaje abierto */}
        <div className={`min-h-0 overflow-y-auto p-5 ${actual ? 'block' : 'hidden lg:block'}`}>
          {actual ? (
            detalle(actual)
          ) : (
            <div className="flex h-full flex-col items-center justify-center gap-2 text-center text-sm text-slate-400">
              <MailOpen className="h-10 w-10 text-slate-300" />
              Elegí un mensaje de la lista para leerlo.
            </div>
          )}
        </div>
      </div>
    </>
  )
}
