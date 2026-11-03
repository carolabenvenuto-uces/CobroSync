/**
 * Modelo de datos de CobroSync.
 *
 * Cada tipo sale de una hoja de la planilla de control que se usa hoy:
 * - Comprobante      ← hoja "Diario" (una fila por factura o nota de crédito)
 * - Documento        ← lo que hoy se revisa a mano en el Drive (el legajo)
 * - Aseguradora      ← hoja "Info. Compañías"
 * - CobroPrevisto    ← hoja "Cobros Previstos"
 * La hoja "Saldos" NO tiene tipo propio: se calcula a partir de los comprobantes
 * (ver finanzas.ts). Así no hay dos lugares donde cargar el mismo dato.
 *
 * Las fechas se guardan como texto ISO "AAAA-MM-DD" (igual que en una base de datos),
 * y se formatean recién al mostrarlas en pantalla.
 */

export type Rol = 'taller' | 'administracion' | 'gerencia'

/** FC = factura, NC = nota de crédito */
export type TipoComprobante = 'FC' | 'NC'

export type EstadoComprobante =
  | 'pendiente_drive' // la sucursal todavía no subió el legajo
  | 'en_gestion' // el legajo está en el Drive pero tiene observaciones
  | 'presentada' // presentada a la compañía, esperando el pago
  | 'cobrada'
  | 'anulada' // anulada con una nota de crédito
  | 'nota_credito' // estado propio de las NC

export type TipoDocumento = 'factura' | 'orden_reparacion' | 'remito' | 'conformidad'

export type EstadoDocumento = 'ok' | 'faltante' | 'ilegible' | 'sin_firma'

export type ColorSemaforo = 'rojo' | 'amarillo' | 'verde' | 'neutro'

export interface Aseguradora {
  id: string
  nombre: string
  email: string
  /** días que tarda en pagar desde la presentación */
  plazoPagoDias: number
}

export interface Documento {
  tipo: TipoDocumento
  estado: EstadoDocumento
}

export interface Comprobante {
  id: string
  /** referencia interna del ERP (columna "Ref." de la planilla) */
  ref: string
  tipo: TipoComprobante
  fecha: string
  sucursal: string
  puntoVenta: number
  numero: number
  aseguradoraId: string
  siniestro: string
  patente: string
  /** importe total; las notas de crédito son negativas */
  total: number
  fechaDrive: string | null
  fechaPresentacion: string | null
  /** se conoce recién cuando se presenta: presentación + plazo de pago */
  vencimiento: string | null
  fechaCobro: string | null
  estado: EstadoComprobante
  /** en una NC, el id de la factura que anula */
  ncReferencia: string | null
  observaciones: string
  documentos: Documento[]
}

export interface CobroPrevisto {
  id: string
  comprobanteId: string
  aseguradoraId: string
  /** fecha en que la compañía informó que va a pagar (o pagó) */
  fechaIngreso: string
  monto: number
  estado: 'informado' | 'cobrado'
}

export interface MetaDemo {
  /** "hoy" de la demo: todos los cálculos de vencidos usan esta fecha */
  fechaCorte: string
  sucursales: string[]
}

export interface DatosApp {
  aseguradoras: Aseguradora[]
  comprobantes: Comprobante[]
  cobrosPrevistos: CobroPrevisto[]
  meta: MetaDemo
}
