import { useMemo, useState, type DragEvent } from 'react'
import { FileUp, Info, Upload, X } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import { facturasParaCargar, revisarNombre, siniestroDelNombre, type TipoArchivo } from '../domain/archivos'
import { DOCUMENTOS_REQUERIDOS, NOMBRE_DOCUMENTO } from '../domain/semaforo'
import type { Documento, TipoDocumento } from '../domain/tipos'
import { esPdf, prepararArchivo } from '../lib/imagenes'
import { formatoComprobante } from '../lib/formato'
import { claseSelect } from './ui/Estados'

const TODOS: TipoDocumento[] = DOCUMENTOS_REQUERIDOS
const NOMBRE_TIPO: Record<TipoArchivo, string> = {
  documentacion: 'Las dos juntas (factura y orden firmada)',
  factura: NOMBRE_DOCUMENTO.factura,
  orden: NOMBRE_DOCUMENTO.orden,
}

interface Fila {
  archivo: File
  /** vacío si el archivo no cumple la regla (no se sube) */
  facturaId: string
  tipo: TipoArchivo
  /** por qué no se puede subir: no es PDF, el nombre no tiene el número o el número no existe */
  error: string | null
  /** la factura todavía no tiene siniestro: se toma del nombre o se escribe en la fila */
  pideSiniestro: boolean
  siniestro: string
}

/**
 * Subir muchos escaneos de una vez. CobroSync sugiere a qué factura va cada archivo (por el número,
 * el siniestro o la patente que tenga el nombre) y qué documento es; la persona revisa y sube todo.
 * Cada factura sigue teniendo su legajo, como siempre.
 */
