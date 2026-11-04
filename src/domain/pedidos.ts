/**
 * Pedidos de Auditoría a las sucursales: lo que más tiempo lleva hoy (perseguir avisos de notas de
 * crédito y errores de facturación). Cada pedido queda en la factura, le aparece a la sucursal hasta
 * que responde, y Auditoría ve cuántos días lleva cada uno.
 *
 * Una nota de crédito que entra del ERP sin que la sucursal la haya avisado genera su pedido sola
 * (no hace falta crearlo): se resuelve cuando la sucursal confirma el motivo.
 */
import { diffDias } from '../lib/fechas'
import type { Comprobante, Pedido, TipoPedido } from './tipos'

export const NOMBRE_PEDIDO: Record<TipoPedido, string> = {
  error_factura: 'Error en la factura',
  refacturar: 'Refacturar',
  aviso_nc: 'Avisar la nota de crédito',
  otro: 'Otro pedido',
}

/** Pedido de Auditoría o generado solo, con su estado para listarlo. */
export interface PedidoAbierto {
  c: Comprobante
  pedido: Pedido
  /** generado solo por una NC sin aviso (no está guardado en la factura) */
  automatico: boolean
  /** esperando a la sucursal, o la sucursal ya respondió y falta que Auditoría lo cierre */
  estado: 'esperando' | 'respondido'
  dias: number
}

/** La NC llegó del ERP y la sucursal no la avisó (ni Auditoría la dio por revisada). */
export function ncSinAviso(c: Comprobante): boolean {
  return c.tipo === 'NC' && c.ncInformada === false
}

export function pedidosAbiertos(comprobantes: Comprobante[], hoy: string): PedidoAbierto[] {
  const lista: PedidoAbierto[] = []
  for (const c of comprobantes) {
    for (const p of c.pedidos ?? []) {
      if (p.cerrado) continue
      lista.push({ c, pedido: p, automatico: false, estado: p.respuesta ? 'respondido' : 'esperando', dias: diffDias(p.fecha, hoy) })
    }
    if (ncSinAviso(c)) {
      const pedido: Pedido = {
        id: `nc-${c.id}`,
        fecha: c.fecha,
        tipo: 'aviso_nc',
        detalle: 'Entró del sistema una nota de crédito que la sucursal no avisó: falta confirmar el motivo.',
        autor: 'CobroSync',
      }
      lista.push({ c, pedido, automatico: true, estado: 'esperando', dias: diffDias(c.fecha, hoy) })
    }
  }
  // Lo que lleva más tiempo esperando, primero
  return lista.sort((a, b) => Number(a.estado === 'respondido') - Number(b.estado === 'respondido') || b.dias - a.dias)
}

/** Pedidos que la sucursal todavía tiene que responder. */
export function pedidosParaSucursal(comprobantes: Comprobante[], hoy: string): PedidoAbierto[] {
  return pedidosAbiertos(comprobantes, hoy).filter((p) => p.estado === 'esperando')
}

/** Un id nuevo para un pedido (fecha + azar corto: no se repite entre las dos personas de Auditoría). */
export function idPedido(hoy: string): string {
  return `p-${hoy.replace(/-/g, '')}-${Math.random().toString(36).slice(2, 7)}`
}

/** ¿Otra persona de Auditoría tiene abierta esta factura en este momento? */
export function atendidaPorOtra(c: Comprobante, yo: string | null | undefined, ahora = new Date()): string | null {
  const a = c.atendiendo
  if (!a || !a.por || a.por === yo) return null
  return new Date(a.hasta) > ahora ? a.por : null
}
