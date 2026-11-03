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

export type TipoDocumento = 'factura' | 'orden_reparacion' | 'remito' | 'conformidad'

export type EstadoDocumento = 'ok' | 'faltante' | 'ilegible' | 'sin_firma'

export type ColorSemaforo = 'rojo' | 'amarillo' | 'verde' | 'neutro'

/** De quién depende que el legajo avance. */
export type Responsable = 'sucursal' | 'auditoria' | 'compania'

/**
 * Etapa del legajo: lo que se muestra en pantalla.
 * Separa el "amarillo" según quién tiene que actuar, para no mezclar responsabilidades.
 */
export type Etapa =
  | 'bloqueado' // rojo: atrasado o con documentos con problemas
  | 'esperando_sucursal' // amarillo: dentro del plazo de escaneo
  | 'para_presentar' // azul: completo, le toca a auditoría
  | 'esperando_pago' // violeta: presentado, le toca a la compañía
  | 'cobrado' // verde
  | 'no_aplica' // gris: NC y facturas anuladas

export interface Aseguradora {
  id: string
  nombre: string
  email: string
  /** días que tarda en pagar desde la presentación (7 o 30) */
  plazoPagoDias: number
}

export interface Sucursal {
  nombre: string
  puntoVenta: number
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
}

export type AreaEvento = 'sucursal' | 'auditoria' | 'gerencia' | 'sistema'

export type TipoEvento = 'subida' | 'mensaje' | 'rechazo' | 'compromiso' | 'presentacion' | 'aviso' | 'nota_credito'

export interface Evento {
  fecha: string
  autor: string
  area: AreaEvento
  tipo: TipoEvento
  texto: string
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
