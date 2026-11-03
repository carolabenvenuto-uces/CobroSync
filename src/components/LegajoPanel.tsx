import { CircleAlert, CircleCheck, Send, Upload, X } from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  calcularSemaforo,
  documentosDelLegajo,
  NOMBRE_DOCUMENTO,
  NOMBRE_ESTADO_DOCUMENTO,
  puedePresentarse,
} from '../domain/semaforo'
import type { Comprobante } from '../domain/tipos'
import { diffDias, sumarDias } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { BadgeEstado, BadgeSemaforo } from './ui/Badges'

/**
 * Panel lateral con el legajo de una factura.
 * Simula las acciones de cada rol; en la etapa 1 los cambios se guardan solo en memoria.
 */
export function LegajoPanel({ comprobante: c, onCerrar }: { comprobante: Comprobante; onCerrar: () => void }) {
  const { datos, rol, actualizarComprobante } = useApp()
  const corte = datos!.meta.fechaCorte
  const aseguradora = datos!.aseguradoras.find((a) => a.id === c.aseguradoraId)
  const semaforo = calcularSemaforo(c)
  const documentos = documentosDelLegajo(c.documentos)
  const gestionable = semaforo.color === 'rojo'

  function corregirDocumentos() {
    actualizarComprobante(c.id, {
      fechaDrive: c.fechaDrive ?? corte,
      estado: 'en_gestion',
      documentos: documentos.map((d) => ({ ...d, estado: 'ok' })),
      observaciones: 'Documentación corregida por el taller (simulación)',
    })
  }

  function presentar() {
    actualizarComprobante(c.id, {
      fechaPresentacion: corte,
      vencimiento: sumarDias(corte, aseguradora?.plazoPagoDias ?? 30),
      estado: 'presentada',
    })
  }

  const linea = [
    { etiqueta: 'Emisión', fecha: c.fecha, desde: null },
    { etiqueta: 'Subida al Drive', fecha: c.fechaDrive, desde: c.fecha },
    { etiqueta: 'Presentación', fecha: c.fechaPresentacion, desde: c.fechaDrive },
    { etiqueta: 'Vencimiento', fecha: c.vencimiento, desde: null },
    { etiqueta: 'Cobro', fecha: c.fechaCobro, desde: c.fecha },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-noche/40" onClick={onCerrar} aria-hidden="true" />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl"
        aria-label="Detalle del legajo"
      >
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legajo</div>
            <h2 className="mt-1 text-lg font-extrabold">{formatoComprobante(c)}</h2>
            <div className="mt-2 flex flex-wrap gap-2">
              <BadgeSemaforo color={semaforo.color} />
              <BadgeEstado estado={c.estado} />
            </div>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <div>
              <dt className="text-xs text-slate-500">Compañía</dt>
              <dd className="font-semibold">{aseguradora?.nombre}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Total</dt>
              <dd className="font-semibold">{formatoPesos(c.total)}</dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Siniestro / patente</dt>
              <dd className="font-semibold">
                {c.siniestro} · {c.patente}
              </dd>
            </div>
            <div>
              <dt className="text-xs text-slate-500">Sucursal · Ref.</dt>
              <dd className="font-semibold">
                {c.sucursal} · {c.ref}
              </dd>
            </div>
          </dl>

          <section>
            <h3 className="mb-2 font-bold">Estado del semáforo</h3>
            <ul className="space-y-1">
              {semaforo.detalle.map((d) => (
                <li key={d} className="flex items-start gap-2">
                  {gestionable ? (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sem-rojo" />
                  ) : (
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-esmeralda" />
                  )}
                  {d}
                </li>
              ))}
            </ul>
          </section>

          {c.tipo === 'FC' && (
            <section>
              <h3 className="mb-2 font-bold">Documentos del legajo</h3>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {documentos.map((d) => (
                  <li key={d.tipo} className="flex items-center justify-between px-3 py-2.5">
                    <span>{NOMBRE_DOCUMENTO[d.tipo]}</span>
                    <span
                      className={`text-xs font-semibold ${d.estado === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}
                    >
                      {NOMBRE_ESTADO_DOCUMENTO[d.estado]}
                    </span>
                  </li>
                ))}
              </ul>
            </section>
          )}

          <section>
            <h3 className="mb-2 font-bold">Recorrido</h3>
            <ol className="space-y-2">
              {linea.map((p) => (
                <li key={p.etiqueta} className="flex justify-between">
                  <span className={p.fecha ? '' : 'text-slate-400'}>{p.etiqueta}</span>
                  <span className="font-medium">
                    {formatoFecha(p.fecha)}
                    {p.fecha && p.desde && (
                      <span className="ml-1 text-xs text-slate-500">(+{diffDias(p.desde, p.fecha)} d)</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {c.observaciones && (
            <section>
              <h3 className="mb-1 font-bold">Observaciones</h3>
              <p className="text-slate-600">{c.observaciones}</p>
            </section>
          )}
        </div>

        {/* Acciones según el rol */}
        <div className="mt-auto space-y-2 border-t border-slate-200 p-5">
          {rol === 'taller' && gestionable && (
            <button
              type="button"
              onClick={corregirDocumentos}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-marca px-4 py-2.5 font-semibold text-white hover:bg-marca-oscuro"
            >
              <Upload className="h-4 w-4" /> Subir documentación corregida
            </button>
          )}
          {rol === 'administracion' && (
            <button
              type="button"
              onClick={presentar}
              disabled={!puedePresentarse(c)}
              className="flex w-full items-center justify-center gap-2 rounded-lg bg-esmeralda px-4 py-2.5 font-semibold text-white hover:bg-emerald-600 disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500"
            >
              <Send className="h-4 w-4" /> Aprobar y presentar
            </button>
          )}
          {rol === 'administracion' && gestionable && (
            <p className="text-center text-xs text-slate-500">
              No se puede presentar un legajo en rojo. Probá con el rol Taller para corregirlo.
            </p>
          )}
          {rol === 'gerencia' && <p className="text-center text-xs text-slate-500">Gerencia tiene acceso de consulta.</p>}
          <p className="text-center text-[11px] text-slate-400">Simulación: los cambios se pierden al recargar.</p>
        </div>
      </aside>
    </>
  )
}
