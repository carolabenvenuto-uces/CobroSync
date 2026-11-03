import { useState, type ReactNode } from 'react'
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
} from 'lucide-react'
import { useApp } from '../context/AppContext'
import { estadoReclamo, NOMBRE_ESTADO_RECLAMO } from '../domain/reclamos'
import {
  calcularSemaforo,
  documentosDelLegajo,
  MOTIVOS_OBSERVACION,
  NOMBRE_DOCUMENTO,
  NOMBRE_ESTADO_DOCUMENTO,
  puedePresentarse,
} from '../domain/semaforo'
import { compromisoVencido } from '../domain/sucursales'
import type { AreaEvento, Comprobante, Documento, Evento, Reclamo, TipoDocumento } from '../domain/tipos'
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
  reclamo: <Megaphone className="h-4 w-4 text-red-800" />,
}

const ESTILO_DOC: Record<Documento['estado'], string> = {
  faltante: 'text-red-700',
  en_revision: 'text-sky-700',
  ok: 'text-emerald-700',
  observado: 'text-red-700',
}

const botonPrincipal =
  'flex w-full items-center justify-center gap-2 rounded-lg px-4 py-2.5 text-sm font-semibold text-white disabled:cursor-not-allowed disabled:bg-slate-200 disabled:text-slate-500'
const botonChico = 'inline-flex shrink-0 items-center gap-1 rounded-md px-2 py-1 text-xs font-semibold'

/**
 * Panel lateral con el legajo de una factura.
 * - La sucursal sube la factura, la orden y la firma (o un PDF con todo).
 * - Auditoría revisa cada una y la tilda (aprobar) u observa con un motivo.
 * - Cuando las tres están aprobadas, la factura queda para presentar.
 * En la demo los cambios se guardan solo en memoria (se pierden al recargar).
 */
