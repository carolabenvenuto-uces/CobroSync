import { useState, type ReactNode } from 'react'
import {
  Bell,
  CalendarClock,
  CircleAlert,
  CircleCheck,
  FileUp,
  MessageSquare,
  Paperclip,
  Send,
  TriangleAlert,
  Undo2,
  X,
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import {
  calcularSemaforo,
  documentosDelLegajo,
  NOMBRE_DOCUMENTO,
  NOMBRE_ESTADO_DOCUMENTO,
  puedePresentarse,
} from '../domain/semaforo'
import { compromisoVencido } from '../domain/sucursales'
import type { AreaEvento, Comprobante, Documento, EstadoDocumento, Evento, TipoDocumento } from '../domain/tipos'
import { diffDias, sumarDias } from '../lib/fechas'
import { formatoComprobante, formatoFecha, formatoPesos } from '../lib/formato'
import { BadgeEtapa, quienEtapa } from './ui/Badges'
import { claseSelect } from './ui/Estados'

export const MOTIVOS_DEMORA = [
  'El vehículo sigue en el taller',
  'Se facturó por adelantado: falta la firma del cliente',
  'Esperando el remito del proveedor de repuestos',
  'El cliente retira el auto la semana próxima',
  'Otro motivo',
]

const COLOR_AREA: Record<AreaEvento, string> = {
  sucursal: 'bg-sem-amarillo/15 text-amber-900',
  auditoria: 'bg-marca/10 text-blue-800',
  gerencia: 'bg-etapa-compania/10 text-violet-800',
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
}

const botonPrincipal =
  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500'

/**
 * Panel lateral con el legajo de una factura: documentos, conversación y acciones según el rol.
 * En la demo los cambios se guardan solo en memoria (se pierden al recargar).
 */
export function LegajoPanel({ comprobante: c, onCerrar }: { comprobante: Comprobante; onCerrar: () => void }) {
  const { datos, rol, usuario, hoy, actualizarComprobante, registrarEvento } = useApp()
  const aseguradora = datos!.aseguradoras.find((a) => a.id === c.aseguradoraId)
  const semaforo = calcularSemaforo(c, hoy)
  const documentos = documentosDelLegajo(c.documentos)
  const leTocaALaSucursal = semaforo.responsable === 'sucursal'

  const [mensaje, setMensaje] = useState('')
  const [formulario, setFormulario] = useState<'ninguno' | 'demora' | 'rechazo'>('ninguno')
  const [motivoDemora, setMotivoDemora] = useState(MOTIVOS_DEMORA[0])
  const [fechaDemora, setFechaDemora] = useState(sumarDias(hoy, 5))
  const [docRechazo, setDocRechazo] = useState<TipoDocumento>('orden_reparacion')
  const [problemaRechazo, setProblemaRechazo] = useState<Exclude<EstadoDocumento, 'ok'>>('sin_firma')
  const [comentarioRechazo, setComentarioRechazo] = useState('')

  function subirArchivo(tipo: TipoDocumento, archivo: File | undefined) {
    if (!archivo) return
    actualizarComprobante(c.id, {
      documentos: documentos.map((d): Documento => (d.tipo === tipo ? { tipo, estado: 'ok', archivo: archivo.name } : d)),
      fechaDrive: c.fechaDrive ?? hoy,
      subidoPor: usuario,
      estado: c.estado === 'pendiente_drive' ? 'en_gestion' : c.estado,
    })
    registrarEvento(c.id, 'subida', `Subió ${NOMBRE_DOCUMENTO[tipo].toLowerCase()} (${archivo.name})`)
  }

  function avisarDemora() {
    const motivo = motivoDemora
    actualizarComprobante(c.id, { compromiso: { fecha: fechaDemora, motivo } })
    registrarEvento(c.id, 'compromiso', `${motivo}. Se compromete a subirlo el ${formatoFecha(fechaDemora)}.`)
    setFormulario('ninguno')
  }

  function presentar() {
    actualizarComprobante(c.id, {
      fechaPresentacion: hoy,
      vencimiento: sumarDias(hoy, aseguradora?.plazoPagoDias ?? 30),
      estado: 'presentada',
    })
    registrarEvento(c.id, 'presentacion', `Presentado a ${aseguradora?.nombre ?? 'la compañía'}`)
  }

  function registrarRechazo() {
    actualizarComprobante(c.id, {
      documentos: documentos.map((d): Documento => (d.tipo === docRechazo ? { ...d, estado: problemaRechazo } : d)),
      estado: 'en_gestion',
      fechaPresentacion: null,
      vencimiento: null,
    })
    registrarEvento(
      c.id,
      'rechazo',
      `${NOMBRE_DOCUMENTO[docRechazo]}: ${NOMBRE_ESTADO_DOCUMENTO[problemaRechazo].toLowerCase()}. ${comentarioRechazo}`.trim(),
    )
    setFormulario('ninguno')
    setComentarioRechazo('')
  }

  function enviarMensaje() {
    if (!mensaje.trim()) return
    registrarEvento(c.id, 'mensaje', mensaje.trim())
    setMensaje('')
  }

  const recorrido = [
    { etiqueta: 'Emisión', fecha: c.fecha, desde: null },
    { etiqueta: 'Subida de documentos', fecha: c.fechaDrive, desde: c.fecha },
    { etiqueta: 'Presentación', fecha: c.fechaPresentacion, desde: c.fecha },
    { etiqueta: 'Vencimiento', fecha: c.vencimiento, desde: null },
    { etiqueta: 'Cobro', fecha: c.fechaCobro, desde: c.fecha },
  ]

  return (
    <>
      <div className="fixed inset-0 z-40 bg-noche/40" onClick={onCerrar} aria-hidden="true" />
      <aside
        className="fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl"
        aria-label="Detalle del legajo"
      >
        {/* Encabezado */}
        <div className="flex items-start justify-between border-b border-slate-200 p-5">
          <div>
            <div className="text-xs font-semibold uppercase tracking-wide text-slate-500">
              Legajo · {c.sucursal}
            </div>
            <h2 className="mt-1 text-lg font-extrabold">{formatoComprobante(c)}</h2>
            <div className="mt-2 flex flex-wrap items-center gap-2">
              <BadgeEtapa etapa={semaforo.etapa} />
              {semaforo.responsable && (
                <span className="text-xs text-slate-500">
                  Le toca a: <strong className="text-noche">{quienEtapa(semaforo.etapa)}</strong>
                </span>
              )}
            </div>
          </div>
          <button type="button" onClick={onCerrar} className="rounded-lg p-1.5 hover:bg-slate-100" aria-label="Cerrar">
            <X className="h-5 w-5" />
          </button>
        </div>

        <div className="space-y-6 p-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Dato titulo="Compañía" valor={aseguradora?.nombre ?? ''} />
            <Dato titulo="Total" valor={formatoPesos(c.total)} />
            <Dato titulo="Siniestro / patente" valor={`${c.siniestro} · ${c.patente}`} />
            <Dato titulo="Emitida" valor={`${formatoFecha(c.fecha)} · hace ${diffDias(c.fecha, hoy)} días`} />
          </dl>

          {/* Qué pasa con el legajo */}
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
                className={`mt-3 flex items-start gap-2 rounded-md p-2 ${
                  compromisoVencido(c, hoy) ? 'bg-sem-rojo/10 text-red-800' : 'bg-white text-slate-700'
                }`}
              >
                <CalendarClock className="mt-0.5 h-4 w-4 shrink-0" />
                <span>
                  Compromiso de la sucursal: <strong>{formatoFecha(c.compromiso.fecha)}</strong> · {c.compromiso.motivo}
                  {compromisoVencido(c, hoy) && <strong> (vencido)</strong>}
                </span>
              </div>
            )}
          </section>

          {/* Documentos */}
          {c.tipo === 'FC' && (
            <section>
              <h3 className="mb-2 font-bold">Documentos del legajo</h3>
              <ul className="divide-y divide-slate-100 rounded-lg border border-slate-200">
                {documentos.map((d) => (
                  <li key={d.tipo} className="flex items-center justify-between gap-3 px-3 py-2.5">
                    <div className="min-w-0">
                      <div className="font-medium">{NOMBRE_DOCUMENTO[d.tipo]}</div>
                      {d.archivo && <div className="truncate text-xs text-slate-500">{d.archivo}</div>}
                    </div>
                    {rol === 'sucursal' && d.estado !== 'ok' && c.estado !== 'anulada' ? (
                      <label className="inline-flex shrink-0 cursor-pointer items-center gap-1.5 rounded-md bg-marca px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-marca-oscuro">
                        <FileUp className="h-3.5 w-3.5" />
                        {d.estado === 'faltante' ? 'Subir' : 'Reemplazar'}
                        <input
                          type="file"
                          accept=".pdf,image/*"
                          className="sr-only"
                          onChange={(e) => subirArchivo(d.tipo, e.target.files?.[0])}
                        />
                      </label>
                    ) : (
                      <span className={`shrink-0 text-xs font-semibold ${d.estado === 'ok' ? 'text-emerald-700' : 'text-red-700'}`}>
                        {NOMBRE_ESTADO_DOCUMENTO[d.estado]}
                      </span>
                    )}
                  </li>
                ))}
              </ul>
              {c.subidoPor && (
                <p className="mt-2 text-xs text-slate-500">
                  Subido por {c.subidoPor} el {formatoFecha(c.fechaDrive)}
                </p>
              )}
              {rol === 'sucursal' && leTocaALaSucursal && (
                <p className="mt-2 text-xs text-slate-500">
                  En la demo el archivo no se sube a ningún lado: solo se registra su nombre.
                </p>
              )}
            </section>
          )}

          {/* Acciones según el rol */}
          {rol === 'sucursal' && leTocaALaSucursal && (
            <section className="space-y-3">
              {formulario !== 'demora' ? (
                <button
                  type="button"
                  onClick={() => setFormulario('demora')}
                  className="flex w-full items-center justify-center gap-2 rounded-lg border border-slate-200 px-4 py-2.5 text-sm font-semibold hover:bg-fondo"
                >
                  <CalendarClock className="h-4 w-4" /> No lo puedo subir todavía
                </button>
              ) : (
                <div className="space-y-3 rounded-lg border border-slate-200 p-3">
                  <label className="block text-xs font-semibold text-slate-500">
                    Motivo
                    <select className={`${claseSelect} mt-1 w-full`} value={motivoDemora} onChange={(e) => setMotivoDemora(e.target.value)}>
                      {MOTIVOS_DEMORA.map((m) => (
                        <option key={m}>{m}</option>
                      ))}
                    </select>
                  </label>
                  <label className="block text-xs font-semibold text-slate-500">
                    ¿Para cuándo lo subís?
                    <input
                      type="date"
                      min={hoy}
                      value={fechaDemora}
                      onChange={(e) => setFechaDemora(e.target.value)}
                      className={`${claseSelect} mt-1 w-full`}
                    />
                  </label>
                  <button type="button" onClick={avisarDemora} className={`${botonPrincipal} bg-marca hover:bg-marca-oscuro`}>
                    Avisar a auditoría
                  </button>
                </div>
              )}
            </section>
          )}

          {rol === 'auditoria' && c.tipo === 'FC' && c.estado !== 'anulada' && c.estado !== 'cobrada' && (
            <section className="space-y-3">
              <button
                type="button"
                onClick={presentar}
                disabled={!puedePresentarse(c, hoy)}
                className={`${botonPrincipal} bg-esmeralda hover:bg-emerald-600`}
              >
                <Send className="h-4 w-4" /> Marcar como presentado
              </button>
              {leTocaALaSucursal && (
                <p className="text-center text-xs text-slate-500">
                  No se puede presentar hasta que la sucursal complete el legajo.
                </p>
              )}
              {!leTocaALaSucursal &&
                (formulario !== 'rechazo' ? (
                  <button
                    type="button"
                    onClick={() => setFormulario('rechazo')}
                    className="flex w-full items-center justify-center gap-2 rounded-lg border border-sem-rojo/40 px-4 py-2.5 text-sm font-semibold text-red-700 hover:bg-sem-rojo/5"
                  >
                    <TriangleAlert className="h-4 w-4" /> Registrar rechazo u observación
                  </button>
                ) : (
                  <div className="space-y-3 rounded-lg border border-sem-rojo/30 p-3">
                    <div className="grid grid-cols-2 gap-2">
                      <label className="block text-xs font-semibold text-slate-500">
                        Documento
                        <select
                          className={`${claseSelect} mt-1 w-full`}
                          value={docRechazo}
                          onChange={(e) => setDocRechazo(e.target.value as TipoDocumento)}
                        >
                          {documentos.map((d) => (
                            <option key={d.tipo} value={d.tipo}>
                              {NOMBRE_DOCUMENTO[d.tipo]}
                            </option>
                          ))}
                        </select>
                      </label>
                      <label className="block text-xs font-semibold text-slate-500">
                        Problema
                        <select
                          className={`${claseSelect} mt-1 w-full`}
                          value={problemaRechazo}
                          onChange={(e) => setProblemaRechazo(e.target.value as Exclude<EstadoDocumento, 'ok'>)}
                        >
                          <option value="sin_firma">Sin firma o sello</option>
                          <option value="ilegible">Ilegible</option>
                          <option value="faltante">Falta</option>
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
                    <button type="button" onClick={registrarRechazo} className={`${botonPrincipal} bg-sem-rojo hover:bg-red-600`}>
                      Devolver a la sucursal
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
                placeholder={rol === 'sucursal' ? 'Escribile a auditoría…' : 'Escribile a la sucursal…'}
                className={`${claseSelect} flex-1`}
              />
              <button
                type="button"
                onClick={enviarMensaje}
                className="rounded-lg bg-noche px-3 text-white hover:bg-noche-claro"
                aria-label="Enviar mensaje"
              >
                <Send className="h-4 w-4" />
              </button>
            </div>
          </section>

          {/* Recorrido de fechas */}
          <section>
            <h3 className="mb-2 font-bold">Recorrido</h3>
            <ol className="space-y-2">
              {recorrido.map((p) => (
                <li key={p.etiqueta} className="flex justify-between">
                  <span className={p.fecha ? '' : 'text-slate-400'}>{p.etiqueta}</span>
                  <span className="font-medium">
                    {formatoFecha(p.fecha)}
                    {p.fecha && p.desde && (
                      <span className="ml-1 text-xs text-slate-500">(+{diffDias(p.desde, p.fecha)} d)</span>
                    )}
                  </span>
                </li>
              ))}
            </ol>
          </section>

          {c.observaciones && (
            <section>
              <h3 className="mb-1 font-bold">Observaciones</h3>
              <p className="text-slate-600">{c.observaciones}</p>
            </section>
          )}
        </div>
      </aside>
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
