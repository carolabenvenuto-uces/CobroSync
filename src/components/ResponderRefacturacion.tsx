import { useState } from 'react'
import { useApp } from '../context/AppContext'
import { MOTIVOS_NO_REFACTURA, textoRefacturacion } from '../domain/refacturacion'
import type { Comprobante, Refacturacion } from '../domain/tipos'
import { formatoPesos } from '../lib/formato'

/**
 * Después de una nota de crédito: la sucursal (o Cobranzas) dice si lo anulado se vuelve a facturar.
 * Sí: por cuánto, si se sabe (queda pendiente hasta que llega la factura nueva). No: por qué (deja de estar pendiente).
 */
export function ResponderRefacturacion({ factura }: { factura: Comprobante }) {
  const { hoy, actualizarComprobante, registrarEvento } = useApp()
  const [eleccion, setEleccion] = useState<'si' | 'no' | null>(null)
  const [importeTexto, setImporteTexto] = useState('')
  const [motivo, setMotivo] = useState('')
  const importe = Number(importeTexto.replace(/\./g, '').replace(',', '.')) || 0
  const guardar = () => {
    if (!eleccion || (eleccion === 'no' && !motivo)) return
    const refacturacion: Refacturacion = { decision: eleccion, importe: eleccion === 'si' && importe > 0 ? importe : null, motivo: eleccion === 'no' ? motivo : undefined, fecha: hoy, autor: '' }
    actualizarComprobante(factura.id, { refacturacion })
    registrarEvento(factura.id, 'mensaje', `${textoRefacturacion(refacturacion, formatoPesos)}.`)
  }
  const boton = (activo: boolean) =>
    `rounded-md border px-2.5 py-1 text-xs font-semibold ${activo ? 'border-amber-600 bg-white text-amber-950' : 'border-amber-300 bg-amber-100/60 text-amber-900 hover:bg-white'}`
  return (
    <div className="ml-5 mt-1.5 space-y-1.5">
      <div className="flex flex-wrap gap-1.5">
        <button type="button" onClick={() => setEleccion('si')} className={boton(eleccion === 'si')}>
          Se refactura
        </button>
        <button type="button" onClick={() => setEleccion('no')} className={boton(eleccion === 'no')}>
          No se refactura
        </button>
      </div>
      {eleccion && (
        <div className="flex flex-wrap items-center gap-1.5">
          {eleccion === 'si' ? (
            <input
              inputMode="decimal"
              value={importeTexto}
              onChange={(e) => setImporteTexto(e.target.value)}
              placeholder="Por cuánto (si se sabe)"
              className="w-44 rounded-md border border-amber-300 bg-white px-2 py-1 text-xs"
            />
          ) : (
            <select value={motivo} onChange={(e) => setMotivo(e.target.value)} className="rounded-md border border-amber-300 bg-white px-2 py-1 text-xs" aria-label="Por qué no se refactura">
              <option value="" disabled>
                Por qué no
              </option>
              {MOTIVOS_NO_REFACTURA.map((m) => (
                <option key={m}>{m}</option>
              ))}
            </select>
          )}
          <button
            type="button"
            onClick={guardar}
            disabled={eleccion === 'no' && !motivo}
            className="rounded-md bg-amber-600 px-2.5 py-1 text-xs font-semibold text-white hover:bg-amber-700 disabled:opacity-50"
          >
            Guardar
          </button>
        </div>
      )}
    </div>
  )
}
