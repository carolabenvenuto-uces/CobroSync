/**
 * Reclamos a las compañías por facturas vencidas.
 *
 * Regla propuesta (ajustable):
 *  - Vencida y sin reclamar → hay que reclamar.
 *  - Reclamada → se espera respuesta.
 *  - Si sigue sin cobrarse con 2 reclamos o más y pasaron 7 días desde el último
 *    (o lleva más de 30 días vencida) → se escala a gerencia para que intervenga.
 */
import { diffDias } from '../lib/fechas'
import { estaVencido } from './semaforo'
import type { Comprobante } from './tipos'

export const RECLAMOS_PARA_ESCALAR = 2
export const DIAS_SIN_RESPUESTA = 7
export const DIAS_VENCIDA_PARA_ESCALAR = 30

export type EstadoReclamo = 'sin_reclamar' | 'reclamada' | 'escalar'

export const NOMBRE_ESTADO_RECLAMO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'Sin reclamar',
  reclamada: 'Reclamada',
  escalar: 'Escalar a gerencia',
}

export function ultimoReclamo(c: Comprobante): string | null {
  return c.reclamos.length === 0 ? null : c.reclamos.map((r) => r.fecha).sort().at(-1) ?? null
}

/** null si la factura no está vencida. */
export function estadoReclamo(c: Comprobante, fechaCorte: string): EstadoReclamo | null {
  if (!estaVencido(c, fechaCorte)) return null
  if (c.reclamos.length === 0) return 'sin_reclamar'
  const ultimo = ultimoReclamo(c)!
  const diasVencida = diffDias(c.vencimiento as string, fechaCorte)
  if (
    (c.reclamos.length >= RECLAMOS_PARA_ESCALAR && diffDias(ultimo, fechaCorte) >= DIAS_SIN_RESPUESTA) ||
    diasVencida > DIAS_VENCIDA_PARA_ESCALAR
  ) {
    return 'escalar'
  }
  return 'reclamada'
}