export function LegajoPanel({ comprobante: c, onCerrar }: { comprobante: Comprobante; onCerrar: () => void }) {
  const { datos, rol, usuario, hoy, actualizarComprobante, registrarEvento } = useApp()
  const aseguradora = datos!.aseguradoras.find((a) => a.id === c.aseguradoraId)
  const semaforo = calcularSemaforo(c, hoy)
  const documentos = documentosDelLegajo(c.documentos)
  const leTocaALaSucursal = semaforo.responsable === 'sucursal'
  const reclamo = estadoReclamo(c, hoy)

  const [mensaje, setMensaje] = useState('')
  const [observaciones, setObservaciones] = useState(c.observaciones)
  const [formulario, setFormulario] = useState<'ninguno' | 'demora' | 'rechazo' | 'reclamo'>('ninguno')
  const [observando, setObservando] = useState<TipoDocumento | null>(null)
  const [motivo, setMotivo] = useState<string>(MOTIVOS_OBSERVACION[0])
  const [motivoDemora, setMotivoDemora] = useState(MOTIVOS_DEMORA[0])
  const [fechaDemora, setFechaDemora] = useState(sumarDias(hoy, 5))
  const [docRechazo, setDocRechazo] = useState<TipoDocumento>('orden')
  const [comentarioRechazo, setComentarioRechazo] = useState('')
  const [medioReclamo, setMedioReclamo] = useState<Reclamo['medio']>('mail')
  const [notaReclamo, setNotaReclamo] = useState('')

  function guardarDocumentos(nuevos: Documento[], extra: Partial<Comprobante> = {}) {
    actualizarComprobante(c.id, { documentos: nuevos, ...extra })
  }

  // ── Sucursal ──
  function subir(tipos: TipoDocumento[], archivo: File | undefined) {
    if (!archivo) return
    guardarDocumentos(
      documentos.map((d): Documento => (tipos.includes(d.tipo) ? { tipo: d.tipo, estado: 'en_revision', archivo: archivo.name } : d)),
      { fechaDrive: c.fechaDrive ?? hoy, subidoPor: usuario, estado: c.estado === 'pendiente_drive' ? 'en_gestion' : c.estado },
    )
    const que = tipos.length > 1 ? 'la documentación' : NOMBRE_DOCUMENTO[tipos[0]].toLowerCase()
    registrarEvento(c.id, 'subida', `Subió ${que} (${archivo.name})`)
  }
  const pendientesDeSubir = documentos.filter((d) => d.estado === 'faltante' || d.estado === 'observado').map((d) => d.tipo)

  function avisarDemora() {
    actualizarComprobante(c.id, { compromiso: { fecha: fechaDemora, motivo: motivoDemora } })
    registrarEvento(c.id, 'compromiso', `${motivoDemora}. Se compromete a subirlo el ${formatoFecha(fechaDemora)}.`)
    setFormulario('ninguno')
  }

  // ── Auditoría: revisar y tildar ──
  function aprobar(tipos: TipoDocumento[]) {
    guardarDocumentos(documentos.map((d): Documento => (tipos.includes(d.tipo) ? { tipo: d.tipo, estado: 'ok', archivo: d.archivo } : d)))
    const todos = documentos.every((d) => d.estado === 'ok' || tipos.includes(d.tipo))
    registrarEvento(
      c.id,
      'mensaje',
      todos ? 'Documentación revisada y aprobada: lista para presentar' : `Aprobado: ${tipos.map((t) => NOMBRE_DOCUMENTO[t].toLowerCase()).join(', ')}`,
    )
  }
  function observar(tipo: TipoDocumento) {
    guardarDocumentos(documentos.map((d): Documento => (d.tipo === tipo ? { ...d, estado: 'observado', motivo } : d)))
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
    guardarDocumentos(
      documentos.map((d): Documento => (d.tipo === docRechazo ? { ...d, estado: 'observado', motivo } : d)),
      { estado: 'en_gestion', fechaPresentacion: null, vencimiento: null },
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

        <div className="space-y-6 p-5 text-sm">
          <dl className="grid grid-cols-2 gap-x-4 gap-y-3">
            <Dato titulo="Compañía" valor={`${aseguradora?.nombre ?? ''} · paga a ${aseguradora?.plazoPagoDias ?? 30} días`} />
            <Dato titulo="Total" valor={formatoPesos(c.total)} />
            <Dato titulo="Siniestro / patente" valor={[c.siniestro, c.patente].filter(Boolean).join(' · ')} />
            <Dato titulo="Factura emitida" valor={`${formatoFecha(c.fecha)} · hace ${diffDias(c.fecha, hoy)} días`} />
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

          {/* Documentación: tres cosas para tildar */}
          {c.tipo === 'FC' && (
            <section>
              <div className="mb-2 flex items-center justify-between gap-2">
                <h3 className="font-bold">Documentación</h3>
                {rol === 'auditoria' && paraRevisar.length > 0 && (
                  <button type="button" onClick={() => aprobar(paraRevisar)} className={`${botonChico} bg-esmeralda text-white hover:bg-emerald-600`}>
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
                          {d.archivo && <div className="truncate text-xs text-slate-500">{d.archivo}</div>}
                          {d.estado === 'observado' && d.motivo && <div className="text-xs font-semibold text-red-700">{d.motivo}</div>}
                        </div>
                      </div>
                      <div className="flex shrink-0 items-center gap-1.5">
                        {rol === 'sucursal' && abierta && (d.estado === 'faltante' || d.estado === 'observado') ? (
                          <label className={`${botonChico} cursor-pointer bg-marca text-white hover:bg-marca-oscuro`}>
                            <FileUp className="h-3.5 w-3.5" />
                            {d.estado === 'faltante' ? 'Subir' : 'Reemplazar'}
                            <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => subir([d.tipo], e.target.files?.[0])} />
                          </label>
                        ) : rol === 'auditoria' && d.estado === 'en_revision' ? (
                          <>
                            <button type="button" onClick={() => aprobar([d.tipo])} className={`${botonChico} bg-esmeralda/15 text-emerald-800 hover:bg-esmeralda/25`}>
                              <Check className="h-3.5 w-3.5" /> Aprobar
                            </button>
                            <button type="button" onClick={() => setObservando(d.tipo)} className={`${botonChico} bg-sem-rojo/10 text-red-800 hover:bg-sem-rojo/20`}>
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
                          {MOTIVOS_OBSERVACION.map((m) => (
                            <option key={m}>{m}</option>
                          ))}
                        </select>
                        <button type="button" onClick={() => observar(d.tipo)} className={`${botonChico} bg-sem-rojo text-white`}>
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
                  <input type="file" accept=".pdf,image/*" className="sr-only" onChange={(e) => subir(pendientesDeSubir, e.target.files?.[0])} />
                </label>
              )}
              {c.subidoPor && (
                <p className="mt-2 text-xs text-slate-500">
                  Subido por {c.subidoPor} el {formatoFecha(c.fechaDrive)}
                </p>
              )}
              {rol === 'sucursal' && leTocaALaSucursal && (
                <p className="mt-1 text-xs text-slate-500">En la demo el archivo no se sube a ningún lado: solo se registra su nombre.</p>
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
                    <input type="date" min={hoy} value={fechaDemora} onChange={(e) => setFechaDemora(e.target.value)} className={`${claseSelect} mt-1 w-full`} />
                  </label>
                  <button type="button" onClick={avisarDemora} className={`${botonPrincipal} bg-marca hover:bg-marca-oscuro`}>
                    Avisar a Auditoría
                  </button>
                </div>
              )}
            </section>
          )}

          {/* Acciones de Auditoría */}
          {rol === 'auditoria' && abierta && (
            <section className="space-y-3">
              {c.fechaPresentacion === null && (
                <button type="button" onClick={presentar} disabled={!puedePresentarse(c, hoy)} className={`${botonPrincipal} bg-esmeralda hover:bg-emerald-600`}>
                  <Send className="h-4 w-4" /> Marcar como presentada
                </button>
              )}
              {c.fechaPresentacion === null && !puedePresentarse(c, hoy) && (
                <p className="text-center text-xs text-slate-500">Se puede presentar cuando la factura, la orden y la firma están aprobadas.</p>
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
                    <button type="button" onClick={registrarRechazo} className={`${botonPrincipal} bg-sem-rojo hover:bg-red-600`}>
                      Devolver a la sucursal
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
                      reclamo === 'sin_reclamar' ? 'bg-red-800/10 text-red-900' : reclamo === 'escalar' ? 'bg-sem-amarillo/20 text-amber-900' : 'bg-slate-100 text-slate-700'
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
                    <li key={i} className="flex justify-between gap-2">
                      <span>
                        {i + 1}. {formatoFecha(r.fecha || null)} por {r.medio} · {r.autor}
                      </span>
                      <span className="truncate text-xs text-slate-500">{r.nota}</span>
                    </li>
                  ))}
                </ol>
              )}
              {reclamo === 'escalar' && (
                <p className="mt-2 rounded-md bg-sem-amarillo/15 p-2 text-xs text-amber-900">
                  La compañía no respondió a 3 reclamos: corresponde escalarlo a gerencia para que intervenga.
                </p>
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
                placeholder={rol === 'sucursal' ? 'Escribile a Auditoría…' : 'Escribile a la sucursal…'}
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
