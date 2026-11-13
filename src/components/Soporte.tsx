import { LifeBuoy, Send, X } from 'lucide-react'
import { useState } from 'react'
import { createPortal } from 'react-dom'
import { useLocation } from 'react-router-dom'
import { useApp } from '../context/AppContext'
import type { Rol } from '../domain/tipos'
import { PRODUCTO } from '../lib/marca'
import { reportarProblemaEnGoogle } from '../services/google'

/**
 * Soporte técnico: un mensaje que le llega por mail solo al correo de soporte de Ajustes.
 * Es para errores de la plataforma; las dudas sobre una factura van a Cobranzas.
 */
/** Pantallas de cada sector, como figuran en el menú, para elegir dónde pasó */
const PANTALLAS: Record<Rol, [string, string][]> = {
  sucursal: [
    ['/app', 'Mis facturas'],
    ['/app/siniestros', 'Mis siniestros'],
  ],
  auditoria: [
    ['/app', 'Avisos'],
    ['/app/control-diario', 'Control diario'],
    ['/app/siniestros', 'Siniestros'],
    ['/app/presentar', 'Presentar'],
    ['/app/companias', 'Compañías'],
    ['/app/pendientes', 'Pendientes de sucursales'],
    ['/app/reclamos', 'Vencidas y reclamos'],
    ['/app/resumen', 'Resumen'],
    ['/app/sucursales', 'Control por sucursal'],
    ['/app/saldos', 'Saldos por compañía'],
    ['/app/impacto', 'Impacto económico'],
    ['/app/planilla', 'Usar mi planilla'],
    ['/app/ajustes', 'Ajustes'],
  ],
  gerencia: [
    ['/app', 'Resumen'],
    ['/app/sucursales', 'Control por sucursal'],
    ['/app/saldos', 'Saldos por compañía'],
    ['/app/impacto', 'Impacto económico'],
    ['/app/control-diario', 'Detalle de facturas'],
  ],
}
const COMUNES: [string, string][] = [
  ['/app/notificaciones', 'Notificaciones'],
  ['/app/manual', 'Manual de uso'],
  ['ingreso', 'El ingreso a la plataforma'],
]

/** Problemas más comunes: ordenan el mensaje para que se entienda qué pasó */
const PROBLEMAS = [
  'La pantalla no carga o queda en blanco',
  'Un botón no hace nada',
  'No se puede subir un archivo',
  'Un archivo subido no aparece o no se abre',
  'Un cambio no se guarda',
  'Un número, importe o estado no coincide',
  'Aparece un mensaje de error',
  'Otro problema',
]

