import { LifeBuoy, Send, X } from 'lucide-react'
import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { PRODUCTO } from '../lib/marca'
import { reportarProblemaEnGoogle } from '../services/google'

/**
 * Soporte técnico: un mensaje que le llega por mail solo al correo de soporte de Ajustes.
 * Es para errores de la plataforma; las dudas sobre una factura van a Auditoría.
 */
export function VentanaSoporte({ onCerrar }: { onCerrar: () => void }) {
  const { fuente } = useApp()
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<{ tipo: 'nada' | 'enviando' | 'ok' | 'error'; mensaje?: string }>({ tipo: 'nada' })
  const enviar = async () => {
    if (!texto.trim()) return
    if (fuente.tipo !== 'google') {
      setEstado({ tipo: 'error', mensaje: 'El envío funciona en la versión conectada a la cuenta de la empresa.' })
      return
    }
    setEstado({ tipo: 'enviando' })
    try {
      await reportarProblemaEnGoogle(texto, { pantalla: window.location.hash, navegador: navigator.userAgent })
      setTexto('')
      setEstado({ tipo: 'ok' })
    } catch (e) {
      setEstado({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo enviar.' })
    }
  }
  return (
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-noche/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-soporte" onClick={onCerrar}>
      <div className="w-full max-w-lg rounded-2xl bg-white p-5 text-sm text-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-0.5 h-6 w-6 shrink-0 text-marca" />
          <div className="flex-1">
            <h2 id="titulo-soporte" className="text-base font-extrabold text-noche">
              Soporte técnico
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Para errores de {PRODUCTO}: una pantalla que no carga, un botón que no responde, un dato que no se guarda. Las dudas sobre una
              factura, a Auditoría.
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 text-slate-400 hover:bg-fondo">
            <X className="h-5 w-5" />
          </button>
        </div>
        {estado.tipo === 'ok' ? (
          <div className="mt-4 rounded-lg bg-teal-50 px-4 py-3 font-semibold text-teal-800">Enviado. Gracias por avisar.</div>
        ) : (
          <>
            <textarea
              value={texto}
              onChange={(e) => setTexto(e.target.value)}
              rows={4}
              autoFocus
              placeholder="Qué pasó, en qué pantalla y, si corresponde, con qué factura"
              className="mt-4 w-full rounded-lg border border-slate-200 px-3 py-2 text-sm focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20"
            />
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enviar}
                disabled={!texto.trim() || estado.tipo === 'enviando'}
                className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {estado.tipo === 'enviando' ? 'Enviando…' : 'Enviar'}
              </button>
              {estado.tipo === 'error' && <span className="text-xs font-semibold text-sem-rojo">{estado.mensaje}</span>}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Se envía junto con el usuario, el sector y la pantalla, para poder revisarlo.</p>
          </>
        )}
      </div>
    </div>
  )
}
