/**
 * Reclamos a las compañías por facturas vencidas.
 *
 * Regla del sector:
 *  - Vencida y sin reclamar → hay que reclamar.
 *  - Reclamada hace menos de una semana (se cambia en Ajustes) → se espera la respuesta.
 *  - Pasó la semana sin respuesta → volver a reclamar.
 *  - Si la compañía no respondió a 3 reclamos (y pasó la semana del último) → Auditoría pide
 *    apoyo a gerencia para que intervenga.
 */
import { diffDias } from '../lib/fechas'
import { plazosActuales } from './plazos'
import { estaVencido } from './semaforo'
import type { Comprobante } from './tipos'

/** Reclamos sin respuesta a partir de los cuales se pide apoyo a gerencia. */
export const RECLAMOS_PARA_ESCALAR = 3

export type EstadoReclamo = 'sin_reclamar' | 'reclamada' | 'volver' | 'escalar'

export const NOMBRE_ESTADO_RECLAMO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'Sin reclamar',
  reclamada: 'Esperando respuesta',
  volver: 'Volver a reclamar',
  // La compañía no respondió 3 reclamos: Auditoría le pide apoyo a gerencia (eso es una acción, no el estado)
  escalar: 'Sin respuesta',
}

/** Estados en los que Auditoría tiene que hacer algo. */
export const RECLAMO_PARA_ACTUAR: EstadoReclamo[] = ['sin_reclamar', 'volver', 'escalar']

export function ultimoReclamo(c: Comprobante): string | null {
  const fechas = c.reclamos.map((r) => r.fecha).filter(Boolean).sort()
  return fechas.at(-1) ?? null
}

/** Día desde el que el último reclamo queda sin respuesta (null si no hay reclamos con fecha). */
export function finDeEspera(c: Comprobante): string | null {
  const ultimo = ultimoReclamo(c)
  if (!ultimo) return null
  const d = new Date(`${ultimo}T00:00:00Z`)
  d.setUTCDate(d.getUTCDate() + plazosActuales().respuestaReclamo)
  return d.toISOString().slice(0, 10)
}

/** null si la factura no está vencida. */
export function estadoReclamo(c: Comprobante, fechaCorte: string): EstadoReclamo | null {
  if (!estaVencido(c, fechaCorte)) return null
  if (c.reclamos.length === 0) return 'sin_reclamar'
  const ultimo = ultimoReclamo(c)
  // Un reclamo sin fecha (vino de la planilla) se toma como viejo
  const esperando = ultimo !== null && diffDias(ultimo, fechaCorte) < plazosActuales().respuestaReclamo
  if (esperando) return 'reclamada'
  return c.reclamos.length >= RECLAMOS_PARA_ESCALAR ? 'escalar' : 'volver'
}
