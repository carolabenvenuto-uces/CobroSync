import { useMemo, useState, type DragEvent } from 'react'
import { FileUp, Upload, X } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import { facturasParaCargar, sugerirFactura, type TipoArchivo } from '../domain/archivos'
import { NOMBRE_DOCUMENTO } from '../domain/semaforo'
import type { Documento, TipoDocumento } from '../domain/tipos'
import { prepararArchivo } from '../lib/imagenes'
import { formatoComprobante } from '../lib/formato'
import { claseSelect } from './ui/Estados'

const TODOS: TipoDocumento[] = ['factura', 'orden', 'firma']
const NOMBRE_TIPO: Record<TipoArchivo, string> = {
  documentacion: 'Todo junto (factura, orden y firma)',
  factura: NOMBRE_DOCUMENTO.factura,
  orden: NOMBRE_DOCUMENTO.orden,
  firma: NOMBRE_DOCUMENTO.firma,
}

interface Fila {
  archivo: File
  facturaId: string
  tipo: TipoArchivo
  por: string | null
  candidatas: string[]
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

  function agregar(lista: FileList | null) {
    const nuevos = lista ? [...lista] : []
    setFilas((actuales) => [
      ...actuales,
      ...nuevos.map((archivo): Fila => {
        const s = sugerirFactura(archivo.name, facturas)
        return { archivo, facturaId: s.factura?.id ?? '', tipo: s.tipo, por: s.por, candidatas: s.candidatas.map((c) => c.id) }
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
                }
              : d,
          )
          subidos.push(tipo === 'documentacion' ? 'la documentación' : NOMBRE_DOCUMENTO[tipo].toLowerCase())
          hechas += archivos.length
        }
        actualizarComprobante(id, {
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
            <h2 className="text-lg font-extrabold">Subir varios archivos de una vez</h2>
            <p className="mt-1 text-sm text-slate-600">
              Soltá todos los escaneos juntos. CobroSync sugiere a qué factura va cada uno; revisá y tocá <strong>Subir todo</strong>.
            </p>
          </div>
          <button type="button" onClick={onCerrar} aria-label="Cerrar" className="rounded-lg p-1 hover:bg-fondo">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="overflow-y-auto p-5">
          <label
            onDragOver={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragLeave={() => setArrastrando(false)}
            onDrop={soltar}
            className={`flex cursor-pointer flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center ${
              arrastrando ? 'border-marca bg-marca/5' : 'border-slate-300 hover:border-marca/60'
            }`}
          >
            <Upload className="h-7 w-7 text-marca" />
            <span className="font-semibold">Soltá acá los PDF o fotos (todos juntos)</span>
            <input type="file" multiple accept="application/pdf,image/*" className="sr-only" onChange={(e) => agregar(e.target.files)} />
          </label>

          {/* Guía corta: con el nombre bien puesto, cada archivo se asigna solo */}
          <div className="mt-3 rounded-lg border border-marca/20 bg-marca/5 p-3 text-xs text-blue-950">
            <div className="mb-1 font-bold">Cómo nombrar los archivos para que se asignen solos</div>
            <ul className="list-disc space-y-0.5 pl-4">
              <li>
                Poné el <strong>punto de venta y el número de factura</strong>, como figura en la factura: <code>35-00011032</code> (también sirve{' '}
                <code>35-11032</code>). Si no lo tenés, el <strong>siniestro</strong> o la <strong>patente</strong>.
              </li>
              <li>
                Agregá <strong>qué es</strong>: <code>factura</code>, <code>orden</code> o <code>firma</code>. Si escaneaste todo junto en un solo PDF, no hace falta.
              </li>
              <li>
                Ejemplos: <code>35-00011032 orden.pdf</code> · <code>35-00011032 firma.jpg</code> · <code>35-00011032.pdf</code> (todo junto) ·{' '}
                <code>siniestro 051-2-335854.pdf</code>
              </li>
            </ul>
          </div>

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
                  const opciones = f.candidatas.length ? facturas.filter((c) => f.candidatas.includes(c.id)) : facturas
                  return (
                    <tr key={`${f.archivo.name}-${i}`} className={f.facturaId ? '' : 'bg-amber-50'}>
                      <td className="max-w-56 truncate px-2 py-2 font-medium" title={f.archivo.name}>
                        {f.archivo.name}
                        <div className="text-[11px] font-normal text-slate-500">
                          {f.por ? `Encontrada por ${f.por}` : f.candidatas.length ? `${f.candidatas.length} posibles: elegí` : 'Elegí la factura'}
                        </div>
                      </td>
                      <td className="px-2 py-2">
                        <select value={f.facturaId} onChange={(e) => cambiar(i, { facturaId: e.target.value, por: null })} className={`${claseSelect} w-full max-w-xs`}>
                          <option value="">— Elegir —</option>
                          {opciones.map((c) => (
                            <option key={c.id} value={c.id}>
                              {formatoComprobante(c)}
                              {c.siniestro ? ` · ${c.siniestro}` : ''}
                              {c.patente ? ` · ${c.patente}` : ''}
                            </option>
                          ))}
                        </select>
                      </td>
                      <td className="px-2 py-2">
                        <select value={f.tipo} onChange={(e) => cambiar(i, { tipo: e.target.value as TipoArchivo })} className={claseSelect}>
                          {(Object.keys(NOMBRE_TIPO) as TipoArchivo[]).map((t) => (
                            <option key={t} value={t}>
                              {NOMBRE_TIPO[t]}
                            </option>
                          ))}
                        </select>
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
            <p className={`mt-3 rounded-lg px-3 py-2 text-sm ${estado.error ? 'bg-sem-rojo/10 text-red-900' : 'bg-esmeralda/10 text-emerald-900'}`}>{estado.texto}</p>
          )}
        </div>

        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 p-4">
          <span className="text-sm text-slate-600">
            {filas.length === 0 ? 'Todavía no agregaste archivos.' : `${asignadas.length} listos para subir${sinAsignar ? ` · ${sinAsignar} sin factura (no se suben)` : ''}`}
          </span>
          <button
            type="button"
            disabled={subiendo || asignadas.length === 0}
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