export function VentanaSoporte({ onCerrar }: { onCerrar: () => void }) {
  const { fuente, rol, datos } = useApp()
  const nombreSoporte = datos?.meta.soporte?.nombre?.trim() || datos?.meta.avisos?.nombreSoporte?.trim() || ''
  const { pathname } = useLocation()
  const pantallas = [...PANTALLAS[rol], ...COMUNES]
  const [pantalla, setPantalla] = useState(() => pantallas.find(([ruta]) => ruta === pathname)?.[0] ?? '')
  const [problema, setProblema] = useState('')
  const [factura, setFactura] = useState('')
  const [texto, setTexto] = useState('')
  const [estado, setEstado] = useState<{ tipo: 'nada' | 'enviando' | 'ok' | 'error'; mensaje?: string }>({ tipo: 'nada' })
  const enviar = async () => {
    if (!completo) return
    if (fuente.tipo !== 'google') {
      setEstado({ tipo: 'error', mensaje: 'El envío funciona en la versión conectada a la cuenta de la empresa.' })
      return
    }
    setEstado({ tipo: 'enviando' })
    try {
      const nombrePantalla = pantallas.find(([ruta]) => ruta === pantalla)?.[1] ?? pantalla
      const mensaje = [`Problema: ${problema}`, `Pantalla: ${nombrePantalla}`, ...(factura.trim() ? [`Factura o siniestro: ${factura.trim()}`] : []), '', texto.trim()].join('\n')
      await reportarProblemaEnGoogle(mensaje, { pantalla: `${nombrePantalla} (${window.location.hash})`, navegador: navigator.userAgent })
      setTexto('')
      setEstado({ tipo: 'ok' })
    } catch (e) {
      setEstado({ tipo: 'error', mensaje: e instanceof Error ? e.message : 'No se pudo enviar.' })
    }
  }
  // Todo obligatorio salvo la factura: así el aviso llega con lo necesario para revisarlo
  const completo = !!pantalla && !!problema && texto.trim().length >= 10
  const campo = 'mt-1 w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm font-normal text-noche focus:border-marca focus:outline-none focus:ring-2 focus:ring-marca/20'
  // Se dibuja directo en la página (no dentro del menú), para que ocupe el centro de la pantalla
  return createPortal(
    <div className="fixed inset-0 z-[70] flex items-center justify-center bg-noche/40 p-4" role="dialog" aria-modal="true" aria-labelledby="titulo-soporte" onClick={onCerrar}>
      <div className="max-h-[calc(100vh-2rem)] w-full max-w-2xl overflow-y-auto rounded-2xl bg-white p-6 text-sm text-slate-700 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start gap-3">
          <LifeBuoy className="mt-0.5 h-6 w-6 shrink-0 text-marca" />
          <div className="flex-1">
            <h2 id="titulo-soporte" className="text-base font-extrabold text-noche">
              Soporte técnico
            </h2>
            <p className="mt-0.5 text-xs text-slate-600">
              Para errores de {PRODUCTO}: una pantalla que no carga, un botón que no responde, un dato que no se guarda. Las dudas sobre una
              factura, a Cobranzas.
            </p>
            <p className="mt-1 text-xs text-slate-600">
              El aviso le llega a <strong className="text-noche">{nombreSoporte || 'quien da soporte a la plataforma'}</strong>.
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
            <div className="mt-4 grid gap-3 sm:grid-cols-2">
              <label className="text-xs font-semibold text-slate-600">
                ¿En qué pantalla?
                <select value={pantalla} onChange={(e) => setPantalla(e.target.value)} className={campo}>
                  <option value="" disabled>
                    Seleccionar pantalla
                  </option>
                  {pantallas.map(([ruta, nombre]) => (
                    <option key={ruta} value={ruta}>
                      {nombre}
                    </option>
                  ))}
                </select>
              </label>
              <label className="text-xs font-semibold text-slate-600">
                ¿Qué pasó?
                <select value={problema} onChange={(e) => setProblema(e.target.value)} className={campo}>
                  <option value="" disabled>
                    Seleccionar problema
                  </option>
                  {PROBLEMAS.map((p) => (
                    <option key={p}>{p}</option>
                  ))}
                </select>
              </label>
            </div>
            <label className="mt-3 block text-xs font-semibold text-slate-600">
              Número de factura o siniestro <span className="font-normal text-slate-400">(si el problema es con una en particular)</span>
              <input value={factura} onChange={(e) => setFactura(e.target.value)} placeholder="Por ejemplo: 35-11032" className={campo} />
            </label>
            <label className="mt-3 block text-xs font-semibold text-slate-600">
              Contar qué se estaba haciendo y qué pasó
              <textarea
                value={texto}
                onChange={(e) => setTexto(e.target.value)}
                rows={6}
                placeholder="Por ejemplo: al tocar Subir PDF en la factura 35-11032 aparece «No se pudo guardar» y el archivo no queda."
                className={campo}
              />
            </label>
            <div className="mt-3 flex flex-wrap items-center gap-3">
              <button
                type="button"
                onClick={enviar}
                disabled={!completo || estado.tipo === 'enviando'}
                className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
              >
                <Send className="h-4 w-4" /> {estado.tipo === 'enviando' ? 'Enviando…' : 'Enviar'}
              </button>
              {!completo && <span className="text-xs text-slate-500">Elegir la pantalla y el problema, y contar qué pasó.</span>}
              {estado.tipo === 'error' && <span className="text-xs font-semibold text-sem-rojo">{estado.mensaje}</span>}
            </div>
            <p className="mt-2 text-[11px] text-slate-500">Se envía junto con el usuario, el sector y la pantalla, para poder revisarlo.</p>
          </>
        )}
      </div>
    </div>,
    document.body,
  )
}
