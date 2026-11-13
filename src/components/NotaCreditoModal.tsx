import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import { diffDias } from '../lib/fechas'
import { formatoComprobante, formatoPesos } from '../lib/formato'
import { claseSelect } from './ui/Estados'

const MOTIVOS_NC = [
  'Factura emitida a la compañía equivocada',
  'Error en el importe: se refactura',
  'Factura vencida: se refactura con fecha actual',
  'Pedido de la compañía tras un rechazo',
  'Repuesto o mano de obra que no corresponde (parcial)',
  'Otro motivo',
]

/**
 * La sucursal avisa que una factura se anula con una nota de crédito.
 * Hoy Cobranzas se entera tarde (o nunca); acá queda registrado y avisado.
 */
export function NotaCreditoModal({ onCerrar }: { onCerrar: () => void }) {
  const { datos, hoy, actualizarComprobante, registrarEvento } = useApp()
  const comprobantes = useComprobantes()
  const facturas = useMemo(
    () =>
      comprobantes
        .filter((c) => c.tipo === 'FC' && c.estado !== 'anulada' && c.estado !== 'cobrada' && !c.anulacionInformada && diffDias(c.fecha, hoy) <= 120)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [comprobantes, hoy],
  )
  const [facturaId, setFacturaId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [comentario, setComentario] = useState('')
  const [parcial, setParcial] = useState(false)
  const [importeTexto, setImporteTexto] = useState('')
  const [listo, setListo] = useState(false)
  const nombreCompania = (id: string) => datos!.aseguradoras.find((a) => a.id === id)?.nombre ?? id

  /**
   * La sucursal avisa que la factura se anula y por qué. La nota de crédito real llega con la
   * exportación del ERP y se vincula sola con este aviso (ver services/erp.ts).
   */
  const importeParcial = Number(importeTexto.replace(/\./g, '').replace(',', '.')) || 0
  const facturaElegida = facturas.find((f) => f.id === facturaId)
  const parcialValido = !parcial || (importeParcial > 0 && (!facturaElegida || importeParcial < facturaElegida.total))

  function informar() {
    const factura = facturas.find((f) => f.id === facturaId)
    if (!factura) return
    const texto = `${motivo}${comentario ? `: ${comentario}` : ''}`
    if (parcial) {
      actualizarComprobante(factura.id, { anulacionInformada: { fecha: hoy, motivo: texto, parcial: true, importe: importeParcial } })
      registrarEvento(factura.id, 'nota_credito', `Informó una nota de crédito parcial por ${formatoPesos(importeParcial)}. ${texto}`)
    } else {
      actualizarComprobante(factura.id, { anulacionInformada: { fecha: hoy, motivo: texto }, compromiso: null })
      registrarEvento(factura.id, 'nota_credito', `Informó que se anula toda la factura con nota de crédito. ${texto}`)
    }
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
            <p>Listo: Cobranzas ya lo ve. {parcial ? 'La factura sigue vigente por el saldo.' : 'La factura deja de figurar como pendiente de documentación.'} Cuando la nota de crédito llegue con el ERP, queda vinculada a esta factura.</p>
            <button type="button" onClick={onCerrar} className="w-full rounded-lg bg-marca px-4 py-2.5 font-semibold text-white">
              Cerrar
            </button>
          </div>
        ) : (
          <div className="mt-4 space-y-4 text-sm">
            <label className="block text-xs font-semibold text-slate-500">
              Factura que anula
              <select className={`${claseSelect} mt-1 w-full`} value={facturaId} onChange={(e) => setFacturaId(e.target.value)}>
                <option value="" disabled>Seleccionar la factura</option>
                {facturas.map((f) => (
                  <option key={f.id} value={f.id}>
                    {formatoComprobante(f)} · {nombreCompania(f.aseguradoraId)} · {formatoPesos(f.total)}
                  </option>
                ))}
              </select>
            </label>
            <fieldset className="block text-xs font-semibold text-slate-500">
              La nota de crédito
              <div className="mt-1 grid grid-cols-2 gap-2">
                {[
                  { valor: false, texto: 'Anula toda la factura' },
                  { valor: true, texto: 'Es parcial (por un importe)' },
                ].map((o) => (
                  <button
                    key={o.texto}
                    type="button"
                    onClick={() => setParcial(o.valor)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${parcial === o.valor ? 'border-marca bg-marca/10 text-marca' : 'border-slate-200 text-slate-600'}`}
                  >
                    {o.texto}
                  </button>
                ))}
              </div>
            </fieldset>
            {parcial && (
              <label className="block text-xs font-semibold text-slate-500">
                Importe de la nota de crédito
                <input
                  inputMode="decimal"
                  value={importeTexto}
                  onChange={(e) => setImporteTexto(e.target.value)}
                  placeholder="Ej.: 150.000,00"
                  className={`${claseSelect} mt-1 w-full`}
                />
                <span className="mt-1 block font-normal text-slate-500">La factura sigue vigente por el saldo y se le sigue pidiendo la documentación.</span>
              </label>
            )}
            <label className="block text-xs font-semibold text-slate-500">
              Motivo
              <select className={`${claseSelect} mt-1 w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                <option value="" disabled>Seleccionar el motivo</option>
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
                placeholder="Ej.: se refactura con la FC 35-6901"
              />
            </label>
            <button
              type="button"
              onClick={informar}
              disabled={!facturaId || !motivo || !parcialValido}
              className="w-full rounded-lg bg-marca px-4 py-2.5 font-semibold text-white hover:bg-marca-oscuro disabled:bg-slate-200"
            >
              Informar a cobranzas
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
