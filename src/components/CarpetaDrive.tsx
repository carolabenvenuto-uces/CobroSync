import { useEffect, useMemo, useState } from 'react'
import { FolderInput } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import { facturasParaCargar, sugerirFactura, type TipoArchivo } from '../domain/archivos'
import { NOMBRE_DOCUMENTO } from '../domain/semaforo'
import { formatoComprobante } from '../lib/formato'
import { archivosSinAsignarEnGoogle, asignarArchivoEnGoogle, type ArchivoSuelto } from '../services/google'
import { claseSelect } from './ui/Estados'

/**
 * Con Google: lo que la sucursal dejó en su carpeta "Para subir" del Drive y CobroSync no pudo
 * reconocer por el nombre. Se asigna acá a la factura que corresponde.
 */
export function CarpetaDrive() {
  const { fuente, recibirDelServidor } = useApp()
  const comprobantes = useComprobantes()
  const facturas = useMemo(() => facturasParaCargar(comprobantes).sort((a, b) => b.fecha.localeCompare(a.fecha)), [comprobantes])
  const [sueltos, setSueltos] = useState<ArchivoSuelto[]>([])
  const [eleccion, setEleccion] = useState<Record<string, { facturaId: string; tipo: TipoArchivo }>>({})
  const [mensaje, setMensaje] = useState<string | null>(null)

  useEffect(() => {
    if (fuente.tipo !== 'google') return
    archivosSinAsignarEnGoogle()
      .then((lista) => {
        setSueltos(lista)
        setEleccion(Object.fromEntries(lista.map((a) => [a.id, { facturaId: sugerirFactura(a.nombre, facturas).factura?.id ?? '', tipo: a.tipo }])))
      })
      .catch(() => setSueltos([]))
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [fuente.tipo])

  if (fuente.tipo !== 'google' || sueltos.length === 0) return null

  async function asignar(a: ArchivoSuelto) {
    const e = eleccion[a.id]
    if (!e?.facturaId) return
    try {
      const c = await asignarArchivoEnGoogle(a.id, e.facturaId, e.tipo)
      recibirDelServidor([c])
      setSueltos((l) => l.filter((x) => x.id !== a.id))
      setMensaje(`"${a.nombre}" quedó en el legajo de ${formatoComprobante(c)}.`)
    } catch (err) {
      setMensaje(err instanceof Error ? err.message : String(err))
    }
  }

  return (
    <div className="mb-4 rounded-xl border-2 border-sem-amarillo/60 bg-amber-50 p-4">
      <div className="mb-2 flex items-center gap-2 font-bold text-amber-900">
        <FolderInput className="h-5 w-5" /> En tu carpeta del Drive hay {sueltos.length} {sueltos.length === 1 ? 'archivo' : 'archivos'} sin factura
      </div>
      <p className="mb-3 text-xs text-amber-900">
        CobroSync no pudo reconocer a qué factura van por el nombre. Elegí la factura y qué documento es. Para la próxima: si el nombre
        tiene el número de factura (por ejemplo <code>35-00011032 orden.pdf</code>), el siniestro o la patente, se asigna solo.
      </p>
      <ul className="space-y-2">
        {sueltos.map((a) => (
          <li key={a.id} className="flex flex-wrap items-center gap-2 text-sm">
            <a href={a.url} target="_blank" rel="noreferrer" className="min-w-40 font-semibold text-marca underline">
              {a.nombre}
            </a>
            <select
              value={eleccion[a.id]?.facturaId ?? ''}
              onChange={(e) => setEleccion({ ...eleccion, [a.id]: { ...eleccion[a.id], facturaId: e.target.value } })}
              className={`${claseSelect} max-w-xs`}
            >
              <option value="">— Elegir factura —</option>
              {facturas.map((c) => (
                <option key={c.id} value={c.id}>
                  {formatoComprobante(c)}
                  {c.siniestro ? ` · ${c.siniestro}` : ''}
                </option>
              ))}
            </select>
            <select
              value={eleccion[a.id]?.tipo ?? 'documentacion'}
              onChange={(e) => setEleccion({ ...eleccion, [a.id]: { ...eleccion[a.id], tipo: e.target.value as TipoArchivo } })}
              className={claseSelect}
            >
              <option value="documentacion">Todo junto</option>
              <option value="factura">{NOMBRE_DOCUMENTO.factura}</option>
              <option value="orden">{NOMBRE_DOCUMENTO.orden}</option>
              <option value="firma">{NOMBRE_DOCUMENTO.firma}</option>
            </select>
            <button
              type="button"
              disabled={!eleccion[a.id]?.facturaId}
              onClick={() => void asignar(a)}
              className="rounded-lg bg-marca px-3 py-1.5 text-xs font-semibold text-white disabled:opacity-50"
            >
              Asignar
            </button>
          </li>
        ))}
      </ul>
      {mensaje && <p className="mt-2 text-xs text-amber-900">{mensaje}</p>}
    </div>
  )
}
