import { limpiarSiniestro } from '../domain/siniestros'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { FileUp, Info, Upload, X } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import { facturasParaCargar, LARGO_MAXIMO_NOMBRE, patenteDelNombre, revisarNombre, siniestroDelNombre, type TipoArchivo, esNotaDeCreditoPorNombre } from '../domain/archivos'
import { facturaDeHoy, numerosDelNombre, puntosDeVenta } from '../domain/espera'
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
  /** PDF de una nota de crédito (por el nombre: "NC 21-803") */
  nc?: boolean
  /** la factura todavía no tiene siniestro: se toma del nombre o se escribe en la fila */
  pideSiniestro: boolean
  siniestro: string
  /** factura de hoy, todavía no cargada: el PDF queda en espera hasta que se cargue el Excel de Quiter */
  deHoy?: { puntoVenta: number; numero: number }
}

/**
 * Subir muchos escaneos de una vez. CobroSync sugiere a qué factura va cada archivo (por el número,
 * el siniestro o la patente que tenga el nombre) y qué documento es; la persona revisa y sube todo.
 * Cada factura sigue teniendo su legajo, como siempre.
 */
export function CargaMasiva({ onCerrar, iniciales }: { onCerrar: () => void; /** PDF soltados antes de abrir la ventana */ iniciales?: File[] }) {
  const { datos, rol, sucursal, hoy, usuario, subirDocumento, subirEnEspera, actualizarComprobante, registrarEvento, sucursalPropia } = useApp()
  // La sucursal, o Cobranzas escaneando lo de su propia sucursal
  const escanea = rol === 'sucursal' || (rol === 'auditoria' && !!sucursalPropia && sucursal === sucursalPropia)
  const miSucursal = datos?.meta.sucursales.find((s) => s.nombre === sucursal)
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
    if (pendientes.current.length) {
      agregar(pendientes.current)
      pendientes.current = []
    }
    try {
      localStorage.setItem('cobrosync-condiciones-varios', '1')
    } catch {
      // sin almacenamiento: se vuelven a mostrar la próxima vez
    }
  }

  // Los PDF soltados en Mis facturas: entran apenas se abre (o después de Entendido, la primera vez)
  const pendientes = useRef<File[]>(leidas ? [] : (iniciales ?? []))
  useEffect(() => {
    if (leidas && iniciales?.length) agregar(iniciales)
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const leidasRef = useRef(leidas)
  leidasRef.current = leidas
  const agregarRef = useRef(agregar)
  agregarRef.current = agregar
  function agregar(lista: FileList | File[] | null) {
    const nuevos = lista ? [...lista] : []
    if (!nuevos.length) return
    setFilas((actuales) => [
      ...actuales,
      ...nuevos.map((archivo): Fila => {
        const r = revisarNombre(archivo.name, facturas, esPdf(archivo))
        if (!r.ok) {
          // ¿Factura de hoy? El número es de un punto de venta de la sucursal pero todavía no está en Quiter
          const corto = archivo.name.replace(/\.[a-z0-9]+$/i, '').length <= LARGO_MAXIMO_NOMBRE
          const n = escanea && esPdf(archivo) && corto ? facturaDeHoy(archivo.name, miSucursal, comprobantes) : null
          if (n) {
            // Una NC de hoy: queda en espera igual que las facturas, y se une a la NC cuando entra de Quiter
            const nc = esNotaDeCreditoPorNombre(archivo.name)
            return { archivo, facturaId: '', tipo: r.tipo, nc, error: null, pideSiniestro: !nc, siniestro: nc ? '' : siniestroDelNombre(archivo.name, n) ?? '', deHoy: n }
          }
          // Un mensaje que diga por qué: otro punto de venta, o una factura que ya no recibe documentos
          const sucursales = datos?.meta.sucursales ?? []
          const num = numerosDelNombre(archivo.name)[0]
          let error = r.error
          if (num && esPdf(archivo) && corto && escanea && miSucursal) {
            const existe = comprobantes.find((c) => c.puntoVenta === num.puntoVenta && c.numero === num.numero)
            if (existe) error = `La factura ${num.puntoVenta}-${num.numero} está ${existe.estado === 'anulada' ? 'anulada' : 'cobrada'}: no recibe documentos.`
            else if (!puntosDeVenta(miSucursal).includes(num.puntoVenta)) {
              const otra = sucursales.find((s) => puntosDeVenta(s).includes(num.puntoVenta))
              error = otra
                ? `La factura ${num.puntoVenta}-${num.numero} es de ${otra.nombre}, no de ${miSucursal.nombre}.`
                : `El punto de venta ${num.puntoVenta} no es de ${miSucursal.nombre} (sus puntos de venta: ${puntosDeVenta(miSucursal).join(', ')}). Revisar el número.`
            }
          }
          return { archivo, facturaId: '', tipo: r.tipo, error, pideSiniestro: false, siniestro: '' }
        }
        // El siniestro llega con la documentación: si la factura no lo tiene, sale del nombre o se escribe en la fila
        // (una nota de crédito no lleva siniestro)
        const pide = r.factura.tipo !== 'NC' && !r.factura.siniestro
        return { archivo, facturaId: r.factura.id, tipo: r.tipo, error: null, pideSiniestro: pide, siniestro: pide ? siniestroDelNombre(archivo.name, r.factura) ?? '' : '' }
      }),
    ])
    setEstado(null)
  }
  function soltar(e: DragEvent<HTMLElement>) {
    e.preventDefault()
    e.stopPropagation()
    setArrastrando(false)
    if (!leidas) {
      setEstado({ texto: 'Primero hay que leer las condiciones y tocar Entendido; después se pueden soltar los PDF.', error: true })
      return
    }
    agregar(archivosSoltados(e.dataTransfer))
  }

  // Con la ventana abierta, un PDF soltado en cualquier lugar de la pantalla se agrega (y el navegador
  // no intenta abrirlo, que dentro de la plataforma no hace nada y parece que no anduvo)
  useEffect(() => {
    const encima = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      e.dataTransfer.dropEffect = 'copy'
    }
    const suelta = (e: globalThis.DragEvent) => {
      if (!e.dataTransfer?.types.includes('Files')) return
      e.preventDefault()
      setArrastrando(false)
      if (!leidasRef.current) {
        setEstado({ texto: 'Primero hay que leer las condiciones y tocar Entendido; después se pueden soltar los PDF.', error: true })
        return
      }
      agregarRef.current(archivosSoltados(e.dataTransfer))
    }
    window.addEventListener('dragover', encima)
    window.addEventListener('drop', suelta)
    return () => {
      window.removeEventListener('dragover', encima)
      window.removeEventListener('drop', suelta)
    }
  }, [])
  const cambiar = (i: number, cambios: Partial<Fila>) => setFilas((l) => l.map((f, j) => (j === i ? { ...f, ...cambios } : f)))

  const asignadas = filas.filter((f) => f.facturaId)
  const deHoy = filas.filter((f) => f.deHoy && !f.error)
  const listas = asignadas.length + deHoy.length
  // El siniestro alcanza con que esté en uno de los PDF de cada factura (por ejemplo, en el de la orden)
  const claveFactura = (f: Fila) => f.facturaId || (f.deHoy ? `hoy-${f.deHoy.puntoVenta}-${f.deHoy.numero}` : '')
  const conSiniestro = new Set([...asignadas, ...deHoy].filter((f) => f.siniestro.trim()).map(claveFactura))
  const faltaSiniestro = (f: Fila) => f.pideSiniestro && !f.siniestro.trim() && !conSiniestro.has(claveFactura(f))
  const sinSiniestro = [...asignadas, ...deHoy].filter(faltaSiniestro).length
  const sinAsignar = filas.length - asignadas.length - deHoy.length

  async function subirTodo() {
    setSubiendo(true)
    setEstado(null)
    let hechas = 0
    try {
      // Primero se suben todos los PDF a Drive, de a varios a la vez (de a uno tardaba mucho)
      const subidosPorArchivo = new Map<Fila, { archivo: string; url?: string }>()
      // Si un PDF no se pudo subir, su factura queda sin tocar (y el archivo queda en la lista para reintentar)
      const fallos = new Map<Fila, string>()
      let listos = 0
      const pendientes = [...asignadas]
      const total = pendientes.length
      setEstado({ texto: `Subiendo 0 de ${total}…` })
      const trabajar = async () => {
        for (let f = pendientes.shift(); f; f = pendientes.shift()) {
          try {
            subidosPorArchivo.set(f, await subirDocumento(f.facturaId, f.tipo, await prepararArchivo(f.archivo)))
          } catch (e) {
            fallos.set(f, e instanceof Error ? e.message : String(e))
          }
          listos++
          setEstado({ texto: `Subiendo ${listos} de ${total}…` })
        }
      }
      await Promise.all(Array.from({ length: Math.min(4, total) }, trabajar))

      // Se agrupan por factura y por documento: varias fotos del mismo documento van juntas
      const porFactura = new Map<string, Fila[]>()
      for (const f of asignadas) porFactura.set(f.facturaId, [...(porFactura.get(f.facturaId) ?? []), f])
      for (const [id, lista] of porFactura) {
        const c = comprobantes.find((x) => x.id === id)
        if (!c || lista.some((f) => fallos.has(f))) continue
        // La NC tiene un solo documento: su PDF (tipo "factura")
        let documentos: Documento[] =
          c.tipo === 'NC'
            ? [c.documentos.find((d) => d.tipo === 'factura') ?? { tipo: 'factura', estado: 'faltante' }]
            : c.documentos.length
              ? c.documentos
              : TODOS.map((t) => ({ tipo: t, estado: 'faltante' }))
        const porTipo = new Map<TipoArchivo, Fila[]>()
        // En una NC todo va junto como su PDF (la NC y, si tiene, la orden)
        for (const f of lista) {
          const t: TipoArchivo = c.tipo === 'NC' ? 'factura' : f.tipo
          porTipo.set(t, [...(porTipo.get(t) ?? []), f])
        }
        const subidos: string[] = []
        for (const [tipo, archivos] of porTipo) {
          const adjuntos = archivos.map((f) => subidosPorArchivo.get(f)!)
          const tipos = c.tipo === 'NC' ? (['factura'] as TipoDocumento[]) : tipo === 'documentacion' ? TODOS : [tipo]
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
                  // Si CobroSync la asignó por el nombre y nadie la cambió, Cobranzas lo ve para revisarlo con atención
                  // La factura sale del número del nombre: Cobranzas igual lo revisa
                  origen: 'varios-automatico',
                }
              : d,
          )
          subidos.push(c.tipo === 'NC' ? 'el PDF de la nota de crédito' : tipo === 'documentacion' ? 'la documentación' : NOMBRE_DOCUMENTO[tipo].toLowerCase())
          hechas += archivos.length
        }
        const siniestro = c.tipo === 'NC' || c.siniestro ? null : lista.map((f) => limpiarSiniestro(f.siniestro)).find(Boolean) ?? null
        // La patente, si viene en el nombre de algún archivo (opcional)
        const patente = c.tipo === 'NC' || c.patente ? null : lista.map((f) => patenteDelNombre(f.archivo.name)).find(Boolean) ?? null
        actualizarComprobante(id, {
          ...(siniestro ? { siniestro } : {}),
          ...(patente ? { patente } : {}),
          documentos,
          fechaDrive: hoy,
          subidoPor: usuario,
          estado: c.estado === 'pendiente_drive' ? 'en_gestion' : c.estado,
        })
        registrarEvento(id, 'subida', `Subió ${subidos.join(' y ')} (carga de varios archivos: ${lista.map((f) => f.archivo.name).join(', ')})`)
      }
      // Facturas de hoy: quedan en espera hasta que Cobranzas cargue el Excel de Quiter, y ahí se unen a su legajo
      for (const f of deHoy) {
        setEstado({ texto: `Subiendo ${f.archivo.name}…` })
        // el siniestro escrito en cualquiera de los PDF de esa factura
        const siniestro = f.siniestro.trim() || deHoy.find((x) => claveFactura(x) === claveFactura(f) && x.siniestro.trim())?.siniestro || ''
        await subirEnEspera(f.deHoy!.puntoVenta, f.deHoy!.numero, f.nc ? 'nc' : f.tipo, limpiarSiniestro(siniestro), await prepararArchivo(f.archivo))
      }
      const conFallo = new Set([...fallos.keys()].map((f) => f.facturaId))
      setFilas((l) =>
        l
          .filter((f) => (f.facturaId ? conFallo.has(f.facturaId) : !(f.deHoy && !f.error)))
          .map((f) => (fallos.has(f) ? { ...f, error: `No se pudo subir: ${fallos.get(f)}` } : f)),
      )
      const facturasOk = [...porFactura.keys()].filter((id) => !conFallo.has(id)).length
      setEstado({
        texto: `Listo: ${hechas ? `se subieron ${hechas} archivos a ${facturasOk} facturas` : ''}${hechas && deHoy.length ? ' y ' : ''}${deHoy.length ? `${deHoy.length} de facturas de hoy quedan en espera hasta que se cargue el Excel de Quiter` : ''}. Cobranzas los revisa.${fallos.size ? ` ${fallos.size} no se pudieron subir: quedan en la lista para volver a intentar.` : ''}`,
        error: fallos.size > 0,
      })
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
            onDragEnter={(e) => {
              e.preventDefault()
              setArrastrando(true)
            }}
            onDragOver={(e) => {
              e.preventDefault()
              e.dataTransfer.dropEffect = 'copy'
              setArrastrando(true)
            }}
            onDragLeave={(e) => {
              // Solo cuando sale de la zona (no al pasar por el ícono o el texto de adentro)
              if (!e.currentTarget.contains(e.relatedTarget as Node | null)) setArrastrando(false)
            }}
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
                  <code>35-11032 siniestro 22365.pdf</code>. Con o sin ceros (<code>0035-00011032</code>) y con guion, espacio o punto. La
                  palabra siniestro puede ir abreviada o no ir. Si es un solo documento, al final <code>fc</code> u <code>or</code>; una nota de crédito, <code>nc</code>.
                </li>
                <li>Nombres cortos (hasta 40 caracteres): sin la compañía ni otras palabras, porque las plataformas los rechazan.</li>
                <li>El siniestro alcanza con que esté en uno de los PDF de cada factura (por ejemplo, el de la orden); si no está en ninguno, se escribe en la fila. Lo que queda en rojo no se sube: corregir el nombre y volver a soltarlo.</li>
                <li>Facturas de hoy que todavía no aparecen: se suben igual y se unen a su legajo cuando Cobranzas cargue el Excel de Quiter.</li>
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
                                placeholder={conSiniestro.has(claveFactura(f)) && !f.siniestro.trim() ? 'Ya está en otro PDF' : 'N.º de siniestro'}
                                aria-label="Número de siniestro"
                                className={`${claseSelect} mt-1 block w-36 py-1 text-xs ${faltaSiniestro(f) ? 'border-sem-amarillo' : ''}`}
                              />
                            )}
                          </span>
                        ) : (
                          f.deHoy ? (
                            <span className="whitespace-nowrap">
                              {f.deHoy.puntoVenta}-{f.deHoy.numero}
                              <span className="block text-[11px] font-semibold text-marca">{f.nc ? 'Nota de crédito de hoy' : 'Factura de hoy'}: se une al cargar el Excel de Quiter</span>
                              {!f.nc && <input
                                value={f.siniestro}
                                onChange={(e) => cambiar(i, { siniestro: e.target.value })}
                                placeholder={conSiniestro.has(claveFactura(f)) && !f.siniestro.trim() ? 'Ya está en otro PDF' : 'N.º de siniestro'}
                                aria-label="Número de siniestro"
                                className={`${claseSelect} mt-1 block w-36 py-1 text-xs ${faltaSiniestro(f) ? 'border-sem-amarillo' : ''}`}
                              />}
                            </span>
                          ) : (
                            <span className="text-xs font-semibold text-red-800">{f.error}</span>
                          )
                        )}
                      </td>
                      <td className="px-2 py-2">
                        {!f.error && (factura?.tipo === 'NC' || f.nc) ? (
                          <span className="text-xs font-semibold text-slate-600">Nota de crédito</span>
                        ) : !f.error && (
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
              : `${listas} listos para subir${sinSiniestro ? ` · ${sinSiniestro} sin número de siniestro (escribirlo en la fila)` : ''}${sinAsignar ? ` · ${sinAsignar} con el nombre mal o que no son PDF (no se suben)` : ''}`}
          </span>
          <button
            type="button"
            disabled={subiendo || listas === 0 || sinSiniestro > 0}
            onClick={() => void subirTodo()}
            className="inline-flex items-center gap-2 rounded-lg bg-marca px-4 py-2 text-sm font-semibold text-white hover:bg-marca-oscuro disabled:opacity-50"
          >
            <FileUp className="h-4 w-4" /> {subiendo ? 'Subiendo…' : `Subir todo (${listas})`}
          </button>
        </div>
      </div>
    </>
  )
}

/** Los archivos soltados: algunos navegadores los dan en files y otros solo en items. */
export function archivosSoltados(dt: DataTransfer | null): File[] {
  if (!dt) return []
  if (dt.files && dt.files.length) return [...dt.files]
  return [...(dt.items ?? [])].filter((i) => i.kind === 'file').map((i) => i.getAsFile()).filter((f): f is File => !!f)
}
