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
 * Nuevo respecto de la planilla:
 * - Evento      ← la conversación que hoy se pierde en el mail (rechazos, reclamos, respuestas)
 * - Compromiso  ← cuando la sucursal avisa que no puede subir algo y dice para cuándo
 *
 * Las fechas se guardan como texto ISO "AAAA-MM-DD" (igual que en una base de datos),
 * y se formatean recién al mostrarlas en pantalla.
 */

/** sucursal: quienes facturan y escanean · auditoria: control y presentación · gerencia: consulta */
export type Rol = 'sucursal' | 'auditoria' | 'gerencia'

/** FC = factura, NC = nota de crédito */
export type TipoComprobante = 'FC' | 'NC'

export type EstadoComprobante =
  | 'pendiente_drive' // la sucursal todavía no subió el legajo
  | 'en_gestion' // hay documentos subidos, pero falta algo o tiene observaciones
  | 'presentada' // presentada a la compañía, esperando el pago
  | 'cobrada'
  | 'anulada' // anulada con una nota de crédito
  | 'nota_credito' // estado propio de las NC

/** Lo que Auditoría tiene que ver de cada factura: la factura, la orden (de reparación o de repuestos) y la firma del cliente. */
export type TipoDocumento = 'factura' | 'orden' | 'firma'

/**
 * faltante → la sucursal no lo subió · en_revision → subido, Auditoría tiene que revisarlo
 * ok → Auditoría lo aprobó (tildado) · observado → Auditoría lo rechazó, con un motivo
 */
export type EstadoDocumento = 'faltante' | 'en_revision' | 'ok' | 'observado'

export type ColorSemaforo = 'rojo' | 'amarillo' | 'verde' | 'neutro'

/** De quién depende que el legajo avance. */
export type Responsable = 'sucursal' | 'auditoria' | 'compania'

/**
 * Etapa de la factura, con el mismo vocabulario que la planilla de control
 * (D. Pend., P. Pend., Al día, Vencida, Cobrado), un poco más detallado:
 */
export type Etapa =
  | 'doc_pendiente' // D. Pend. dentro de los 7 días: le toca a la sucursal
  | 'doc_atrasada' // D. Pend. con más de 7 días: la sucursal está atrasada
  | 'doc_observada' // Auditoría observó un documento (ilegible, sin firma…): la sucursal tiene que reemplazarlo
  | 'en_revision' // la sucursal subió todo: Auditoría tiene que revisarlo y tildarlo
  | 'pres_pendiente' // P. Pend.: legajo completo, le toca a Auditoría presentarlo
  | 'al_dia' // presentada, todavía no venció: le toca a la compañía
  | 'vencida' // presentada y vencida sin cobrar: hay que reclamar
  | 'cobrado'
  | 'no_aplica' // NC y facturas anuladas

export interface Aseguradora {
  id: string
  nombre: string
  /** razón social y CUIT como figuran en la factura (pestaña "CP") */
  razonSocial?: string
  cuit?: string
  /** a dónde se presentan las facturas */
  email: string
  /** a dónde se reclaman las vencidas */
  emailReclamos?: string
  /** días que tarda en pagar desde la presentación (7 o 30) */
  plazoPagoDias: number
}

export interface Sucursal {
  nombre: string
  puntoVenta: number
  /** todos los puntos de venta de la sucursal */
  puntosVenta?: number[]
  /** a quién se escala un escaneo atrasado */
  gerente: string
  /** personas que facturan y escanean */
  personas: string[]
}

export interface Documento {
  tipo: TipoDocumento
  estado: EstadoDocumento
  /** nombre del archivo subido, si lo hay */
  archivo?: string
  /** por qué se observó (ilegible, sin firma, no corresponde…) */
  motivo?: string
}

export type AreaEvento = 'sucursal' | 'auditoria' | 'gerencia' | 'sistema'

export type TipoEvento =
  | 'subida'
  | 'mensaje'
  | 'rechazo'
  | 'compromiso'
  | 'presentacion'
  | 'aviso'
  | 'nota_credito'
  | 'reclamo'

export interface Evento {
  fecha: string
  autor: string
  area: AreaEvento
  tipo: TipoEvento
  texto: string
}

/** Un reclamo a la compañía por una factura vencida. */
export interface Reclamo {
  fecha: string
  medio: 'mail' | 'portal' | 'telefono'
  autor: string
  nota: string
}

export interface Compromiso {
  fecha: string
  motivo: string
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
  /** primera vez que la sucursal subió documentos */
  fechaDrive: string | null
  /** quién de la sucursal subió los documentos */
  subidoPor: string | null
  fechaPresentacion: string | null
  /** se conoce recién cuando se presenta: presentación + plazo de pago */
  vencimiento: string | null
  fechaCobro: string | null
  estado: EstadoComprobante
  /** en una NC, el id de la factura que anula */
  ncReferencia: string | null
  /** en una NC: si la sucursal avisó a auditoría (o auditoría ya la revisó) */
  ncInformada: boolean | null
  compromiso: Compromiso | null
  /** reclamos a la compañía (facturas vencidas) */
  reclamos: Reclamo[]
  observaciones: string
  documentos: Documento[]
  eventos: Evento[]
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
  /** "hoy" de la demo: todos los cálculos de plazos usan esta fecha */
  fechaCorte: string
  sucursales: Sucursal[]
}

export interface DatosApp {
  aseguradoras: Aseguradora[]
  comprobantes: Comprobante[]
  cobrosPrevistos: CobroPrevisto[]
  meta: MetaDemo
}
