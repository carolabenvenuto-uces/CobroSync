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
import { plazosActuales, toleranciaReclamo } from './plazos'
import { estaVencido } from './semaforo'
import { idPedido } from './pedidos'
import type { Comprobante, RespuestaReclamo } from './tipos'

/** Reclamos sin respuesta a partir de los cuales se pide apoyo a gerencia. */
export const RECLAMOS_PARA_ESCALAR = 3

export type EstadoReclamo = 'tolerancia' | 'sin_reclamar' | 'reclamada' | 'volver' | 'escalar' | 'en_pagos' | 'reenviar' | 'refacturar'

/** Días que se espera el pago después de que la compañía dijo que la pasó al circuito de pagos. */
export const ESPERA_PAGO_DIAS = 30

export const NOMBRE_ESTADO_RECLAMO: Record<EstadoReclamo, string> = {
  sin_reclamar: 'Sin reclamar',
  reclamada: 'Esperando respuesta',
  volver: 'Volver a reclamar',
  // La compañía no respondió 3 reclamos: Auditoría le pide apoyo a gerencia (eso es una acción, no el estado)
  escalar: 'Sin respuesta',
  tolerancia: 'En tolerancia',
  en_pagos: 'En circuito de pagos',
  reenviar: 'Reenviar documentación',
  refacturar: 'Esperando refacturación',
}

export const NOMBRE_RESPUESTA: Record<'pagos' | 'documentacion' | 'refacturar', string> = {
  pagos: 'Pasa al circuito de pagos',
  documentacion: 'Pide reenviar la documentación',
  refacturar: 'Pide refacturar',
}

/** Estados en los que Auditoría tiene que hacer algo. */
export const RECLAMO_PARA_ACTUAR: EstadoReclamo[] = ['sin_reclamar', 'volver', 'escalar', 'reenviar']

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
  if (c.reenviar) return 'reenviar'
  if (c.reclamos.length === 0) {
    const tolerancia = toleranciaReclamo(c.aseguradoraId)
    return tolerancia > 0 && c.vencimiento && diffDias(c.vencimiento, fechaCorte) < tolerancia ? 'tolerancia' : 'sin_reclamar'
  }
  // La última respuesta de la compañía manda
  const conRespuesta = [...c.reclamos].reverse().find((r) => r.respuesta)
  const r = conRespuesta?.respuesta
  if (r) {
    if (r.tipo === 'pagos' && diffDias(r.fecha, fechaCorte) < ESPERA_PAGO_DIAS) return 'en_pagos'
    if (r.tipo === 'refacturar' && (c.pedidos ?? []).some((p) => p.tipo === 'refacturar' && !p.cerrado)) return 'refacturar'
  }
  // Reclamos sin respuesta después de la última respuesta (los anteriores ya se contestaron)
  const desde = conRespuesta ? c.reclamos.indexOf(conRespuesta) + 1 : 0
  const sinRespuesta = c.reclamos.slice(desde)
  if (sinRespuesta.length === 0) return 'volver'
  const ultimo = ultimoReclamo(c)
  // Un reclamo sin fecha (vino de la planilla) se toma como viejo
  const esperando = ultimo !== null && diffDias(ultimo, fechaCorte) < plazosActuales().respuestaReclamo
  if (esperando) return 'reclamada'
  return sinRespuesta.length >= RECLAMOS_PARA_ESCALAR ? 'escalar' : 'volver'
}

/**
 * Registra la respuesta de la compañía en el último reclamo y devuelve los cambios de la factura:
 * reenviar la documentación la devuelve a Presentar; refacturar abre un pedido a la sucursal.
 */
export function cambiosPorRespuesta(
  c: Comprobante,
  tipo: RespuestaReclamo,
  nota: string,
  hoy: string,
  autor: string,
): { campos: Partial<Comprobante>; evento: string } | null {
  if (c.reclamos.length === 0) return null
  const reclamos = c.reclamos.map((r, i) => (i === c.reclamos.length - 1 ? { ...r, respuesta: { fecha: hoy, tipo, nota: nota || undefined } } : r))
  const campos: Partial<Comprobante> = { reclamos }
  if (tipo === 'documentacion') campos.reenviar = true
  if (tipo === 'refacturar') {
    campos.pedidos = [
      ...(c.pedidos ?? []),
      { id: idPedido(hoy), fecha: hoy, tipo: 'refacturar', detalle: nota ? `La compañía pide refacturar: ${nota}` : 'La compañía pide refacturar.', autor },
    ]
  }
  return { campos, evento: `Respuesta de la compañía: ${NOMBRE_RESPUESTA[tipo].toLowerCase()}${nota ? ` (${nota})` : ''}` }
}
