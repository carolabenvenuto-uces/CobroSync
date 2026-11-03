/**
 * Reglas del semáforo operativo.
 *
 *  ROJO     → falta un documento, está ilegible o sin firma. El legajo NO puede avanzar.
 *  AMARILLO → el legajo está completo; falta presentarlo, o está presentado esperando el pago.
 *  VERDE    → cobrado.
 *  NEUTRO   → notas de crédito y facturas anuladas (no se gestionan).
 *
 * Estas reglas son conocimiento del negocio: por eso viven acá, separadas de las
 * pantallas, y tienen sus propios tests (tests/semaforo.test.ts).
 */
import type { ColorSemaforo, Comprobante, Documento, EstadoDocumento, TipoDocumento } from './tipos'

export const DOCUMENTOS_REQUERIDOS: TipoDocumento[] = [
  'factura',
  'orden_reparacion',
  'remito',
  'conformidad',
]

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  factura: 'Factura',
  orden_reparacion: 'Orden de reparación',
  remito: 'Remito',
  conformidad: 'Conformidad firmada',
}

export const NOMBRE_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  ok: 'Correcto',
  faltante: 'Falta',
  ilegible: 'Ilegible',
  sin_firma: 'Sin firma o sello',
}

export interface ResultadoSemaforo {
  color: ColorSemaforo
  /** explicación en palabras: qué bloquea el legajo o en qué etapa está */
  detalle: string[]
}

/** Devuelve el documento de cada tipo requerido; si no existe, lo da por faltante. */
export function documentosDelLegajo(documentos: Documento[]): Documento[] {
  return DOCUMENTOS_REQUERIDOS.map(
    (tipo): Documento => documentos.find((d) => d.tipo === tipo) ?? { tipo, estado: 'faltante' },
  )
}

export function problemasDocumentales(documentos: Documento[]): string[] {
  return documentosDelLegajo(documentos)
    .filter((d) => d.estado !== 'ok')
    .map((d) =>
      d.estado === 'faltante'
        ? `Falta ${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()}`
        : `${NOMBRE_DOCUMENTO[d.tipo]}: ${NOMBRE_ESTADO_DOCUMENTO[d.estado].toLowerCase()}`,
    )
}

export function calcularSemaforo(c: Comprobante): ResultadoSemaforo {
  if (c.tipo === 'NC') return { color: 'neutro', detalle: ['Nota de crédito'] }
  if (c.estado === 'anulada') return { color: 'neutro', detalle: ['Factura anulada con nota de crédito'] }
  if (c.estado === 'cobrada') return { color: 'verde', detalle: ['Cobrado'] }

  const problemas = problemasDocumentales(c.documentos)
  if (c.fechaDrive === null) problemas.unshift('La sucursal todavía no subió el legajo')
  if (problemas.length > 0) return { color: 'rojo', detalle: problemas }

  if (c.fechaPresentacion === null) {
    return { color: 'amarillo', detalle: ['Legajo completo: pendiente de presentación'] }
  }
  return { color: 'amarillo', detalle: ['Presentado: esperando el pago'] }
}

/** Una factura presentada cuyo vencimiento ya pasó y todavía no se cobró. */
export function estaVencido(c: Comprobante, fechaCorte: string): boolean {
  return (
    c.tipo === 'FC' &&
    c.estado === 'presentada' &&
    c.vencimiento !== null &&
    c.vencimiento < fechaCorte
  )
}

/** Solo se puede presentar un legajo completo (amarillo) que todavía no se presentó. */
export function puedePresentarse(c: Comprobante): boolean {
  return calcularSemaforo(c).color === 'amarillo' && c.fechaPresentacion === null
}
