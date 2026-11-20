import { limpiarSiniestro } from '../domain/siniestros'
import { useEffect, useMemo, useRef, useState, type DragEvent } from 'react'
import { FileUp, Info, Upload, X } from 'lucide-react'
import { useApp, useComprobantes } from '../context/AppContext'
import { facturasParaCargar, LARGO_MAXIMO_NOMBRE, patenteDelNombre, revisarNombre, siniestroDelNombre, type TipoArchivo, esNotaDeCreditoPorNombre, aclaraQueEs, formatosDeSiniestro } from '../domain/archivos'
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
  /** el siniestro del nombre del archivo ('' si no tiene) */
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
      return !!localStorage.getItem('cobrosync-condiciones-varios-3')
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
      localStorage.setItem('cobrosync-condiciones-varios-3', '1')
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
  // Cómo son los siniestros de cada compañía, para leer bien uno escrito con espacios
  const formatos = useMemo(() => formatosDeSiniestro(comprobantes), [comprobantes])

  function agregar(lista: FileList | File[] | null) {
    const nuevos = lista ? [...lista] : []
    if (!nuevos.length) return
    setFilas((actuales) => [
      ...actuales,
      ...nuevos.map((archivo): Fila => {
        const r = revisarNombre(archivo.name, facturas, esPdf(archivo), true, formatos)
        if (!r.ok) {
          // ¿Factura de hoy? El número es de un punto de venta de la sucursal pero todavía no está en Quiter
          const corto = archivo.name.replace(/\.[a-z0-9]+$/i, '').length <= LARGO_MAXIMO_NOMBRE
          const n = escanea && esPdf(archivo) && corto ? facturaDeHoy(archivo.name, miSucursal, comprobantes) : null
          if (n) {
            // Una NC de hoy: queda en espera igual que las facturas, y se une a la NC cuando entra de Quiter
            const nc = esNotaDeCreditoPorNombre(archivo.name)
            if (!aclaraQueEs(archivo.name)) return { archivo, facturaId: '', tipo: r.tipo, error: 'Falta aclarar al final qué es: FC, OR o FC OR (las dos juntas). Por ejemplo: 21-20827 4500546 FC OR.pdf', siniestro: '' }
            const siniestro = siniestroDelNombre(archivo.name, n) ?? ''
            // la orden o el archivo con todo junto llevan el siniestro en el nombre ("21-803 NC" no)
            const llevaSiniestro = nc ? /\bor\b|orden/i.test(archivo.name) : r.tipo === 'orden' || r.tipo === 'documentacion'
            if (llevaSiniestro && !siniestro) return { archivo, facturaId: '', tipo: r.tipo, error: 'Falta el siniestro en el nombre. Por ejemplo: 21-20834 104-4-137055 OR.pdf', siniestro: '' }
            return { archivo, facturaId: '', tipo: r.tipo, nc, error: null, siniestro, deHoy: n }
          }
          // Un mensaje que diga por qué: otro punto de venta, o una factura que ya no recibe documentos
          const sucursales = datos?.meta.sucursales ?? []
          const num = numerosDelNombre(archivo.name)[0]
          let error = r.error
          // (si la factura está pendiente, el motivo es el del nombre: por ejemplo, que falta el siniestro)
          const pendiente = num && facturas.some((c) => c.puntoVenta === num.puntoVenta && c.numero === num.numero)
          if (num && !pendiente && esPdf(archivo) && corto && escanea && miSucursal) {
            const existe = comprobantes.find((c) => c.puntoVenta === num.puntoVenta && c.numero === num.numero)
            if (existe) error = `La factura ${num.puntoVenta}-${num.numero} está ${existe.estado === 'anulada' ? 'anulada' : 'cobrada'}: no recibe documentos.`
            else if (!puntosDeVenta(miSucursal).includes(num.puntoVenta)) {
              const otra = sucursales.find((s) => puntosDeVenta(s).includes(num.puntoVenta))
              error = otra
                ? `La factura ${num.puntoVenta}-${num.numero} es de ${otra.nombre}, no de ${miSucursal.nombre}.`
                : `El punto de venta ${num.puntoVenta} no es de ${miSucursal.nombre} (sus puntos de venta: ${puntosDeVenta(miSucursal).join(', ')}). Revisar el número.`
            }
          }
          return { archivo, facturaId: '', tipo: r.tipo, error, siniestro: '' }
        }
        // Lo ya aprobado no se vuelve a subir (pisaría la aprobación)
        const c = r.factura
        const objetivo: TipoDocumento[] = c.tipo === 'NC' ? ['factura'] : r.tipo === 'documentacion' ? TODOS : [r.tipo]
        const aprobadoConPdf = (t: TipoDocumento) => {
          const d = c.documentos.find((x) => x.tipo === t)
          return d?.estado === 'ok' && !!(d.url || d.archivo)
        }
        if (objetivo.every(aprobadoConPdf)) {
          const que = c.tipo === 'NC' ? 'La nota de crédito ya está aprobada' : objetivo.length > 1 ? 'La factura y la orden ya están aprobadas' : objetivo[0] === 'orden' ? 'La orden ya está aprobada' : 'La factura ya está aprobada'
          return { archivo, facturaId: '', tipo: r.tipo, error: `${que}: no hace falta subirla.`, siniestro: '' }
        }
        // El siniestro sale del nombre (revisarNombre ya pidió que esté en la orden y en el archivo con todo junto)
        return { archivo, facturaId: r.factura.id, tipo: r.tipo, error: null, siniestro: r.siniestro }
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

  // Una FC sola, sin su orden (ni en la lista ni ya subida), no se sube: la factura sola no sirve
  const claveDe = (f: Fila) => f.facturaId || (f.deHoy ? `hoy-${f.deHoy.puntoVenta}-${f.deHoy.numero}` : '')
  const faltaOrden = (f: Fila) => {
    if (f.tipo !== 'factura' || f.nc || (!f.facturaId && !f.deHoy) || (f.error && !f.facturaId)) return false
    const c = comprobantes.find((x) => x.id === f.facturaId)
    if (c?.tipo === 'NC') return false
    const orden = c?.documentos.find((d) => d.tipo === 'orden')
    if (orden && (orden.estado === 'ok' || orden.estado === 'en_revision')) return false
    return !filas.some((x) => claveDe(x) === claveDe(f) && (x.tipo === 'orden' || x.tipo === 'documentacion'))
  }
  const textoFaltaOrden = 'Falta la orden de esta factura: subirla junto con la FC (por ejemplo 21-20834 104-4-137055 OR).'
  const asignadas = filas.filter((f) => f.facturaId && !faltaOrden(f))
  const deHoy = filas.filter((f) => f.deHoy && !f.error && !faltaOrden(f))
  const listas = asignadas.length + deHoy.length
  const claveFactura = claveDe
  const sinAsignar = filas.length - asignadas.length - deHoy.length

  async function subirTodo() {
    const retenidas = new Set(filas.filter(faltaOrden))
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
            // el siniestro de la factura (o el escrito en cualquiera de sus PDF), para el nombre en Drive
            const c = comprobantes.find((x) => x.id === f.facturaId)
            const siniestro = c?.siniestro || limpiarSiniestro(asignadas.find((x) => x.facturaId === f.facturaId && x.siniestro.trim())?.siniestro ?? '')
            subidosPorArchivo.set(f, await subirDocumento(f.facturaId, f.tipo, await prepararArchivo(f.archivo), siniestro))
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
          // (un documento ya aprobado no se toca, aunque venga en el mismo PDF)
          const tipos = (c.tipo === 'NC' ? (['factura'] as TipoDocumento[]) : tipo === 'documentacion' ? TODOS : [tipo]).filter(
            (t) => {
              const d = c.documentos.find((x) => x.tipo === t)
              return !(d?.estado === 'ok' && (d.url || d.archivo))
            },
          )
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
          // quedan las que no se subieron: con error, con un fallo o una FC sin su orden
          .filter((f) => retenidas.has(f) || (f.facturaId ? conFallo.has(f.facturaId) : !(f.deHoy && !f.error)))
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
              <ul className="list-disc space-y-1 pl-4">
                <li>
                  Solo <strong>PDF</strong>.
                </li>
                <li>
                  Todo PDF lleva el <strong>número de factura</strong>: sin él no se puede unir a su legajo.
                </li>
                <li>
                  <strong>Documentos separados:</strong> <strong>FC</strong> factura · <strong>OR</strong> orden (<strong>con siniestro</strong>) ·{' '}
                  <strong>NC</strong> nota de crédito.
                </li>
                <li>
                  <strong>Documentos juntos:</strong> <strong>FC OR</strong> (<strong>con siniestro</strong>).
                </li>
                <li>
                  La FC <strong>no se sube sola</strong>: va con su orden, en otro PDF o junta.
                </li>
                <li>Patente o compañía: se pueden agregar, no son necesarias.</li>
              </ul>
              <p className="mt-2 font-semibold">Ejemplos</p>
              <dl className="mt-1 grid grid-cols-[auto_1fr] gap-x-3 gap-y-1">
                {[
                  ['21-20834 FC', 'factura'],
                  ['21-20834 104-4-137055 OR', 'orden'],
                  ['21-20827 4500546 FC OR', 'factura y orden juntas'],
                  ['21-803 NC', 'nota de crédito'],
                ].map(([nombre, que]) => (
                  <div key={nombre} className="contents">
                    <dt>
                      <code className="rounded bg-white px-1.5 py-0.5">{nombre}</code>
                    </dt>
                    <dd className="self-center">{que}</dd>
                  </div>
                ))}
              </dl>
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
                    <tr key={`${f.archivo.name}-${i}`} className={f.error || faltaOrden(f) ? 'bg-red-50' : ''}>
                      <td className="max-w-56 truncate px-2 py-2 font-medium" title={f.archivo.name}>
                        {f.archivo.name}
                      </td>
                      <td className="px-2 py-2">
                        {factura ? (
                          <span className="whitespace-nowrap">
                            {formatoComprobante(factura)}
                            {faltaOrden(f) && <span className="block whitespace-normal text-xs font-semibold text-red-800">{textoFaltaOrden}</span>}
                            {factura.siniestro && <span className="block text-[11px] text-slate-500">Siniestro {factura.siniestro}</span>}
                            {!factura.siniestro && f.siniestro && <span className="block text-[11px] text-slate-500">Siniestro {f.siniestro}</span>}
                          </span>
                        ) : (
                          f.deHoy ? (
                            <span className="whitespace-nowrap">
                              {f.deHoy.puntoVenta}-{f.deHoy.numero}
                              {faltaOrden(f) && <span className="block whitespace-normal text-xs font-semibold text-red-800">{textoFaltaOrden}</span>}
                              <span className="block text-[11px] font-semibold text-marca">{f.nc ? 'Nota de crédito de hoy' : 'Factura de hoy'}: se une al cargar el Excel de Quiter</span>
                              {f.siniestro && <span className="block text-[11px] text-slate-500">Siniestro {f.siniestro}</span>}
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
              : `${listas} listos para subir${sinAsignar ? ` · ${sinAsignar} con el nombre mal o que no son PDF (no se suben)` : ''}`}
          </span>
          <button
            type="button"
            disabled={subiendo || listas === 0}
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
