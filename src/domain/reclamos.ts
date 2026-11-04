/**
 * Reclamos a las compañías por facturas vencidas.
 *
 * Regla del sector:
 *  - Vencida y sin reclamar → hay que reclamar.
 *  - Reclamada → se espera respuesta.
 *  - Si la compañía no respondió a 3 reclamos → se escala a gerencia para que intervenga.
 *    No depende de los días de vencida.
 */
import { estaVencido } from './semaforo'
import type { Comprobante } from './tipos'

/** Reclamos sin respuesta a partir de los cuales se escala a gerencia. */
export const RECLAMOS_PARA_ESCALAR = 3

export type EstadoReclamo = 'sin_reclamar' | 'reclamada' | 'escalar'

export const NOMBRE_ESTADO_RECLAMO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'Sin reclamar',
  reclamada: 'Reclamada',
  // La compañía no respondió 3 reclamos: Auditoría le pide apoyo a gerencia (eso es una acción, no el estado)
  escalar: 'Sin respuesta',
}

export function ultimoReclamo(c: Comprobante): string | null {
  return c.reclamos.length === 0 ? null : c.reclamos.map((r) => r.fecha).sort().at(-1) ?? null
}

/** null si la factura no está vencida. */
export function estadoReclamo(c: Comprobante, fechaCorte: string): EstadoReclamo | null {
  if (!estaVencido(c, fechaCorte)) return null
  if (c.reclamos.length === 0) return 'sin_reclamar'
  return c.reclamos.length >= RECLAMOS_PARA_ESCALAR ? 'escalar' : 'reclamada'
}
