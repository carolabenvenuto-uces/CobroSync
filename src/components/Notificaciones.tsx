import { Bell, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { formatoFecha } from '../lib/formato'

/**
 * Campana de notificaciones: a la sucursal le avisa lo que hizo Auditoría (observaciones,
 * mensajes, rechazos); a Auditoría, lo que hicieron las sucursales (subidas, respuestas,
 * demoras, notas de crédito); a Gerencia, solo los escalamientos (documentación crítica y
 * reclamos sin respuesta). Al tocar una, se abre la factura.
 */
export function Campana() {
  const { rol, misNotificaciones, marcarLeida, marcarTodasLeidas, abrirLegajo } = useApp()
  const [abierta, setAbierta] = useState(false)
  const sinLeer = misNotificaciones.filter((n) => !n.leida).length

  return (
    <>
      <button
        type="button"
        onClick={() => setAbierta(true)}
        className="flex w-full items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium text-slate-300 hover:bg-white/5 hover:text-white"
      >
        <Bell className="h-4 w-4" />
        <span className="flex-1 text-left">Notificaciones</span>
        {sinLeer > 0 && <span className="rounded-full bg-marca px-2 py-0.5 text-[11px] font-bold text-white">{sinLeer}</span>}
      </button>

      {abierta && (
        <>
          <div className="fixed inset-0 z-40 bg-noche/40" onClick={() => setAbierta(false)} aria-hidden="true" />
          <div className="fixed left-0 top-0 z-50 flex h-full w-full max-w-sm flex-col bg-white text-noche shadow-2xl lg:left-64">
            <div className="flex items-center justify-between border-b border-slate-200 px-5 py-4">
              <div>
                <h2 className="font-extrabold">Notificaciones</h2>
                <p className="text-xs text-slate-500">
                  {rol === 'sucursal' ? 'Lo que respondió o pidió Auditoría' : rol === 'gerencia' ? 'Escalamientos: documentación crítica y reclamos sin respuesta' : 'Lo que hicieron las sucursales'}
                </p>
              </div>
              <button type="button" onClick={() => setAbierta(false)} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Cerrar">
                <X className="h-5 w-5" />
              </button>
            </div>
            {sinLeer > 0 && (
              <button type="button" onClick={marcarTodasLeidas} className="border-b border-slate-100 px-5 py-2 text-left text-xs font-semibold text-marca hover:underline">
                Marcar todas como leídas
              </button>
            )}
            <ul className="flex-1 divide-y divide-slate-100 overflow-y-auto">
              {misNotificaciones.length === 0 && <li className="px-5 py-10 text-center text-sm text-slate-500">No hay notificaciones.</li>}
              {misNotificaciones.map((n) => (
                <li key={n.id}>
                  <button
                    type="button"
                    onClick={() => {
                      marcarLeida(n.id)
                      abrirLegajo(n.comprobanteId)
                      setAbierta(false)
                    }}
                    className={`flex w-full gap-3 px-5 py-3 text-left text-sm hover:bg-fondo ${n.leida ? 'text-slate-500' : 'text-noche'}`}
                  >
                    <span className={`mt-1.5 h-2 w-2 shrink-0 rounded-full ${n.leida ? 'bg-transparent' : 'bg-marca'}`} />
                    <span>
                      <span className={n.leida ? '' : 'font-semibold'}>{n.texto}</span>
                      <span className="mt-0.5 block text-xs text-slate-400">{formatoFecha(n.fecha)}</span>
                    </span>
                  </button>
                </li>
              ))}
            </ul>
            <p className="border-t border-slate-100 px-5 py-3 text-[11px] text-slate-400">
              En la demo las notificaciones viven en este navegador. En el piloto también llegarían por mail.
            </p>
          </div>
        </>
      )}
    </>
  )
}
