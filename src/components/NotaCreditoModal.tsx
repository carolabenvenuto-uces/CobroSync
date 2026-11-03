import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import type { Comprobante } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { formatoComprobante, formatoPesos } from '../lib/formato'
import { claseSelect } from './ui/Estados'

const MOTIVOS_NC = [
  'Factura emitida a la compañía equivocada',
  'Error en el importe: se refactura',
  'Factura vencida: se refactura con fecha actual',
  'Pedido de la compañía tras un rechazo',
  'Otro motivo',
]

/**
 * La sucursal informa una nota de crédito vinculada a la factura que anula.
 * Hoy esto se entera auditoría tarde (o nunca); acá queda registrado y avisado.
 */
export function NotaCreditoModal({ onCerrar }: { onCerrar: () => void }) {
  const { datos, hoy, usuario, agregarComprobante, actualizarComprobante, registrarEvento } = useApp()
  const comprobantes = useComprobantes()
  const facturas = useMemo(
    () =>
      comprobantes
        .filter((c) => c.tipo === 'FC' && c.estado !== 'anulada' && c.estado !== 'cobrada' && diffDias(c.fecha, hoy) <= 120)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [comprobantes, hoy],
  )
  const [facturaId, setFacturaId] = useState(facturas[0]?.id ?? '')
  const [motivo, setMotivo] = useState(MOTIVOS_NC[0])
  const [comentario, setComentario] = useState('')
  const [listo, setListo] = useState(false)
  const nombreCompania = (id: string) => datos!.aseguradoras.find((a) => a.id === id)?.nombre ?? id

  function informar() {
    const factura = facturas.find((f) => f.id === facturaId)
    if (!factura) return
    const texto = `${motivo}${comentario ? `: ${comentario}` : ''}`
    const nc: Comprobante = {
      ...factura,
      id: `nc-demo-${Date.now()}`,
      tipo: 'NC',
      fecha: hoy,
      numero: factura.numero + 1000,
      total: -factura.total,
      fechaDrive: null,
      subidoPor: null,
      fechaPresentacion: null,
      vencimiento: null,
      fechaCobro: null,
      estado: 'nota_credito',
      ncReferencia: factura.id,
      ncInformada: true,
      compromiso: null,
      reclamos: [],
      observaciones: texto,
      documentos: [],
      eventos: [{ fecha: hoy, autor: usuario, area: 'sucursal', tipo: 'nota_credito', texto: `Informó la NC: ${texto}` }],
    }
    agregarComprobante(nc)
    actualizarComprobante(factura.id, { estado: 'anulada', compromiso: null, observaciones: texto })
    registrarEvento(factura.id, 'nota_credito', `Anulada con nota de crédito. ${texto}`)
    setListo(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-noche/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <h2 className="text-lg font-extrabold">Informar nota de crédito</h2>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {listo ? (
          <div className="mt-4 space-y-4 text-sm">
            <p>Listo: auditoría ya ve la nota de crédito y la factura quedó anulada. Queda registrado en la conversación del legajo.</p>
            <button type="button" onClick={onCerrar} className="w-full rounded-lg bg-marca px-4 py-2.5 font-semibold text-white">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <label className="block text-xs font-semibold text-slate-500">
              Factura que anula
              <select className={`${claseSelect} mt-1 w-full`} value={facturaId} onChange={(e) => setFacturaId(e.target.value)}>
                {facturas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {formatoComprobante(f)} · {nombreCompania(f.aseguradoraId)} · {formatoPesos(f.total)}
                  </option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Motivo
              <select className={`${claseSelect} mt-1 w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                {MOTIVOS_NC.map((m) => (
                  <option key={m}>{m}</option>
                ))}
              </select>
            </label>
            <label className="block text-xs font-semibold text-slate-500">
              Comentario (opcional)
              <textarea
                rows={2}
                value={comentario}
                onChange={(e) => setComentario(e.target.value)}
                className={`${claseSelect} mt-1 w-full`}
                placeholder="Ej.: se refactura con la FC 0035-00006901"
              />
            </label>
            <button
              type="button"
              onClick={informar}
              disabled={!facturaId}
              className="w-full rounded-lg bg-marca px-4 py-2.5 font-semibold text-white hover:bg-marca-oscuro disabled:bg-slate-200"
            >
              Informar a auditoría
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
