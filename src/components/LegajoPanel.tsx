import { useEffect, useMemo, useState, type ReactNode } from 'react'
import {
  Bell,
  CalendarClock,
  Check,
  CircleAlert,
  CircleCheck,
  FileUp,
  Megaphone,
  MessageSquare,
  Paperclip,
  Send,
  TriangleAlert,
  Undo2,
  X,
  Camera,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { cambiosPorErrorCorregido, cambiosPorRespuesta, estadoReclamo, finDeEspera, NOMBRE_ESTADO_RECLAMO, NOMBRE_RESPUESTA } from '../domain/reclamos'
import { atendidaPorOtra } from '../domain/pedidos'
import { PedidosLegajo } from './PedidosLegajo'
import { SacarFoto } from './SacarFoto'
import {
  calcularSemaforo,
  documentosDelLegajo,
  DOCUMENTOS_REQUERIDOS,
  MOTIVOS_OBSERVACION,
  NOMBRE_DOCUMENTO,
  NOMBRE_ESTADO_DOCUMENTO,
  puedePresentarse,
} from '../domain/semaforo'
import { compromisoVencido } from '../domain/sucursales'
import { importeCobrado, saldoSinCobro } from '../domain/importes'
import { facturasDelSiniestro } from '../domain/siniestros'
import { esNotaTotal } from '../services/erp'
import { esPdf, prepararArchivo } from '../lib/imagenes'
import { numeroParaNombre, revisarNombre, siniestroDelNombre } from '../domain/archivos'
import type { AreaEvento, Comprobante, Documento, Evento, Reclamo, RespuestaReclamo, TipoDocumento } from '../domain/tipos'
import { diffDias, sumarDias } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { AYUDA_ETAPA, BadgeEtapa, quienEtapa } from './ui/Badges'
import { claseSelect } from './ui/Estados'

export const MOTIVOS_DEMORA = [
  'El vehículo sigue en el taller',
  'Se facturó por adelantado: falta la firma del cliente',
  'Esperando la orden del proveedor de repuestos',
  'El cliente retira el auto la semana próxima',
  'Otro motivo',
]

const COLOR_AREA: Record<AreaEvento, string> = {
  sucursal: 'bg-sem-amarillo/15 text-amber-900',
  auditoria: 'bg-marca/10 text-indigo-800',
  gerencia: 'bg-etapa-compania/10 text-blue-800',
  sistema: 'bg-slate-100 text-slate-600',
}

const ICONO_EVENTO: Record<Evento['tipo'], ReactNode> = {
  subida: <FileUp className="h-4 w-4" />,
  mensaje: <MessageSquare className="h-4 w-4" />,
  rechazo: <Undo2 className="h-4 w-4 text-sem-rojo" />,
  compromiso: <CalendarClock className="h-4 w-4" />,
  presentacion: <Send className="h-4 w-4 text-marca" />,
  aviso: <Bell className="h-4 w-4 text-sem-amarillo" />,
  nota_credito: <Paperclip className="h-4 w-4" />,
  reclamo: <Megaphone className="h-4 w-4 text-red-800" />,
}

const ESTILO_DOC: Record<Documento['estado'], string> = {
  faltante: 'text-red-700',
  en_revision: 'text-sky-700',
  ok: 'text-teal-700',
  observado: 'text-red-700',
}

const botonPrincipal =
  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500'
const botonChico = 'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold'

/**
 * Panel lateral con el legajo de una factura.
 * - La sucursal sube la factura y la orden firmada (o un PDF con las dos).
 * - Auditoría revisa cada una y la tilda (aprobar) u observa con un motivo.
 * - Cuando las tres están aprobadas, la factura queda para presentar.
 * En la demo los cambios se guardan solo en memoria (se pierden al recargar).
 */
export function LegajoPanel({ comprobante: c, onCerrar }: { comprobante: Comprobante; onCerrar: () => void }) {
  const { datos, rol, usuario, hoy, actualizarComprobante, registrarEvento, subirDocumento, abrirLegajo } = useApp()
  const aseguradora = datos!.aseguradoras.find((a) => a.id === c.aseguradoraId)
  const semaforo = calcularSemaforo(c, hoy)
  const documentos = documentosDelLegajo(c.documentos)
  const leTocaALaSucursal = semaforo.responsable === 'sucursal'
  const reclamo = estadoReclamo(c, hoy)
  // Revisión en serie: las otras facturas que esperan la revisión de Auditoría, de la más vieja a la más nueva
  const paraRevisarDespues = useMemo(
    () =>
      rol === 'auditoria'
        ? datos!.comprobantes
            .filter((x) => x.id !== c.id && x.tipo === 'FC' && calcularSemaforo(x, hoy).etapa === 'en_revision')
            .sort((a, b) => a.fecha.localeCompare(b.fecha))
        : [],
    [datos, rol, c.id, hoy],
  )

  const [mensaje, setMensaje] = useState('')
  const [subiendo, setSubiendo] = useState(false)
  const [errorSubida, setErrorSubida] = useState<string | null>(null)
  const [observaciones, setObservaciones] = useState(c.observaciones)
  const [formulario, setFormulario] = useState<'ninguno' | 'demora' | 'rechazo' | 'reclamo' | 'cobro'>('ninguno')
  const [fechaCobro, setFechaCobro] = useState(hoy)
  const [importeCobroTexto, setImporteCobroTexto] = useState(() => saldoSinCobro(c).toFixed(2).replace('.', ','))
  const [observando, setObservando] = useState<TipoDocumento | null>(null)
  // Sacar fotos con el celular para este documento (se suben como PDF)
  const [foto, setFoto] = useState<TipoDocumento | null>(null)
  // El siniestro no se conoce hasta tener la orden: la sucursal lo informa al subirla
  const [siniestroNuevo, setSiniestroNuevo] = useState('')
  const [motivo, setMotivo] = useState<string>('')
  const [motivoDemora, setMotivoDemora] = useState('')
  const [fechaDemora, setFechaDemora] = useState(sumarDias(hoy, 5))
  const [docRechazo, setDocRechazo] = useState<TipoDocumento | ''>('')
  const [comentarioRechazo, setComentarioRechazo] = useState('')
  const [medioReclamo, setMedioReclamo] = useState<Reclamo['medio']>('mail')
  const [notaReclamo, setNotaReclamo] = useState('')
  const [respuestaReclamo, setRespuestaReclamo] = useState<RespuestaReclamo | ''>('')
  const [notaRespuesta, setNotaRespuesta] = useState('')

  // Que dos personas de Auditoría no trabajen la misma factura a la vez: al abrirla queda tomada
  // unos minutos a nombre de quien la abrió; la otra persona ve un aviso.
  const otraPersona = rol === 'auditoria' ? atendidaPorOtra(c, usuario) : null
  useEffect(() => {
    if (rol !== 'auditoria' || atendidaPorOtra(c, usuario)) return
    actualizarComprobante(c.id, { atendiendo: { por: usuario, hasta: new Date(Date.now() + 15 * 60_000).toISOString() } })
    return () => actualizarComprobante(c.id, { atendiendo: null })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [c.id])

  function registrarRespuesta() {
    if (!respuestaReclamo) return
    const r = cambiosPorRespuesta(c, respuestaReclamo, notaRespuesta.trim(), hoy, usuario || 'Auditoría')
    if (!r) return
    actualizarComprobante(c.id, r.campos)
    registrarEvento(c.id, 'reclamo', r.evento)
    setNotaRespuesta('')
  }

  function guardarDocumentos(nuevos: Documento[], extra: Partial<Comprobante> = {}) {
    actualizarComprobante(c.id, { documentos: nuevos, ...extra })
  }

  // ── Sucursal ──
  // Otras facturas del mismo siniestro (facturación parcial de repuestos): comparten la orden firmada
  const hermanas = c.tipo === 'FC' ? facturasDelSiniestro(c, datos?.comprobantes ?? []) : []
  const [compartirConHermanas, setCompartirConHermanas] = useState(true)

  async function subir(tipos: TipoDocumento[], lista: FileList | File[] | null | undefined) {
    const archivos = lista ? [...lista] : []
    if (archivos.length === 0) return
    setErrorSubida(null)
    // Se exige lo mismo que en la carga de varios archivos: PDF y el número de ESTA factura en el
    // nombre, para que no entre un archivo de otra factura por error
    for (const a of archivos) {
      const r = revisarNombre(a.name, [c], esPdf(a))
      if (!r.ok) {
        setErrorSubida(
          r.error.startsWith('No es un PDF')
            ? `"${a.name}" no es un PDF. Solo se aceptan PDF; para una foto, el botón Foto la convierte en PDF.`
            : `"${a.name}": el nombre tiene que tener el número de esta factura, ${numeroParaNombre(c)} (por ejemplo "${numeroParaNombre(c)} siniestro 22365.pdf"). Hay que cambiarle el nombre y volver a subirlo.`,
        )
        return
      }
    }
    // Con la orden llega el número de siniestro: si el legajo no lo tiene, se pide (o se toma del nombre del archivo)
    let siniestro: string | null = null
    if (!c.siniestro && tipos.includes('orden')) {
      siniestro = siniestroNuevo.trim() || archivos.map((a) => siniestroDelNombre(a.name, c)).find(Boolean) || null
      if (!siniestro) {
        setErrorSubida('Falta el número de siniestro: escribirlo en "Número de siniestro", arriba de los documentos, o agregarlo al nombre del archivo (por ejemplo "' + numeroParaNombre(c) + ' siniestro 22365.pdf").')
        return
      }
    }
    setSubiendo(true)
    try {
      // Con Google cada archivo se guarda en el Drive de la empresa; en la demo solo se registra el
      // nombre. Un documento puede tener varias páginas (varios PDF).
      const adjuntos: { archivo: string; url?: string }[] = []
      for (const a of archivos) {
        const listo = await prepararArchivo(a)
        adjuntos.push(await subirDocumento(c.id, tipos.length > 1 ? 'documentacion' : tipos[0], listo))
      }
      const documento = (tipo: TipoDocumento): Documento => ({
        tipo,
        estado: 'en_revision',
        archivo: adjuntos.length > 1 ? `${adjuntos[0].archivo} (+${adjuntos.length - 1})` : adjuntos[0].archivo,
        url: adjuntos[0].url,
        adjuntos: adjuntos.length > 1 ? adjuntos : undefined,
        subidoPor: usuario,
        fecha: hoy,
        origen: 'legajo',
      })
      guardarDocumentos(
        documentos.map((d): Documento => (tipos.includes(d.tipo) ? documento(d.tipo) : d)),
        { fechaDrive: hoy, subidoPor: usuario, estado: c.estado === 'pendiente_drive' ? 'en_gestion' : c.estado, ...(siniestro ? { siniestro } : {}) },
      )
      if (siniestro) registrarEvento(c.id, 'mensaje', `Informó el siniestro ${siniestro}`)
      const que = tipos.length > 1 ? 'la documentación' : NOMBRE_DOCUMENTO[tipos[0]].toLowerCase()
      const nombres = archivos.length > 1 ? `${archivos.length} archivos` : archivos[0].name
      registrarEvento(c.id, 'subida', `Subió ${que} (${nombres})`)

      // La orden firmada sirve también para las otras facturas del siniestro que no la tengan
      const compartibles: TipoDocumento[] = tipos.filter((t) => t !== 'factura')
      if (compartirConHermanas && compartibles.length) {
        for (const h of hermanas) {
          const docsH = h.documentos.length ? h.documentos : DOCUMENTOS_REQUERIDOS.map((t) => ({ tipo: t, estado: 'faltante' as const }))
          const aCompletar = compartibles.filter((t) => docsH.find((d) => d.tipo === t && (d.estado === 'faltante' || d.estado === 'observado')))
          if (aCompletar.length === 0) continue
          actualizarComprobante(h.id, {
            documentos: docsH.map((d) => (aCompletar.includes(d.tipo) ? documento(d.tipo) : d)),
            fechaDrive: hoy,
            subidoPor: usuario,
            estado: h.estado === 'pendiente_drive' ? 'en_gestion' : h.estado,
          })
          registrarEvento(h.id, 'subida', `Subió ${aCompletar.map((t) => NOMBRE_DOCUMENTO[t].toLowerCase()).join(' y ')} (la misma de ${formatoComprobante(c)}, mismo siniestro)`)
        }
      }
    } catch (e) {
      setErrorSubida(e instanceof Error ? e.message : 'No se pudo subir el archivo.')
    } finally {
      setSubiendo(false)
    }
  }
  const pendientesDeSubir = documentos.filter((d) => d.estado === 'faltante' || d.estado === 'observado').map((d) => d.tipo)

  function avisarDemora() {
    if (!motivoDemora) return
    actualizarComprobante(c.id, { compromiso: { fecha: fechaDemora, motivo: motivoDemora } })
    registrarEvento(c.id, 'compromiso', `${motivoDemora}. Se compromete a subirlo el ${formatoFecha(fechaDemora)}.`)
    setFormulario('ninguno')
  }

  // ── Auditoría: anulación informada por la sucursal ──
  function confirmarAnulacion() {
    actualizarComprobante(c.id, { estado: 'anulada' })
    registrarEvento(c.id, 'nota_credito', 'Auditoría confirmó la anulación con nota de crédito')
  }
  function rechazarAnulacion() {
    actualizarComprobante(c.id, { anulacionInformada: null })
    registrarEvento(c.id, 'mensaje', 'Auditoría indicó que la factura no se anula: sigue vigente')
  }

  // ── Auditoría: registrar el cobro ──
  function registrarCobro() {
    const importe = Number(importeCobroTexto.replace(/\./g, '').replace(',', '.'))
    const saldo = saldoSinCobro(c)
    const distinto = Number.isFinite(importe) && importe > 0 && Math.abs(importe - saldo) > 0.5
    actualizarComprobante(c.id, { estado: 'cobrada', fechaCobro, importeCobrado: distinto ? importe : null })
    registrarEvento(
      c.id,
      'mensaje',
      `Cobro registrado el ${formatoFecha(fechaCobro)}${distinto ? ` por ${formatoPesos(importe)} (saldo ${formatoPesos(saldo)})` : ''}`,
    )
    setFormulario('ninguno')
  }

  // ── Auditoría: vincular una nota de crédito con su factura ──
  const facturasParaNc =
    c.tipo === 'NC'
      ? (datos?.comprobantes ?? [])
          .filter((f) => f.tipo === 'FC' && f.estado !== 'anulada' && f.sucursal === c.sucursal && f.aseguradoraId === c.aseguradoraId && Math.abs(c.total) <= saldoSinCobro(f) + 1)
          .sort((a, b) => (a.id === c.ncReferencia ? -1 : b.id === c.ncReferencia ? 1 : b.fecha.localeCompare(a.fecha)))
          .slice(0, 40)
      : []
  const [facturaNc, setFacturaNc] = useState(c.ncReferencia ?? '')
  const facturaNcElegida = facturasParaNc.find((f) => f.id === facturaNc)
  function vincularNc(tipo: 'total' | 'parcial') {
    const f = facturaNcElegida
    if (!f) return
    const importe = Math.abs(c.total)
    actualizarComprobante(c.id, { ncReferencia: f.id, ncInformada: true })
    registrarEvento(c.id, 'nota_credito', `Vinculada con ${formatoComprobante(f)} (${tipo === 'total' ? 'anula la factura' : 'parcial'})`)
    if (tipo === 'total') {
      actualizarComprobante(f.id, { estado: 'anulada', anulacionInformada: null })
      registrarEvento(f.id, 'nota_credito', `Anulada con la nota de crédito ${formatoComprobante(c)}`)
    } else {
      actualizarComprobante(f.id, { acreditado: (f.acreditado ?? 0) + importe, anulacionInformada: null })
      registrarEvento(f.id, 'nota_credito', `Nota de crédito parcial ${formatoComprobante(c)} por ${formatoPesos(importe)}`)
    }
  }

  // La sucursal se equivocó de archivo: lo quita mientras Auditoría todavía no lo revisó
  function quitar(tipo: TipoDocumento) {
    const anterior = documentos.find((d) => d.tipo === tipo)
    const nuevos = documentos.map((d): Documento => (d.tipo === tipo ? { tipo, estado: 'faltante' } : d))
    const quedaAlgo = nuevos.some((d) => d.estado !== 'faltante')
    guardarDocumentos(nuevos, quedaAlgo ? {} : { fechaDrive: null })
    registrarEvento(c.id, 'mensaje', `Quitó ${NOMBRE_DOCUMENTO[tipo].toLowerCase()} subida por error${anterior?.archivo ? ` (${anterior.archivo})` : ''}`)
  }

  // ── Auditoría: revisar y tildar ──
  function aprobar(tipos: TipoDocumento[]) {
    const todos = documentos.every((d) => d.estado === 'ok' || tipos.includes(d.tipo))
    guardarDocumentos(
      documentos.map((d): Documento => (tipos.includes(d.tipo) ? { ...d, estado: 'ok', motivo: undefined } : d)),
      // La fecha que va a la columna "Drive" de la planilla: cuando Auditoría aprueba todo
      todos ? { fechaAprobacion: hoy } : {},
    )
    registrarEvento(
      c.id,
      'mensaje',
      todos ? 'Documentación revisada y aprobada: lista para presentar' : `Aprobado: ${tipos.map((t) => NOMBRE_DOCUMENTO[t].toLowerCase()).join(', ')}`,
    )
  }
  function observar(tipo: TipoDocumento) {
    if (!motivo) return
    guardarDocumentos(
      documentos.map((d): Documento => (d.tipo === tipo ? { ...d, estado: 'observado', motivo } : d)),
      { fechaAprobacion: null },
    )
    registrarEvento(c.id, 'rechazo', `Observado: ${NOMBRE_DOCUMENTO[tipo].toLowerCase()} (${motivo.toLowerCase()}). Por favor, volver a subir.`)
    setObservando(null)
  }
  const paraRevisar = documentos.filter((d) => d.estado === 'en_revision').map((d) => d.tipo)

  function presentar() {
    actualizarComprobante(c.id, {
      fechaPresentacion: hoy,
      vencimiento: sumarDias(hoy, aseguradora?.plazoPagoDias ?? 30),
      estado: 'presentada',
    })
    registrarEvento(c.id, 'presentacion', `Presentado a ${aseguradora?.nombre ?? 'la compañía'}`)
  }

  // Rechazo de la compañía después de presentar: vuelve a la sucursal
  function registrarRechazo() {
    if (!docRechazo || !motivo) return
    guardarDocumentos(
      documentos.map((d): Documento => (d.tipo === docRechazo ? { ...d, estado: 'observado', motivo } : d)),
      { estado: 'en_gestion', fechaPresentacion: null, vencimiento: null, fechaAprobacion: null },
    )
    registrarEvento(c.id, 'rechazo', `Rechazo de ${aseguradora?.nombre}: ${NOMBRE_DOCUMENTO[docRechazo].toLowerCase()} (${motivo.toLowerCase()}). ${comentarioRechazo}`.trim())
    setFormulario('ninguno')
    setComentarioRechazo('')
  }

  function registrarReclamo() {
    const nuevo: Reclamo = { fecha: hoy, medio: medioReclamo, autor: usuario, nota: notaReclamo }
    actualizarComprobante(c.id, { reclamos: [...c.reclamos, nuevo] })
    registrarEvento(c.id, 'reclamo', `Reclamo ${c.reclamos.length + 1} a ${aseguradora?.nombre} por ${medioReclamo}${notaReclamo ? `: ${notaReclamo}` : ''}`)
    setFormulario('ninguno')
    setNotaReclamo('')
  }

  function enviarMensaje() {
    if (!mensaje.trim()) return
    registrarEvento(c.id, 'mensaje', mensaje.trim())
    setMensaje('')
  }

  const recorrido = [
    { etiqueta: 'Factura', fecha: c.fecha, desde: null },
    { etiqueta: 'Subida de la documentación', fecha: c.fechaDrive, desde: c.fecha },
    { etiqueta: 'Documentación aprobada', fecha: c.fechaAprobacion ?? null, desde: c.fecha },
    { etiqueta: 'Presentación', fecha: c.fechaPresentacion, desde: c.fecha },
    { etiqueta: 'Vencimiento', fecha: c.vencimiento, desde: null },
    { etiqueta: 'Cobro', fecha: c.fechaCobro, desde: c.fecha },
  ]
  const abierta = c.tipo === 'FC' && c.estado !== 'anulada' && c.estado !== 'cobrada'

  return (
    <>
      <div className="fixed inset-0 z-40 bg-noche/40" onClick={onCerrar} aria-hidden="true" />
      <aside className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl" aria-label="Detalle del legajo">
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">Legajo · {c.sucursal}</div>
            <h2 className="mt-1 text-lg font-extrabold">{formatoComprobante(c)}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <BadgeEtapa etapa={semaforo.etapa} />
              {semaforo.responsable && (
                <span className="text-xs text-slate-500">
                  Le toca a: <strong className="text-noche">{quienEtapa(semaforo.etapa)}</strong>
                </span>
              )}
            </div>
            <p className="mt-1 text-xs text-slate-500">{AYUDA_ETAPA[semaforo.etapa]}</p>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        {rol === 'auditoria' && paraRevisarDespues.length > 0 && (
          <div className="flex items-center justify-between gap-3 border-b border-sky-200 bg-sky-50 px-5 py-2 text-xs text-sky-900">
            <span>
              {semaforo.etapa === 'en_revision' ? 'Cuando termines con esta, ' : ''}
              {paraRevisarDespues.length === 1 ? 'queda 1 factura' : `quedan ${paraRevisarDespues.length} facturas`} para revisar
            </span>
            <button
              type="button"
              onClick={() => abrirLegajo(paraRevisarDespues[0].id)}
              className="inline-flex items-center gap-1 rounded-lg bg-sky-600 px-3 py-1.5 font-semibold text-white hover:bg-sky-700"
            >
              Siguiente: {formatoComprobante(paraRevisarDespues[0])} →
            </button>
          </div>
        )}

        <div className="space-y-6 p-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Dato titulo="Compañía" valor={`${aseguradora?.nombre ?? ''} · paga a ${aseguradora?.plazoPagoDias ?? 30} días`} />
            <Dato
              titulo="Total"
              valor={
                c.acreditado
                  ? `${formatoPesos(c.total)} · NC −${formatoPesos(c.acreditado)} · saldo ${formatoPesos(saldoSinCobro(c))}`
                  : c.estado === 'cobrada' && c.importeCobrado != null && Math.abs(c.importeCobrado - c.total) > 0.5
                    ? `${formatoPesos(c.total)} · cobrado ${formatoPesos(importeCobrado(c))}`
                    : formatoPesos(c.total)
              }
            />
            <Dato titulo="Siniestro / patente" valor={[c.siniestro || (c.tipo === 'FC' ? 'se informa con la orden' : ''), c.patente].filter(Boolean).join(' · ')} />
            <Dato titulo="Factura emitida" valor={`${formatoFecha(c.fecha)} · hace ${diffDias(c.fecha, hoy)} ${diffDias(c.fecha, hoy) === 1 ? 'día' : 'días'}`} />
          </dl>

          {/* Qué pasa con la factura */}
          <section className="rounded-lg bg-fondo p-3">
            <ul className="space-y-1">
              {semaforo.detalle.map((d) => (
                <li key={d} className="flex items-start gap-2">
                  {semaforo.color === 'rojo' ? (
                    <CircleAlert className="mt-0.5 h-4 w-4 shrink-0 text-sem-rojo" />
                  ) : (
                    <CircleCheck className="mt-0.5 h-4 w-4 shrink-0 text-slate-400" />
                  )}
                  {d}
                </li>
              ))}
            </ul>
            {c.compromiso && leTocaALaSucursal && (
              <div
                className={`mt-3 flex items-start gap-2 rounded-md p-2 ${compromisoVencido(c, hoy) ? 'bg-sem-rojo/10 text-red-800' : 'bg-white text-slate-700'}`}
              >
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Compromiso de la sucursal: <strong>{formatoFecha(c.compromiso.fecha)}</strong> · {c.compromiso.motivo}
                  {compromisoVencido(c, hoy) && <strong> (vencido)</strong>}
                </span>
              </div>
            )}
          </section>

          {otraPersona && (
            <p className="rounded-lg border border-sky-200 bg-sky-50 px-3 py-2 text-sm text-sky-900">
              <strong>{otraPersona}</strong> tiene abierta esta factura en este momento. Conviene coordinar antes de cambiar algo.
            </p>
          )}

          <PedidosLegajo c={c} />

          {/* Documentación: tres cosas para tildar */}
          {c.tipo === 'FC' && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <div>
                  <h3 className="font-bold">Documentación</h3>
                  {rol === 'sucursal' && abierta && (
                    <p className="text-[11px] text-slate-500">
                      PDF con el número de factura y el siniestro:{' '}
                      <code className="rounded bg-fondo px-1">{numeroParaNombre(c)} siniestro {c.siniestro || '22365'}.pdf</code>
                    </p>
                  )}
                  {rol === 'sucursal' && abierta && !c.siniestro && (
                    <label className="mt-2 block text-[11px] font-semibold text-slate-600">
                      Número de siniestro (figura en la orden; se pide al subirla)
                      <input
                        value={siniestroNuevo}
                        onChange={(e) => setSiniestroNuevo(e.target.value)}
                        placeholder="Por ejemplo 029-9-506622"
                        className={`${claseSelect} mt-1 w-full font-normal`}
                      />
                    </label>
                  )}
                </div>
                {rol === 'auditoria' && paraRevisar.length > 0 && (
                  <button type="button" onClick={() => aprobar(paraRevisar)} className={`${botonChico} bg-esmeralda text-white hover:bg-teal-600`}>
                    <Check className="h-3.5 w-3.5" /> Aprobar todo
                  </button>
                )}
              </div>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {documentos.map((d) => (
                  <li key={d.tipo} className="px-3 py-2.5">
                    <div className="flex items-center justify-between gap-3">
                      <div className="flex min-w-0 items-center gap-2">
                        <span
                          className={`flex h-5 w-5 shrink-0 items-center justify-center rounded border ${
                            d.estado === 'ok' ? 'border-esmeralda bg-esmeralda text-white' : 'border-slate-300'
                          }`}
                          aria-label={d.estado === 'ok' ? 'Aprobado' : 'Sin aprobar'}
                        >
                          {d.estado === 'ok' && <Check className="h-3.5 w-3.5" />}
                        </span>
                        <div className="min-w-0">
                          <div className="font-medium">{NOMBRE_DOCUMENTO[d.tipo]}</div>
                          {d.adjuntos && d.adjuntos.length > 1 ? (
                              <div className="flex flex-wrap gap-x-2 text-xs">
                                {d.adjuntos.map((a, i) =>
                                  a.url ? (
                                    <a key={i} href={a.url} target="_blank" rel="noreferrer" className="text-marca hover:underline">
                                      Página {i + 1}
                                    </a>
                                  ) : (
                                    <span key={i} className="text-slate-500">{a.archivo}</span>
                                  ),
                                )}
                              </div>
                            ) : d.archivo &&
                            (d.url ? (
                              <a href={d.url} target="_blank" rel="noreferrer" className="block truncate text-xs text-marca hover:underline">
                                {d.archivo}
                              </a>
                            ) : (
                              <div className="truncate text-xs text-slate-500">{d.archivo}</div>
                            ))}
                          {d.subidoPor && d.estado !== 'faltante' && (
                            <div className="text-[11px] text-slate-500">
                              Subido por {d.subidoPor}
                              {d.fecha ? ` el ${formatoFecha(d.fecha)}` : ''}
                              {d.origen === 'varios' && ' · carga de varios archivos'}
                              {d.origen === 'varios-automatico' && (
                                <span className="font-semibold text-amber-800"> · asignado por el número del nombre del archivo: conviene revisar que corresponda</span>
                              )}
                            </div>
                          )}
                          {d.estado === 'observado' && d.motivo && <div className="text-xs font-semibold text-red-700">{d.motivo}</div>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {rol === 'sucursal' && abierta && (d.estado === 'faltante' || d.estado === 'observado') ? (
                          <>
                          <label className={`${botonChico} cursor-pointer bg-marca text-white hover:bg-marca-oscuro`}>
                            <FileUp className="h-3.5 w-3.5" />
                            {d.estado === 'faltante' ? 'Subir' : 'Reemplazar'}
                            <input type="file" multiple accept=".pdf,application/pdf" className="sr-only" onChange={(e) => void subir([d.tipo], e.target.files)} />
                          </label>
                          <button type="button" onClick={() => setFoto(d.tipo)} className={`${botonChico} border border-marca/40 bg-white text-marca hover:bg-marca/5`} title="Sacar fotos con la cámara y subirlas como PDF">
                            <Camera className="h-3.5 w-3.5" /> Foto
                          </button>
                          </>
                        ) : rol === 'sucursal' && abierta && d.estado === 'en_revision' ? (
                          <>
                            <span className={`text-xs font-semibold ${ESTILO_DOC[d.estado]}`}>{NOMBRE_ESTADO_DOCUMENTO[d.estado]}</span>
                            <button
                              type="button"
                              onClick={() => quitar(d.tipo)}
                              className={`${botonChico} border border-slate-200 bg-white text-slate-700 hover:border-sem-rojo hover:text-sem-rojo`}
                              title="Para cambiar un archivo equivocado: quitarlo y subir el correcto. Se puede mientras Auditoría no lo revisó."
                            >
                              Quitar
                            </button>
                          </>
                        ) : rol === 'auditoria' && d.estado === 'en_revision' ? (
                          <>
                            <button type="button" onClick={() => aprobar([d.tipo])} className={`${botonChico} bg-esmeralda/15 text-teal-800 hover:bg-esmeralda/25`}>
                              <Check className="h-3.5 w-3.5" /> Aprobar
                            </button>
                            <button type="button" onClick={() => {
                              setMotivo('')
                              setObservando(d.tipo)
                            }} className={`${botonChico} bg-sem-rojo/10 text-red-800 hover:bg-sem-rojo/20`}>
                              Observar
                            </button>
                          </>
                        ) : (
                          <span className={`text-xs font-semibold ${ESTILO_DOC[d.estado]}`}>{NOMBRE_ESTADO_DOCUMENTO[d.estado]}</span>
                        )}
                      </div>
                    </div>
                    {observando === d.tipo && (
                      <div className="mt-2 flex gap-2">
                        <select className={`${claseSelect} flex-1`} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                          <option value="" disabled>Seleccionar el motivo</option>
                          {MOTIVOS_OBSERVACION.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => observar(d.tipo)} disabled={!motivo} className={`${botonChico} bg-sem-rojo text-white disabled:opacity-50`}>
                          Devolver a la sucursal
                        </button>
                      </div>
                    )}
                  </li>
                ))}
              </ul>
              {rol === 'sucursal' && abierta && pendientesDeSubir.length > 1 && (
                <label className="mt-2 flex cursor-pointer items-center justify-center gap-2 rounded-lg border border-dashed border-marca/50 px-4 py-2.5 text-sm font-semibold text-marca hover:bg-marca/5">
                  <FileUp className="h-4 w-4" /> Subir un PDF con todo lo que falta
                  <input type="file" multiple accept=".pdf,application/pdf" className="sr-only" onChange={(e) => void subir(pendientesDeSubir, e.target.files)} />
                </label>
              )}
              {c.subidoPor && (
                <p className="mt-2 text-xs text-slate-500">
                  Subido por {c.subidoPor} el {formatoFecha(c.fechaDrive)}
                </p>
              )}
              {rol === 'sucursal' && leTocaALaSucursal && (
                <>
                <p className="mt-1 text-xs text-slate-500">
                  {subiendo
                    ? 'Subiendo el archivo…'
                    : 'Solo PDF, con el número de la factura en el nombre. Desde el celular, el botón Foto saca la foto y la sube como PDF.'}
                </p>
                {errorSubida && <p className="mt-1 text-xs font-semibold text-sem-rojo">{errorSubida}</p>}
                </>
              )}
            </section>
          )}

          {/* Acciones de la sucursal */}
          {rol === 'sucursal' && leTocaALaSucursal && (
            <section>
              {formulario !== 'demora' ? (
                <button
                  type="button"
                  onClick={() => setFormulario('demora')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-fondo"
                >
                  <CalendarClock className="h-4 w-4" /> Avisar fecha estimada de entrega
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <label className="block text-xs font-semibold text-slate-500">
                    Motivo
                    <select className={`${claseSelect} mt-1 w-full`} value={motivoDemora} onChange={(e) => setMotivoDemora(e.target.value)}>
                      <option value="" disabled>Seleccionar el motivo</option>
                      {MOTIVOS_DEMORA.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-500">
                    Fecha estimada de entrega de la documentación
                    <input type="date" min={hoy} value={fechaDemora} onChange={(e) => setFechaDemora(e.target.value)} className={`${claseSelect} mt-1 w-full`} />
                  </label>
                  <button type="button" onClick={avisarDemora} disabled={!motivoDemora} className={`${botonPrincipal} bg-marca hover:bg-marca-oscuro disabled:opacity-50`}>
                    Avisar a Auditoría
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Otras facturas del mismo siniestro */}
          {hermanas.length > 0 && (
            <section>
              <h3 className="mb-2 font-bold">Otras facturas del mismo siniestro ({hermanas.length})</h3>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {hermanas.map((h) => (
                  <li key={h.id}>
                    <button type="button" onClick={() => abrirLegajo(h.id)} className="flex w-full items-center justify-between gap-2 px-3 py-2 text-left hover:bg-fondo">
                      <span>
                        <span className="font-medium">{formatoComprobante(h)}</span>
                        <span className="ml-2 text-xs text-slate-500">{formatoFecha(h.fecha)} · {formatoPesos(h.total)}</span>
                      </span>
                      <BadgeEtapa etapa={calcularSemaforo(h, hoy).etapa} />
                    </button>
                  </li>
                ))}
              </ul>
              {rol === 'sucursal' && (
                <label className="mt-2 flex items-center gap-2 text-xs text-slate-600">
                  <input type="checkbox" checked={compartirConHermanas} onChange={(e) => setCompartirConHermanas(e.target.checked)} />
                  Al subir la orden firmada, usarla también para estas facturas (si les falta)
                </label>
              )}
            </section>
          )}

          {/* Nota de crédito: con qué factura se vincula */}
          {c.tipo === 'NC' &&
            (() => {
              // Qué hace esta nota de crédito, en palabras, para cualquiera que la abra
              const f = c.ncReferencia ? datos?.comprobantes.find((x) => x.id === c.ncReferencia) : undefined
              const vinculada = !!(f && c.ncInformada !== false)
              const total = vinculada && f!.estado === 'anulada'
              const aviso = f?.eventos.filter((e) => e.tipo === 'nota_credito' && e.area === 'sucursal').at(-1)
              return (
                <section className="rounded-lg border border-red-200 bg-red-50/60 p-3">
                  <h3 className="font-bold text-red-900">Nota de crédito por {formatoPesos(Math.abs(c.total))}</h3>
                  {vinculada ? (
                    <p className="mt-1 text-slate-700">
                      {total ? 'Anula completa la factura ' : 'Acredita una parte de la factura '}
                      <button type="button" onClick={() => abrirLegajo(f!.id)} className="font-semibold text-marca hover:underline">
                        {formatoComprobante(f!)}
                      </button>{' '}
                      ({formatoPesos(f!.total)}{f!.siniestro ? ` · siniestro ${f!.siniestro}` : ''}).
                      {!total && ` A esa factura le queda un saldo de ${formatoPesos(saldoSinCobro(f!))}.`}
                      {total && ' Esa factura ya no se presenta ni se cobra.'}
                    </p>
                  ) : (
                    <p className="mt-1 text-slate-600">
                      Todavía no está vinculada con una factura{f ? ` (posible: ${formatoComprobante(f)})` : ''}. Auditoría la revisa y la vincula.
                    </p>
                  )}
                  {aviso && <p className="mt-1 text-xs text-slate-600">Motivo que informó la sucursal: {aviso.texto}</p>}
                </section>
              )
            })()}

          {c.tipo === 'NC' && rol === 'auditoria' && (
            <section className="space-y-2 rounded-lg border border-slate-200 p-3">
              <h3 className="font-bold">Factura que acredita</h3>
              {c.ncInformada && c.ncReferencia ? (
                <p className="text-slate-600">
                  Vinculada con {(() => { const f = datos?.comprobantes.find((x) => x.id === c.ncReferencia); return f ? formatoComprobante(f) : 'una factura' })()}.
                </p>
              ) : facturasParaNc.length === 0 ? (
                <p className="text-slate-500">No hay facturas abiertas de esta sucursal y compañía con saldo suficiente.</p>
              ) : (
                <>
                  {c.ncReferencia && <p className="text-xs text-slate-500">Se encontró una factura que coincide, pero la sucursal no avisó la nota de crédito. Falta revisarla y confirmarla.</p>}
                  <select className={`${claseSelect} w-full`} value={facturaNcElegida?.id ?? ''} onChange={(e) => setFacturaNc(e.target.value)}>
                    <option value="" disabled>Seleccionar la factura</option>
                    {facturasParaNc.map((f) => (
                      <option key={f.id} value={f.id}>
                        {formatoComprobante(f)} · {formatoFecha(f.fecha)} · saldo {formatoPesos(saldoSinCobro(f))}
                      </option>
                    ))}
                  </select>
                  <div className="grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => vincularNc('total')}
                      disabled={!facturaNcElegida}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${facturaNcElegida && esNotaTotal(Math.abs(c.total), facturaNcElegida) ? 'bg-noche text-white' : 'border border-slate-300'}`}
                    >
                      Anula la factura
                    </button>
                    <button
                      type="button"
                      onClick={() => vincularNc('parcial')}
                      disabled={!facturaNcElegida}
                      className={`rounded-lg px-3 py-2 text-xs font-semibold ${facturaNcElegida && !esNotaTotal(Math.abs(c.total), facturaNcElegida) ? 'bg-noche text-white' : 'border border-slate-300'}`}
                    >
                      Es parcial: restar del saldo
                    </button>
                  </div>
                  <p className="text-xs text-slate-500">Las percepciones no se acreditan: una nota de crédito total puede ser algo menor que la factura.</p>
                </>
              )}
            </section>
          )}

          {/* Anulación informada por la sucursal */}
          {c.anulacionInformada && c.estado !== 'anulada' && (
            <section className="rounded-lg border border-slate-300 bg-slate-50 p-3 text-sm">
              <p className="font-semibold text-noche">
                {c.anulacionInformada.parcial
                  ? `La sucursal informó una nota de crédito parcial por ${formatoPesos(c.anulacionInformada.importe ?? 0)}`
                  : 'La sucursal informó que esta factura se anula con nota de crédito'}
              </p>
              <p className="mt-0.5 text-slate-600">
                {formatoFecha(c.anulacionInformada.fecha)} · {c.anulacionInformada.motivo}
              </p>
              {rol === 'auditoria' && !c.anulacionInformada.parcial && (
                <div className="mt-2 flex gap-2">
                  <button type="button" onClick={confirmarAnulacion} className="rounded-lg bg-noche px-3 py-1.5 text-xs font-semibold text-white hover:bg-noche-claro">
                    Confirmar anulación
                  </button>
                  <button type="button" onClick={rechazarAnulacion} className="rounded-lg border border-slate-300 px-3 py-1.5 text-xs font-semibold hover:bg-white">
                    No corresponde
                  </button>
                </div>
              )}
              {rol === 'auditoria' && c.anulacionInformada.parcial && (
                <p className="mt-1 text-xs text-slate-500">Se descuenta del saldo cuando llega la nota de crédito del ERP (o al vincularla desde la NC).</p>
              )}
              {rol === 'sucursal' && <p className="mt-1 text-xs text-slate-500">Se aplica cuando llega la nota de crédito del ERP.</p>}
            </section>
          )}

          {/* Acciones de Auditoría */}
          {rol === 'auditoria' && abierta && (
            <section className="space-y-3">
              {c.fechaPresentacion === null && (
                <button type="button" onClick={presentar} disabled={!puedePresentarse(c, hoy)} className={`${botonPrincipal} bg-esmeralda hover:bg-teal-600`}>
                  <Send className="h-4 w-4" /> Marcar como presentada
                </button>
              )}
              {c.fechaPresentacion === null && !puedePresentarse(c, hoy) && (
                <p className="text-center text-xs text-slate-500">Se puede presentar cuando la factura y la orden firmada están aprobadas.</p>
              )}
              {c.fechaPresentacion !== null &&
                (formulario !== 'rechazo' ? (
                  <button
                    type="button"
                    onClick={() => setFormulario('rechazo')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-sem-rojo/40 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-sem-rojo/5"
                  >
                    <TriangleAlert className="h-4 w-4" /> La compañía la rechazó
                  </button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-sem-rojo/30 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-500">
                        Documento
                        <select className={`${claseSelect} mt-1 w-full`} value={docRechazo} onChange={(e) => setDocRechazo(e.target.value as TipoDocumento)}>
                          <option value="" disabled>Seleccionar el documento</option>
                          {documentos.map((d) => (
                            <option key={d.tipo} value={d.tipo}>
                              {NOMBRE_DOCUMENTO[d.tipo]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-500">
                        Motivo
                        <select className={`${claseSelect} mt-1 w-full`} value={motivo} onChange={(e) => setMotivo(e.target.value)}>
                          <option value="" disabled>Seleccionar el motivo</option>
                          {MOTIVOS_OBSERVACION.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                      </label>
                    </div>
                    <textarea
                      value={comentarioRechazo}
                      onChange={(e) => setComentarioRechazo(e.target.value)}
                      rows={2}
                      placeholder="Qué pidió la compañía (refacturar, NC, aclarar la orden…)"
                      className={`${claseSelect} w-full`}
                    />
                    <button type="button" onClick={registrarRechazo} disabled={!docRechazo || !motivo} className={`${botonPrincipal} bg-sem-rojo hover:bg-red-600 disabled:opacity-50`}>
                      Devolver a la sucursal
                    </button>
                  </div>
                ))}
              {c.fechaPresentacion !== null &&
                (formulario !== 'cobro' ? (
                  <button type="button" onClick={() => setFormulario('cobro')} className={`${botonPrincipal} bg-esmeralda hover:bg-teal-600`}>
                    <CircleCheck className="h-4 w-4" /> Registrar cobro
                  </button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-esmeralda/40 p-3">
                    <label className="block text-xs font-semibold text-slate-500">
                      Importe cobrado
                      <input
                        inputMode="decimal"
                        value={importeCobroTexto}
                        onChange={(e) => setImporteCobroTexto(e.target.value)}
                        className={`${claseSelect} mt-1 w-full`}
                      />
                      <span className="mt-1 block font-normal">Se propone el saldo. Cambialo si la compañía pagó otro importe.</span>
                    </label>
                    <label className="block text-xs font-semibold text-slate-500">
                      Fecha en que se cobró
                      <input
                        type="date"
                        max={hoy}
                        value={fechaCobro}
                        onChange={(e) => setFechaCobro(e.target.value)}
                        className={`${claseSelect} mt-1 w-full`}
                      />
                    </label>
                    <button type="button" onClick={registrarCobro} className={`${botonPrincipal} bg-esmeralda hover:bg-teal-600`}>
                      Confirmar cobro
                    </button>
                  </div>
                ))}
            </section>
          )}

          {/* Reclamos a la compañía */}
          {c.fechaPresentacion !== null && c.estado === 'presentada' && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-bold">Reclamos a la compañía</h3>
                {reclamo && (
                  <span
                    className={`rounded-md px-2 py-0.5 text-xs font-semibold ${
                      reclamo === 'sin_reclamar' || reclamo === 'volver'
                        ? 'bg-red-800/10 text-red-900'
                        : reclamo === 'escalar'
                          ? 'bg-sem-amarillo/20 text-amber-900'
                          : 'bg-slate-100 text-slate-700'
                    }`}
                  >
                    {NOMBRE_ESTADO_RECLAMO[reclamo]}
                  </span>
                )}
              </div>
              {c.reclamos.length === 0 ? (
                <p className="text-slate-500">{reclamo ? 'Todavía no se reclamó.' : 'No vence todavía.'}</p>
              ) : (
                <ol className="space-y-1">
                  {c.reclamos.map((r, i) => (
                    <li key={i}>
                      <div className="flex justify-between gap-2">
                        <span>
                          {i + 1}. {formatoFecha(r.fecha || null)} por {r.medio} · {r.autor}
                        </span>
                        <span className="truncate text-xs text-slate-500">{r.nota}</span>
                      </div>
                      {r.respuesta && (
                        <p className="ml-4 text-xs font-semibold text-blue-800">
                          Respuesta ({formatoFecha(r.respuesta.fecha)}): {NOMBRE_RESPUESTA[r.respuesta.tipo].toLowerCase()}
                          {r.respuesta.nota ? ` · ${r.respuesta.nota}` : ''}
                        </p>
                      )}
                    </li>
                  ))}
                </ol>
              )}
              {reclamo === 'reclamada' && finDeEspera(c) && (
                <p className="mt-2 rounded-md bg-fondo p-2 text-xs text-slate-600">
                  Se espera la respuesta de la compañía hasta el {formatoFecha(finDeEspera(c))}. Si no responde, hay que volver a reclamar.
                </p>
              )}
              {reclamo === 'volver' && (
                <p className="mt-2 rounded-md bg-sem-rojo/10 p-2 text-xs text-red-900">
                  Pasó la semana sin respuesta de la compañía: hay que volver a reclamar.
                </p>
              )}
              {reclamo === 'con_error' && (
                <div className="mt-2 rounded-md bg-red-50 p-2 text-xs text-red-900">
                  <p>
                    La compañía informó un error
                    {(() => {
                      const r = [...c.reclamos].reverse().find((x) => x.respuesta?.tipo === 'error')
                      return r?.respuesta?.nota ? `: ${r.respuesta.nota}` : ''
                    })()}
                    . Corregirlo antes de volver a reclamar el pago.
                  </p>
                  {rol === 'auditoria' && (
                    <button
                      type="button"
                      onClick={() => {
                        const r = cambiosPorErrorCorregido(c, '', hoy)
                        if (!r) return
                        actualizarComprobante(c.id, r.campos)
                        registrarEvento(c.id, 'reclamo', r.evento)
                      }}
                      className="mt-2 rounded-md bg-white px-2.5 py-1 font-semibold text-red-900 ring-1 ring-red-200 hover:bg-red-100"
                    >
                      Marcar el error como corregido
                    </button>
                  )}
                </div>
              )}
              {reclamo === 'escalar' && (
                <p className="mt-2 rounded-md bg-sem-amarillo/15 p-2 text-xs text-amber-900">
                  La compañía no respondió a 3 reclamos: Auditoría le pide apoyo a gerencia para que intervenga.
                </p>
              )}
              {rol === 'auditoria' && c.reclamos.length > 0 && !c.reclamos[c.reclamos.length - 1].respuesta && (
                <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
                  <div className="text-xs font-semibold text-slate-500">Respuesta de la compañía al último reclamo</div>
                  <select className={`${claseSelect} w-full`} value={respuestaReclamo} onChange={(e) => setRespuestaReclamo(e.target.value as RespuestaReclamo)}>
                    <option value="" disabled>Seleccionar la respuesta</option>
                    {(Object.keys(NOMBRE_RESPUESTA) as RespuestaReclamo[]).map((k) => (
                      <option key={k} value={k}>
                        {NOMBRE_RESPUESTA[k]}
                      </option>
                    ))}
                  </select>
                  <input value={notaRespuesta} onChange={(e) => setNotaRespuesta(e.target.value)} placeholder={respuestaReclamo === 'error' ? 'Qué error informó (obligatorio)' : 'Detalle (opcional): qué documento, qué monto…'} className={`${claseSelect} w-full`} />
                  <p className="text-[11px] text-slate-500">
                    {!respuestaReclamo
                      ? 'Elegir qué respondió la compañía.'
                      : respuestaReclamo === 'error'
                      ? 'Queda "Con error a corregir" hasta marcarlo corregido; después se vuelve a reclamar el pago. Detallar el error en el campo de arriba.'
                      : respuestaReclamo === 'pagos'
                      ? 'Se espera el cobro un mes antes de volver a reclamar.'
                      : respuestaReclamo === 'documentacion'
                        ? 'La factura vuelve a la lista de Presentar para reenviarla.'
                        : 'Se le pide a la sucursal que refacture; queda en Pedidos a sucursales.'}
                  </p>
                  <button type="button" onClick={registrarRespuesta} disabled={!respuestaReclamo || (respuestaReclamo === 'error' && !notaRespuesta.trim())} className={`${botonPrincipal} bg-marca hover:bg-marca-oscuro disabled:opacity-50`}>
                    Guardar la respuesta
                  </button>
                </div>
              )}
              {rol === 'auditoria' &&
                (formulario !== 'reclamo' ? (
                  <button
                    type="button"
                    onClick={() => setFormulario('reclamo')}
                    className="mt-3 flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-fondo"
                  >
                    <Megaphone className="h-4 w-4" /> Registrar reclamo
                  </button>
                ) : (
                  <div className="mt-3 space-y-2 rounded-lg border border-slate-200 p-3">
                    <select className={`${claseSelect} w-full`} value={medioReclamo} onChange={(e) => setMedioReclamo(e.target.value as Reclamo['medio'])}>
                      <option value="mail">Por mail</option>
                      <option value="portal">Por el portal de la compañía</option>
                      <option value="telefono">Por teléfono</option>
                    </select>
                    <input
                      value={notaReclamo}
                      onChange={(e) => setNotaReclamo(e.target.value)}
                      placeholder="Nota (opcional): a quién, qué respondieron…"
                      className={`${claseSelect} w-full`}
                    />
                    <button type="button" onClick={registrarReclamo} className={`${botonPrincipal} bg-marca hover:bg-marca-oscuro`}>
                      Guardar reclamo
                    </button>
                  </div>
                ))}
            </section>
          )}

          {/* Conversación: reemplaza los mails sueltos */}
          <section>
            <h3 className="mb-2 font-bold">Conversación</h3>
            {c.eventos.length === 0 ? (
              <p className="text-slate-500">Sin movimientos todavía.</p>
            ) : (
              <ol className="space-y-3">
                {c.eventos.map((e, i) => (
                  <li key={i} className="flex gap-3">
                    <div className="mt-0.5 text-slate-500">{ICONO_EVENTO[e.tipo]}</div>
                    <div className="min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2 text-xs">
                        <span className={`rounded px-1.5 py-0.5 font-semibold ${COLOR_AREA[e.area]}`}>{e.autor}</span>
                        <span className="text-slate-400">{formatoFecha(e.fecha)}</span>
                      </div>
                      <p className="mt-1 text-slate-700">{e.texto}</p>
                    </div>
                  </li>
                ))}
              </ol>
            )}
            <div className="mt-3 flex gap-2">
              <input
                value={mensaje}
                onChange={(e) => setMensaje(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && enviarMensaje()}
                placeholder={rol === 'sucursal' ? 'Mensaje para Auditoría…' : 'Mensaje para la sucursal…'}
                className={`${claseSelect} flex-1`}
              />
              <button type="button" onClick={enviarMensaje} className="rounded-lg bg-noche px-3 text-white hover:bg-noche-claro" aria-label="Enviar mensaje">
                <Send className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Recorrido de fechas, como las columnas de la planilla */}
          <section>
            <h3 className="mb-2 font-bold">Recorrido</h3>
            <ol className="space-y-2">
              {recorrido.map((p) => (
                <li key={p.etiqueta} className="flex justify-between">
                  <span className={p.fecha ? '' : 'text-slate-400'}>{p.etiqueta}</span>
                  <span className="font-medium">
                    {formatoFecha(p.fecha)}
                    {p.fecha && p.desde && <span className="ml-1 text-xs text-slate-500">({diffDias(p.desde, p.fecha)} días)</span>}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {/* Observaciones: como la columna de la planilla; Auditoría las edita */}
          {rol === 'auditoria' ? (
            <section>
              <h3 className="mb-1 font-bold">Observaciones</h3>
              <textarea
                value={observaciones}
                onChange={(e) => setObservaciones(e.target.value)}
                rows={2}
                placeholder="Nota interna de Auditoría sobre esta factura"
                className={`${claseSelect} w-full`}
              />
              {observaciones !== c.observaciones && (
                <button
                  type="button"
                  onClick={() => actualizarComprobante(c.id, { observaciones })}
                  className="mt-2 rounded-lg bg-marca px-3 py-1.5 text-xs font-semibold text-white hover:bg-marca-oscuro"
                >
                  Guardar observación
                </button>
              )}
            </section>
          ) : (
            c.observaciones && (
              <section>
                <h3 className="mb-1 font-bold">Observaciones</h3>
                <p className="text-slate-600">{c.observaciones}</p>
              </section>
            )
          )}
        </div>
      </aside>
      {foto && (
        <SacarFoto
          titulo={`${NOMBRE_DOCUMENTO[foto]} · ${formatoComprobante(c)}`}
          nombreArchivo={`${numeroParaNombre(c)} ${NOMBRE_DOCUMENTO[foto].toLowerCase()}.pdf`}
          onCerrar={() => setFoto(null)}
          onListo={(pdf) => {
            const tipo = foto
            setFoto(null)
            void subir([tipo], [pdf])
          }}
        />
      )}
    </>
  )
}

function Dato({ titulo, valor }: { titulo: string; valor: string }) {
  return (
    <div>
      <dt className="text-xs text-slate-500">{titulo}</dt>
      <dd className="font-semibold">{valor}</dd>
    </div>
  )
}
