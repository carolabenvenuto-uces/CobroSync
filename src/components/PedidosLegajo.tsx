import { useState } from 'react'
import { ClipboardList, MessageSquareReply } from 'lucide-react'
import { useApp } from '../context/AppContext'
import { idPedido, NOMBRE_PEDIDO, ncSinAviso } from '../domain/pedidos'
import type { Comprobante, Pedido, TipoPedido } from '../domain/tipos'
import { diffDias } from '../lib/fechas'
import { formatoFecha } from '../lib/formato'
import { claseSelect } from './ui/Estados'

/**
 * Pedidos de Auditoría a la sucursal, dentro del legajo de la factura.
 * - Auditoría: pide algo (error en la factura, refacturar, otro) y lo cierra cuando está resuelto.
 * - Sucursal: ve lo que le pidieron y responde (con eso le llega a Auditoría).
 * Una nota de crédito que entró sin aviso pide, sola, que la sucursal confirme el motivo.
 */
export function PedidosLegajo({ c }: { c: Comprobante }) {
  const { rol, usuario, hoy, actualizarComprobante, registrarEvento } = useApp()
  const [nuevo, setNuevo] = useState(false)
  const [tipo, setTipo] = useState<TipoPedido | ''>('')
  const [detalle, setDetalle] = useState('')
  const [respuestas, setRespuestas] = useState<Record<string, string>>({})
  const [motivoNc, setMotivoNc] = useState('')
  const pedidos = c.pedidos ?? []
  const abiertos = pedidos.filter((p) => !p.cerrado)
  const sinAviso = ncSinAviso(c)
  if (rol === 'gerencia' || (rol === 'sucursal' && abiertos.length === 0 && !sinAviso)) return null

  const guardar = (lista: Pedido[]) => actualizarComprobante(c.id, { pedidos: lista })

  function pedir() {
    if (!tipo) return
    if (!detalle.trim()) return
    guardar([...pedidos, { id: idPedido(hoy), fecha: hoy, tipo, detalle: detalle.trim(), autor: usuario || 'Auditoría' }])
    registrarEvento(c.id, 'mensaje', `Pedido de Auditoría (${NOMBRE_PEDIDO[tipo].toLowerCase()}): ${detalle.trim()}`)
    setDetalle('')
    setNuevo(false)
  }
  function responder(p: Pedido) {
    const texto = (respuestas[p.id] ?? '').trim()
    if (!texto) return
    guardar(pedidos.map((x) => (x.id === p.id ? { ...x, respuesta: { fecha: hoy, autor: usuario || 'Sucursal', texto } } : x)))
    registrarEvento(c.id, 'mensaje', `Respuesta al pedido "${NOMBRE_PEDIDO[p.tipo].toLowerCase()}": ${texto}`)
    setRespuestas({ ...respuestas, [p.id]: '' })
  }
  function cerrar(p: Pedido) {
    guardar(pedidos.map((x) => (x.id === p.id ? { ...x, cerrado: { fecha: hoy, autor: usuario || 'Auditoría' } } : x)))
    registrarEvento(c.id, 'mensaje', `Pedido resuelto: ${NOMBRE_PEDIDO[p.tipo].toLowerCase()}`)
  }
  // La sucursal confirma el motivo de una NC que entró sin aviso
  function confirmarNc() {
    if (!motivoNc.trim()) return
    actualizarComprobante(c.id, { ncInformada: true })
    registrarEvento(c.id, 'nota_credito', `Motivo de la nota de crédito: ${motivoNc.trim()}`)
    setMotivoNc('')
  }

  return (
    <section className="rounded-lg border border-sem-rojo/40 bg-red-50/40 p-3">
      <h3 className="mb-2 flex items-center gap-2 font-bold">
        <ClipboardList className="h-4 w-4 text-red-800" /> Pedidos de Auditoría
        {abiertos.length + (sinAviso ? 1 : 0) > 0 && <span className="rounded bg-sem-rojo px-1.5 text-xs font-bold text-white">{abiertos.length + (sinAviso ? 1 : 0)}</span>}
      </h3>

      {sinAviso && (
        <div className="mb-2 rounded-md bg-white p-2.5">
          <p className="text-sm">
            <strong>{NOMBRE_PEDIDO.aviso_nc}:</strong> entró del sistema una nota de crédito que la sucursal no avisó. Falta confirmar el motivo.
          </p>
          {rol === 'sucursal' && (
            <div className="mt-2 flex flex-wrap gap-2">
              <input value={motivoNc} onChange={(e) => setMotivoNc(e.target.value)} placeholder="Motivo de la nota de crédito" className={`${claseSelect} min-w-0 flex-1`} />
              <button type="button" onClick={confirmarNc} disabled={!motivoNc.trim()} className="rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                Confirmar
              </button>
            </div>
          )}
        </div>
      )}

      {pedidos.length === 0 && !sinAviso && <p className="text-sm text-slate-500">Sin pedidos para esta factura.</p>}
      <ul className="space-y-2">
        {pedidos.map((p) => (
          <li key={p.id} className={`rounded-md bg-white p-2.5 text-sm ${p.cerrado ? 'opacity-60' : ''}`}>
            <div className="flex flex-wrap items-baseline justify-between gap-2">
              <strong>{NOMBRE_PEDIDO[p.tipo]}</strong>
              <span className="text-xs text-slate-500">
                {formatoFecha(p.fecha)} · {p.autor}
                {!p.cerrado && !p.respuesta && ` · hace ${diffDias(p.fecha, hoy)} ${diffDias(p.fecha, hoy) === 1 ? 'día' : 'días'}`}
                {p.cerrado && ' · resuelto'}
              </span>
            </div>
            <p className="mt-0.5 text-slate-700">{p.detalle}</p>
            {p.respuesta && (
              <p className="mt-1.5 flex items-start gap-1.5 rounded bg-fondo px-2 py-1 text-xs text-slate-700">
                <MessageSquareReply className="mt-0.5 h-3.5 w-3.5 shrink-0 text-marca" />
                <span>
                  <strong>{p.respuesta.autor}</strong> ({formatoFecha(p.respuesta.fecha)}): {p.respuesta.texto}
                </span>
              </p>
            )}
            {rol === 'sucursal' && !p.cerrado && !p.respuesta && (
              <div className="mt-2 flex flex-wrap gap-2">
                <input
                  value={respuestas[p.id] ?? ''}
                  onChange={(e) => setRespuestas({ ...respuestas, [p.id]: e.target.value })}
                  placeholder="Respuesta: número de la factura nueva, de la NC o una aclaración"
                  className={`${claseSelect} min-w-0 flex-1`}
                />
                <button type="button" onClick={() => responder(p)} disabled={!(respuestas[p.id] ?? '').trim()} className="rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                  Responder
                </button>
              </div>
            )}
            {rol === 'auditoria' && !p.cerrado && (
              <button type="button" onClick={() => cerrar(p)} className="mt-2 text-xs font-semibold text-marca hover:underline">
                Dar por resuelto
              </button>
            )}
          </li>
        ))}
      </ul>

      {rol === 'auditoria' &&
        (nuevo ? (
          <div className="mt-2 space-y-2 rounded-md bg-white p-2.5">
            <select value={tipo} onChange={(e) => setTipo(e.target.value as TipoPedido)} className={`${claseSelect} w-full`}>
              <option value="" disabled>Seleccionar el tipo de pedido</option>
              {(['error_factura', 'refacturar', 'aviso_nc', 'otro'] as TipoPedido[]).map((t) => (
                <option key={t} value={t}>
                  {NOMBRE_PEDIDO[t]}
                </option>
              ))}
            </select>
            <textarea
              value={detalle}
              onChange={(e) => setDetalle(e.target.value)}
              rows={2}
              placeholder="Qué hay que corregir (por ejemplo: el importe no coincide con la orden)"
              className={`${claseSelect} w-full`}
            />
            <div className="flex gap-2">
              <button type="button" onClick={pedir} disabled={!tipo || !detalle.trim()} className="rounded-lg bg-marca px-3 py-1.5 text-sm font-semibold text-white disabled:opacity-50">
                Enviar a la sucursal
              </button>
              <button type="button" onClick={() => setNuevo(false)} className="rounded-lg px-3 py-1.5 text-sm text-slate-600 hover:bg-fondo">
                Cancelar
              </button>
            </div>
          </div>
        ) : (
          <button type="button" onClick={() => setNuevo(true)} className="mt-2 text-sm font-semibold text-marca hover:underline">
            + Pedirle algo a la sucursal
          </button>
        ))}
    </section>
  )
}
