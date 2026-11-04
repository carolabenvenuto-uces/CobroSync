import { useState } from 'react'
import { Copy, Mail, X } from 'lucide-react'

/**
 * El texto de un mail listo para copiar (presentación o reclamo a una compañía). Si hay un solo
 * destinatario, también se puede abrir directo en el programa de correo.
 */
export function TextoMail({ titulo, asunto, texto, para, onCerrar }: { titulo: string; asunto: string; texto: string; para?: string; onCerrar: () => void }) {
  const [copiado, setCopiado] = useState(false)
  async function copiar() {
    try {
      await navigator.clipboard.writeText(texto)
      setCopiado(true)
    } catch {
      setCopiado(false)
    }
  }
  // Los programas de correo no aceptan textos muy largos en el link: en ese caso, copiar y pegar
  const mailto = para && texto.length < 1800 ? `mailto:${para}?subject=${encodeURIComponent(asunto)}&body=${encodeURIComponent(texto)}` : null
  return (
    <>
      <div className="fixed inset-0 z-50 bg-noche/40" onClick={onCerrar} aria-hidden="true" />
      <div className="fixed inset-x-0 top-10 z-50 mx-auto w-[min(44rem,95vw)] rounded-xl bg-white p-5 shadow-2xl" role="dialog" aria-label={titulo}>
        <div className="mb-3 flex items-start justify-between gap-3">
          <div>
            <h2 className="text-lg font-extrabold">{titulo}</h2>
            <p className="text-xs text-slate-500">
              Asunto: <strong>{asunto}</strong>
              {para && ` · Para: ${para}`}
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-fondo">
            <X className="h-5 w-5" />
          </button>
        </div>
        <textarea readOnly value={texto} rows={14} className="w-full rounded-lg border border-slate-200 p-3 font-mono text-xs" />
        <div className="mt-3 flex flex-wrap gap-2">
          <button type="button" onClick={() => void copiar()} className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro">
            <Copy className="h-4 w-4" /> {copiado ? 'Copiado' : 'Copiar el texto'}
          </button>
          {mailto && (
            <a href={mailto} className="inline-flex items-center gap-2 rounded-lg border border-slate-200 px-4 py-2 text-sm font-semibold hover:bg-fondo">
              <Mail className="h-4 w-4 text-marca" /> Abrir en el correo
            </a>
          )}
        </div>
      </div>
    </>
  )
}

/** Lista de facturas para el cuerpo del mail, agrupada por compañía. */
export function listaParaMail(
  filas: { numero: string; siniestro: string; total: number; extra?: string }[],
  pesos: (n: number) => string,
): string {
  const lineas = filas.map((f) => `- ${f.numero}${f.siniestro ? ` · siniestro ${f.siniestro}` : ''} · ${pesos(f.total)}${f.extra ? ` · ${f.extra}` : ''}`)
  const total = filas.reduce((t, f) => t + f.total, 0)
  return `${lineas.join('\n')}\n\nTotal: ${pesos(total)} (${filas.length} ${filas.length === 1 ? 'factura' : 'facturas'})`
}
