import { useMemo, useState } from 'react'
import { X } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import { diffDias } from '../lib/fechas'
import { formatoComprobante, formatoPesos } from '../lib/formato'
import { claseSelect } from './ui/Estados'
import { MOTIVOS_NO_REFACTURA, textoRefacturacion } from '../domain/refacturacion'
import type { Comprobante, Documento, Refacturacion } from '../domain/tipos'
import { numerosDelNombre } from '../domain/espera'

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
export function NotaCreditoModal({ onCerrar, nc }: { onCerrar: () => void; /** NC que entró de Quiter sin aviso: se informa por ella */ nc?: Comprobante }) {
  const { datos, hoy, usuario, actualizarComprobante, registrarEvento, subirDocumento, subirEnEspera } = useApp()
  const comprobantes = useComprobantes()
  const facturas = useMemo(
    () =>
      comprobantes
        .filter((c) => c.tipo === 'FC' && c.estado !== 'anulada' && c.estado !== 'cobrada' && !c.anulacionInformada && diffDias(c.fecha, hoy) <= 120)
        // por una NC que ya entró: las facturas de su compañía
        .filter((c) => !nc || c.aseguradoraId === nc.aseguradoraId)
        .sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [comprobantes, hoy, nc],
  )
  const [facturaId, setFacturaId] = useState('')
  const [motivo, setMotivo] = useState('')
  const [comentario, setComentario] = useState('')
  const [parcial, setParcial] = useState(false)
  const [importeTexto, setImporteTexto] = useState(() => (nc ? Math.abs(nc.total).toLocaleString('es-AR', { minimumFractionDigits: 2 }) : ''))
  // ¿Lo anulado se vuelve a facturar? Sí (por cuánto, si se sabe) o no (por qué)
  const [refactura, setRefactura] = useState<'si' | 'no' | ''>('')
  const [importeNuevoTexto, setImporteNuevoTexto] = useState('')
  const [motivoNo, setMotivoNo] = useState('')
  const [listo, setListo] = useState(false)
  // El PDF de la NC (opcional): va a la NC si ya entró de Quiter, o queda en espera hasta que entre
  const [archivoNc, setArchivoNc] = useState<File | null>(null)
  const [numeroNcTexto, setNumeroNcTexto] = useState('')
  const [enviando, setEnviando] = useState(false)
  const [error, setError] = useState('')
  const numeroNc = nc ? { puntoVenta: nc.puntoVenta, numero: nc.numero } : numerosDelNombre(numeroNcTexto)[0]
  const archivoValido = !archivoNc || !!numeroNc
  const nombreCompania = (id: string) => datos!.aseguradoras.find((a) => a.id === id)?.nombre ?? id

  /**
   * La sucursal avisa que la factura se anula y por qué. La nota de crédito real llega con la
   * exportación de Quiter y se vincula sola con este aviso (ver services/erp.ts).
   */
  const importeParcial = Number(importeTexto.replace(/\./g, '').replace(',', '.')) || 0
  const facturaElegida = facturas.find((f) => f.id === facturaId)
  const parcialValido = !parcial || (importeParcial > 0 && (!facturaElegida || importeParcial < facturaElegida.total))
  const importeNuevo = Number(importeNuevoTexto.replace(/\./g, '').replace(',', '.')) || 0
  const refacturaValida = refactura === 'si' || (refactura === 'no' && !!motivoNo)

  /** Sube el PDF de la NC: a la NC si está en CobroSync; si no, en espera hasta que entre con Quiter. */
  async function subirPdfNc(archivo: File) {
    if (!numeroNc) return
    const { puntoVenta, numero } = numeroNc
    // El número de la NC en el nombre (el servidor lo pide)
    const nombre = numerosDelNombre(archivo.name).some((n) => n.puntoVenta === puntoVenta && n.numero === numero) ? archivo.name : `${puntoVenta}-${numero} nc ${archivo.name}`
    const conNumero = nombre === archivo.name ? archivo : new File([archivo], nombre, { type: archivo.type || 'application/pdf' })
    const destino = nc ?? comprobantes.find((c) => c.tipo === 'NC' && c.puntoVenta === puntoVenta && c.numero === numero)
    if (!destino) {
      await subirEnEspera(puntoVenta, numero, 'nc', '', conNumero)
      return
    }
    const adj = await subirDocumento(destino.id, 'factura', conNumero)
    const pdf: Documento = { tipo: 'factura', estado: 'en_revision', archivo: adj.archivo, url: adj.url, subidoPor: usuario, fecha: hoy }
    actualizarComprobante(destino.id, { documentos: [...destino.documentos.filter((d) => d.tipo !== 'factura'), pdf] })
    registrarEvento(destino.id, 'subida', `Subió el PDF de la nota de crédito (${adj.archivo})`)
  }

  async function informar() {
    const factura = facturas.find((f) => f.id === facturaId)
    if (!factura) return
    if (archivoNc) {
      setEnviando(true)
      setError('')
      try {
        await subirPdfNc(archivoNc)
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e))
        setEnviando(false)
        return
      }
      setEnviando(false)
    }
    const texto = `${motivo}${comentario ? `: ${comentario}` : ''}`
    const refacturacion: Refacturacion = {
      decision: refactura === 'no' ? 'no' : 'si',
      importe: refactura === 'si' && importeNuevo > 0 ? importeNuevo : null,
      motivo: refactura === 'no' ? motivoNo : undefined,
      fecha: hoy,
      autor: '',
    }
    const respuesta = textoRefacturacion(refacturacion, formatoPesos)
    if (parcial) {
      actualizarComprobante(factura.id, { anulacionInformada: { fecha: hoy, motivo: texto, parcial: true, importe: importeParcial }, refacturacion })
      registrarEvento(factura.id, 'nota_credito', `Informó una nota de crédito parcial por ${formatoPesos(importeParcial)}. ${texto}. ${respuesta}.`)
    } else {
      actualizarComprobante(factura.id, { anulacionInformada: { fecha: hoy, motivo: texto }, compromiso: null, refacturacion })
      registrarEvento(factura.id, 'nota_credito', `Informó que se anula toda la factura con nota de crédito. ${texto}. ${respuesta}.`)
    }
    // La NC que entró sin aviso queda informada, con el motivo y la factura que anula
    if (nc) {
      actualizarComprobante(nc.id, { ncInformada: true })
      registrarEvento(nc.id, 'nota_credito', `Motivo de la nota de crédito: ${texto}. ${parcial ? 'Parcial de' : 'Anula'} la ${formatoComprobante(factura)}. ${respuesta}.`)
    }
    setListo(true)
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-noche/40 p-4" onClick={onCerrar}>
      <div className="w-full max-w-md rounded-2xl bg-white p-6 shadow-2xl" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-start justify-between">
          <div>
            <h2 className="text-lg font-extrabold">Informar nota de crédito</h2>
            {nc && <p className="text-sm text-slate-500">{formatoComprobante(nc)} · {formatoPesos(Math.abs(nc.total))}</p>}
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {listo ? (
          <div className="mt-4 space-y-4 text-sm">
            <p>Listo: Cobranzas ya lo ve. {nc ? 'Cobranzas la vincula con la factura.' : parcial ? 'La factura sigue vigente por el saldo.' : 'La factura deja de figurar como pendiente de documentación.'} {!nc && ' Cuando la nota de crédito llegue con Quiter, queda vinculada a esta factura.'}</p>
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
            <fieldset className="block text-xs font-semibold text-slate-500">
              ¿Se vuelve a facturar?
              <div className="mt-1 grid grid-cols-2 gap-2">
                {(
                  [
                    ['si', 'Sí, se refactura'],
                    ['no', 'No se refactura'],
                  ] as const
                ).map(([valor, texto]) => (
                  <button
                    key={valor}
                    type="button"
                    onClick={() => setRefactura(valor)}
                    className={`rounded-lg border px-3 py-2 text-sm font-semibold ${refactura === valor ? 'border-marca bg-marca/10 text-marca' : 'border-slate-200 text-slate-600'}`}
                  >
                    {texto}
                  </button>
                ))}
              </div>
            </fieldset>
            {refactura === 'si' && (
              <label className="block text-xs font-semibold text-slate-500">
                Por cuánto (si ya lo saben)
                <input inputMode="decimal" value={importeNuevoTexto} onChange={(e) => setImporteNuevoTexto(e.target.value)} placeholder="Ej.: 1.200.000,00" className={`${claseSelect} mt-1 w-full`} />
                <span className="mt-1 block font-normal text-slate-500">Queda pendiente la factura nueva hasta que llegue con Quiter.</span>
              </label>
            )}
            {refactura === 'no' && (
              <label className="block text-xs font-semibold text-slate-500">
                Por qué no
                <select className={`${claseSelect} mt-1 w-full`} value={motivoNo} onChange={(e) => setMotivoNo(e.target.value)}>
                  <option value="" disabled>Seleccionar</option>
                  {MOTIVOS_NO_REFACTURA.map((m) => (
                    <option key={m}>{m}</option>
                  ))}
                </select>
              </label>
            )}
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
            <div className="block text-xs font-semibold text-slate-500">
              PDF de la nota de crédito (opcional)
              <input
                type="file"
                accept="application/pdf,.pdf"
                onChange={(e) => setArchivoNc(e.target.files?.[0] ?? null)}
                className="mt-1 block w-full text-sm font-normal text-slate-600 file:mr-3 file:rounded-lg file:border-0 file:bg-marca/10 file:px-3 file:py-1.5 file:font-semibold file:text-marca"
              />
              {archivoNc && !nc && (
                <label className="mt-2 block">
                  Número de la nota de crédito
                  <input value={numeroNcTexto} onChange={(e) => setNumeroNcTexto(e.target.value)} placeholder="Ej.: 21-803" className={`${claseSelect} mt-1 w-full font-normal`} />
                </label>
              )}
            </div>
            {error && <p className="text-xs font-semibold text-red-800">{error}</p>}
            <button
              type="button"
              onClick={() => void informar()}
              disabled={enviando || !facturaId || !motivo || !parcialValido || !refacturaValida || !archivoValido}
              className="w-full rounded-lg bg-marca px-4 py-2.5 font-semibold text-white hover:bg-marca-oscuro disabled:bg-slate-200"
            >
              {enviando ? 'Subiendo el PDF…' : 'Informar a cobranzas'}
            </button>
          </div>
        )}
      </div>
    </div>
  )
}