export function CargaMasiva({ onCerrar }: { onCerrar: () => void }) {
  const { hoy, usuario, subirDocumento, actualizarComprobante, registrarEvento } = useApp()
  const comprobantes = useComprobantes()
  const facturas = useMemo(
    () => facturasParaCargar(comprobantes).sort((a, b) => b.fecha.localeCompare(a.fecha)),
    [comprobantes],
  )
  const [filas, setFilas] = useState<Fila[]>([])
  const [arrastrando, setArrastrando] = useState(false)
  const [estado, setEstado] = useState<{ texto: string; error?: boolean } | null>(null)
  const [subiendo, setSubiendo] = useState(false)
  // La primera vez las condiciones se leen sí o sí: hasta tocar Entendido no se cierran ni se pueden
  // agregar archivos. Después quedan en el botón Condiciones, para abrirlas y cerrarlas.
  const [leidas, setLeidas] = useState(() => {
    try {
      return !!localStorage.getItem('cobrosync-condiciones-varios')
    } catch {
      return false
    }
  })
  const [condiciones, setCondiciones] = useState(!leidas)
  function cerrarCondiciones() {
    setCondiciones(false)
    setLeidas(true)
    try {
      localStorage.setItem('cobrosync-condiciones-varios', '1')
    } catch {
      // sin almacenamiento: se vuelven a mostrar la próxima vez
    }
  }

  function agregar(lista: FileList | null) {
    const nuevos = lista ? [...lista] : []
    setFilas((actuales) => [
      ...actuales,
      ...nuevos.map((archivo): Fila => {
        const r = revisarNombre(archivo.name, facturas, esPdf(archivo))
        if (!r.ok) return { archivo, facturaId: '', tipo: r.tipo, error: r.error, pideSiniestro: false, siniestro: '' }
        // El siniestro llega con la documentación: si la factura no lo tiene, sale del nombre o se escribe en la fila
        const pide = !r.factura.siniestro
        return { archivo, facturaId: r.factura.id, tipo: r.tipo, error: null, pideSiniestro: pide, siniestro: pide ? siniestroDelNombre(archivo.name, r.factura) ?? '' : '' }
      }),
    ])
    setEstado(null)
  }
  function soltar(e: DragEvent<HTMLLabelElement>) {
    e.preventDefault()
    setArrastrando(false)
    agregar(e.dataTransfer.files)
  }
  const cambiar = (i: number, cambios: Partial<Fila>) => setFilas((l) => l.map((f, j) => (j === i ? { ...f, ...cambios } : f)))

  const asignadas = filas.filter((f) => f.facturaId)
  const sinSiniestro = asignadas.filter((f) => f.pideSiniestro && !f.siniestro.trim()).length
  const sinAsignar = filas.length - asignadas.length

  async function subirTodo() {
    setSubiendo(true)
    setEstado(null)
    let hechas = 0
    try {
      // Se agrupan por factura y por documento: varias fotos del mismo documento van juntas
      const porFactura = new Map<string, Fila[]>()
      for (const f of asignadas) porFactura.set(f.facturaId, [...(porFactura.get(f.facturaId) ?? []), f])
      for (const [id, lista] of porFactura) {
        const c = comprobantes.find((x) => x.id === id)
        if (!c) continue
        let documentos: Documento[] = c.documentos.length ? c.documentos : TODOS.map((t) => ({ tipo: t, estado: 'faltante' }))
        const porTipo = new Map<TipoArchivo, Fila[]>()
        for (const f of lista) porTipo.set(f.tipo, [...(porTipo.get(f.tipo) ?? []), f])
        const subidos: string[] = []
        for (const [tipo, archivos] of porTipo) {
          setEstado({ texto: `Subiendo ${formatoComprobante(c)}…` })
          const adjuntos: { archivo: string; url?: string }[] = []
          for (const f of archivos) adjuntos.push(await subirDocumento(id, tipo, await prepararArchivo(f.archivo)))
          const tipos = tipo === 'documentacion' ? TODOS : [tipo]
          documentos = documentos.map((d): Documento =>
            tipos.includes(d.tipo)
              ? {
                  tipo: d.tipo,
                  estado: 'en_revision',
                  archivo: adjuntos.length > 1 ? `${adjuntos[0].archivo} (+${adjuntos.length - 1})` : adjuntos[0].archivo,
                  url: adjuntos[0].url,
                  adjuntos: adjuntos.length > 1 ? adjuntos : undefined,
                  subidoPor: usuario,
                  fecha: hoy,
                  // Si CobroSync la asignó por el nombre y nadie la cambió, Auditoría lo ve para revisarlo con atención
                  // La factura sale del número del nombre: Auditoría igual lo revisa
                  origen: 'varios-automatico',
                }
              : d,
          )
          subidos.push(tipo === 'documentacion' ? 'la documentación' : NOMBRE_DOCUMENTO[tipo].toLowerCase())
          hechas += archivos.length
        }
        const siniestro = c.siniestro ? null : lista.map((f) => f.siniestro.trim()).find(Boolean) ?? null
        actualizarComprobante(id, {
          ...(siniestro ? { siniestro } : {}),
          documentos,
          fechaDrive: hoy,
          subidoPor: usuario,
          estado: c.estado === 'pendiente_drive' ? 'en_gestion' : c.estado,
        })
        registrarEvento(id, 'subida', `Subió ${subidos.join(' y ')} (carga de varios archivos: ${lista.map((f) => f.archivo.name).join(', ')})`)
      }
      setFilas((l) => l.filter((f) => !f.facturaId))
      setEstado({ texto: `Listo: se subieron ${hechas} archivos a ${porFactura.size} facturas. Ahora los revisa Auditoría.` })
    } catch (e) {
      setEstado({ texto: e instanceof Error ? e.message : String(e), error: true })
    } finally {
      setSubiendo(false)
    }
  }

  return (
    <>
      <div className="fixed inset-0 z-40 bg-noche/40" onClick={onCerrar} aria-hidden="true" />
      <div className="fixed inset-x-0 top-6 z-50 mx-auto flex max-h-[90vh] w-[min(64rem,95vw)] flex-col rounded-xl bg-white shadow-2xl" role="dialog" aria-label="Subir varios archivos">
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <h2 className="text-lg font-extrabold">Subir varios PDF de una vez</h2>
            <p className="mt-1 text-sm text-slate-600">Cada PDF va a la factura del número que tiene en el nombre.</p>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={() => leidas && setCondiciones((v) => !v)}
              disabled={!leidas}
              title={leidas ? undefined : 'Leer las condiciones y tocar Entendido'}
              className="inline-flex disabled:cursor-default items-center gap-1 rounded-full border border-sem-amarillo/60 bg-amber-50 px-3 py-1 text-xs font-semibold text-amber-900 hover:bg-amber-100"
            >
              <Info className="h-3.5 w-3.5" /> Condiciones
            </button>
            <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-fondo">
              <X className="h-5 w-5" />
            </button>
          </div>
        </div>

        <div className="overflow-y-auto p-5">
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${!leidas ? 'pointer-events-none opacity-40' : ''} ${
              arrastrando ? 'border-marca bg-marca/5' : 'border-slate-300 hover:border-marca/60'
            }`}
          >
            <Upload className="h-7 w-7 text-marca" />
            <span className="font-semibold">Soltar acá los PDF (todos juntos) o hacer clic para elegirlos</span>
            <input type="file" multiple accept=".pdf,application/pdf" className="sr-only" onChange={(e) => agregar(e.target.files)} />
          </label>

          {/* La regla de los nombres: se exige, para que ningún archivo quede sin saber de qué factura es */}
          {condiciones && (
            <div className="mt-3 rounded-lg border border-sem-amarillo/50 bg-amber-50 p-3 text-xs text-amber-950">
              <ul className="list-disc space-y-0.5 pl-4">
                <li>
                  Solo <strong>PDF</strong>. En el nombre, el <strong>número de factura</strong> y el <strong>siniestro</strong>:{' '}
                  <code>35-11032 siniestro 22365.pdf</code>. Si se quiere, <code>fc</code> u <code>or</code> para decir qué es.
                </li>
                <li>Nombres cortos (hasta 40 caracteres): sin la compañía ni otras palabras, porque las plataformas los rechazan.</li>
                <li>Si un archivo no tiene el siniestro, se escribe en su fila. Lo que queda en rojo no se sube: corregir el nombre y volver a soltarlo.</li>
              </ul>
              {!leidas && (
                <button type="button" onClick={cerrarCondiciones} className="mt-2 rounded-lg bg-amber-900 px-3 py-1.5 font-semibold text-white hover:bg-amber-950">
                  Entendido
                </button>
              )}
            </div>
          )}

          {filas.length > 0 && (
            <table className="mt-4 w-full text-left text-[13px]">
              <thead className="text-[11px] uppercase tracking-wide text-slate-500">
                <tr>
                  <th className="px-2 py-2">Archivo</th>
                  <th className="px-2 py-2">Factura</th>
                  <th className="px-2 py-2">Qué es</th>
                  <th />
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {filas.map((f, i) => {
                  const factura = facturas.find((c) => c.id === f.facturaId)
                  return (
                    <tr key={`${f.archivo.name}-${i}`} className={f.error ? 'bg-red-50' : ''}>
                      <td className="max-w-56 truncate px-2 py-2 font-medium" title={f.archivo.name}>
                        {f.archivo.name}
                      </td>
                      <td className="px-2 py-2">
                        {factura ? (
                          <span className="whitespace-nowrap">
                            {formatoComprobante(factura)}
                            {factura.siniestro && <span className="block text-[11px] text-slate-500">Siniestro {factura.siniestro}</span>}
                            {f.pideSiniestro && (
                              <input
                                value={f.siniestro}
                                onChange={(e) => cambiar(i, { siniestro: e.target.value })}
                                placeholder="N.º de siniestro"
                                aria-label="Número de siniestro"
                                className={`${claseSelect} mt-1 block w-36 py-1 text-xs ${f.siniestro.trim() ? '' : 'border-sem-amarillo'}`}
                              />
                            )}
                          </span>
                        ) : (
                          <span className="text-xs font-semibold text-red-800">{f.error}</span>
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {!f.error && (
                          <select value={f.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoArchivo })} className={claseSelect}>
                            {(Object.keys(NOMBRE_TIPO) as TipoArchivo[]).map((t) => (
                              <option key={t} value={t}>
                                {NOMBRE_TIPO[t]}
                              </option>
                            ))}
                          </select>
                        )}
                      </td>
                      <td className="px-2 py-2 text-right">
                        <button type="button" onClick={() => setFilas((l) => l.filter((_, j) => j !== i))} className="text-xs text-slate-500 hover:text-sem-rojo">
                          Quitar
                        </button>
                      </td>
                    </tr>
                  )
                })}
              </tbody>
            </table>
          )}
          {estado && (
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${estado.error ? 'bg-sem-rojo/10 text-red-900' : 'bg-esmeralda/10 text-teal-900'}`}>{estado.texto}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
          <span className="text-sm text-slate-600">
            {filas.length === 0
              ? 'Todavía no hay archivos.'
              : `${asignadas.length} listos para subir${sinSiniestro ? ` · ${sinSiniestro} sin número de siniestro (escribirlo en la fila)` : ''}${sinAsignar ? ` · ${sinAsignar} con el nombre mal o que no son PDF (no se suben)` : ''}`}
          </span>
          <button
            type="button"
            disabled={subiendo || asignadas.length === 0 || sinSiniestro > 0}
            onClick={() => void subirTodo()}
            className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
          >
            <FileUp className="h-4 w-4" /> {subiendo ? 'Subiendo…' : `Subir todo (${asignadas.length})`}
          </button>
        </div>
      </div>
    </>
  )
}
