import type { Comprobante } from './tipos'

/** Por qué no se vuelve a facturar lo que anuló una nota de crédito. */
export const MOTIVOS_NO_REFACTURA = ['Se anuló la orden', 'La compañía no reconoce ese importe', 'Se le factura al cliente', 'Otro motivo']

/** Tiene una nota de crédito (total o parcial) que puede dejar algo para volver a facturar. */
export const tieneNotaDeCredito = (f: Comprobante) => f.estado === 'anulada' || (f.acreditado ?? 0) > 0

/** Texto corto de la respuesta, para el historial y los detalles. */
export function textoRefacturacion(r: NonNullable<Comprobante['refacturacion']>, pesos: (n: number) => string): string {
  if (r.decision === 'no') return `No se vuelve a facturar${r.motivo ? `: ${r.motivo}` : ''}`
  return `Se vuelve a facturar${r.importe ? ` por ${pesos(r.importe)}` : ''}`
}
