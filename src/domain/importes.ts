/**
 * Importes de una factura teniendo en cuenta notas de crédito parciales y cobros por otro importe.
 *
 * - acreditado: lo que restan las notas de crédito vinculadas (sin percepciones, que no se acreditan)
 * - saldo: lo que falta cobrar = total − acreditado (0 si está cobrada o anulada)
 * - cobrado: lo que efectivamente pagó la compañía (si no se indicó, el saldo)
 */
import type { Comprobante } from './tipos'

export function saldoFactura(c: Comprobante): number {
  if (c.tipo !== 'FC' || c.estado === 'anulada' || c.estado === 'cobrada') return 0
  return c.total - (c.acreditado ?? 0)
}

/** Lo que queda por cobrar aunque la factura ya esté cobrada o anulada (para mostrar en la ficha). */
export function saldoSinCobro(c: Comprobante): number {
  return c.total - (c.acreditado ?? 0)
}

export function importeCobrado(c: Comprobante): number {
  if (c.estado !== 'cobrada') return 0
  return c.importeCobrado ?? saldoSinCobro(c)
}

/**
 * Importe que una nota de crédito TOTAL debería tener para esta factura. Las percepciones no se
 * acreditan: si se conocen (vienen del ERP) se restan; si no, se devuelve null.
 */
export function importeAcreditable(c: Comprobante): number | null {
  return c.percepciones !== undefined && c.percepciones !== null ? c.total - c.percepciones : null
}
