/**
 * Facturas del mismo siniestro: cuando no se facturan todos los repuestos juntos, una misma orden
 * (y la misma firma del cliente) sirve para varias facturas.
 */
import type { Comprobante } from './tipos'

const normalizar = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

/** Otras facturas vigentes con el mismo siniestro en la misma compañía. */
export function facturasDelSiniestro(c: Comprobante, todas: Comprobante[]): Comprobante[] {
  const clave = normalizar(c.siniestro ?? '')
  if (clave.length < 4) return []
  return todas
    .filter(
      (x) =>
        x.id !== c.id &&
        x.tipo === 'FC' &&
        x.estado !== 'anulada' &&
        x.aseguradoraId === c.aseguradoraId &&
        normalizar(x.siniestro ?? '') === clave,
    )
    .sort((a, b) => a.fecha.localeCompare(b.fecha))
}

/** Cantidad de facturas por siniestro (para mostrar "3 facturas" al lado del número). */
export function contarPorSiniestro(todas: Comprobante[]): Map<string, number> {
  const m = new Map<string, number>()
  for (const c of todas) {
    if (c.tipo !== 'FC' || c.estado === 'anulada') continue
    const clave = `${c.aseguradoraId}|${normalizar(c.siniestro ?? '')}`
    if (normalizar(c.siniestro ?? '').length < 4) continue
    m.set(clave, (m.get(clave) ?? 0) + 1)
  }
  return m
}

export const claveSiniestro = (c: Comprobante) => `${c.aseguradoraId}|${normalizar(c.siniestro ?? '')}`
