import type { Plazos } from './plazos'
import type { TextosAvisos } from './textos'

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

/**
 * Lo que Cobranzas tiene que ver de cada factura: la factura y la orden (de reparación o de repuestos)
 * firmada por el cliente. La firma no se sube aparte: va en la orden.
 */
export type TipoDocumento = 'factura' | 'orden'

/**
 * faltante → la sucursal no lo subió · en_revision → subido, Cobranzas tiene que revisarlo
 * ok → Cobranzas lo aprobó (tildado) · observado → Cobranzas lo rechazó, con un motivo
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
  | 'doc_pendiente' // D. Pend. dentro del plazo: le toca a la sucursal
  | 'doc_atrasada' // D. Pend. fuera de plazo: la sucursal está atrasada
  | 'doc_observada' // Cobranzas observó un documento (ilegible, sin firma…): la sucursal tiene que reemplazarlo
  | 'en_revision' // la sucursal subió todo: Cobranzas tiene que revisarlo y tildarlo
  | 'pres_pendiente' // P. Pend.: legajo completo, le toca a Cobranzas presentarlo
  | 'al_dia' // presentada, todavía no venció: le toca a la compañía
  | 'vencida' // presentada y vencida sin cobrar: hay que reclamar
  | 'cobrado'
  | 'no_aplica' // NC y facturas anuladas
  | 'anterior' // factura anterior a CobroSync, sin presentar en la plataforma: su documentación está en el Drive

export interface Aseguradora {
  id: string
  nombre: string
  /** razón social y CUIT como figuran en la factura (pestaña "CP") */
  razonSocial?: string
  cuit?: string
  /** a dónde se presentan las facturas (uno o varios, separados por coma) */
  email: string
  /** a dónde se reclaman las vencidas (uno o varios, separados por coma) */
  emailReclamos?: string
  /** días que tarda en pagar desde la presentación (7 o 30) */
  plazoPagoDias: number
  /** es gran empresa y recibe factura de crédito MiPyME (si no se indica, sí) */
  recibeFce?: boolean
  /** cómo se le presentan las facturas: por mail o en su plataforma (si no se indica, mail) */
  canal?: 'mail' | 'portal'
  /** enlaces a la plataforma de la compañía (uno o varios, separados por coma) */
  portalUrl?: string
  /** días después del vencimiento antes de reclamar (compañías que suelen pagar; si no se indica, 0) */
  toleranciaReclamo?: number
  /** ya no se trabaja con ella: queda guardada pero oculta en Compañías, y se puede reactivar */
  pausada?: boolean
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
  /** link al archivo en el Drive de la empresa (con Google) */
  url?: string
  /** si el documento tiene varias páginas o fotos, todas (la primera también está en archivo/url) */
  adjuntos?: { archivo: string; url?: string }[]
  /** por qué se observó (ilegible, sin firma, no corresponde…) */
  motivo?: string
  /** quién lo subió y cuándo (cada documento, aunque se hayan subido juntos) */
  subidoPor?: string
  fecha?: string
  /** cómo llegó: desde el legajo o en una carga de varios archivos (y si se asignó solo por el nombre) */
  origen?: 'legajo' | 'varios' | 'varios-automatico'
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

/**
 * Qué respondió la compañía a un reclamo: pasa al circuito de pagos, pide reenviar la
 * documentación o pide refacturar (monto u otro dato mal).
 */
export type RespuestaReclamo = 'pagos' | 'documentacion' | 'refacturar' | 'error'

/** Un reclamo a la compañía por una factura vencida. */
export interface Reclamo {
  fecha: string
  medio: 'mail' | 'portal' | 'telefono'
  autor: string
  nota: string
  /** resuelto: fecha en que Cobranzas corrigió el error que informó la compañía */
  respuesta?: { fecha: string; tipo: RespuestaReclamo; nota?: string; resuelto?: string } | null
}

/**
 * Lo que Cobranzas le pide a la sucursal sobre una factura (o una nota de crédito): corregir un
 * error, refacturar, avisar una NC. Queda abierto hasta que la sucursal responde y Cobranzas lo cierra.
 */
export type TipoPedido = 'error_factura' | 'refacturar' | 'aviso_nc' | 'otro'

export interface Pedido {
  id: string
  fecha: string
  tipo: TipoPedido
  detalle: string
  autor: string
  /** lo que contestó la sucursal (la factura nueva, la NC, una aclaración) */
  respuesta?: { fecha: string; autor: string; texto: string } | null
  /** Cobranzas lo dio por resuelto */
  cerrado?: { fecha: string; autor: string } | null
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
  /** última vez que la sucursal subió documentos (si le observan algo y lo vuelve a subir, se mueve) */
  fechaDrive: string | null
  /** quién de la sucursal subió los documentos */
  subidoPor: string | null
  /** día en que Cobranzas aprobó toda la documentación; vuelve a vacío si después se observa algo */
  fechaAprobacion?: string | null
  fechaPresentacion: string | null
  /** se conoce recién cuando se presenta: presentación + plazo de pago */
  vencimiento: string | null
  fechaCobro: string | null
  estado: EstadoComprobante
  /** en una NC, el id de la factura que anula */
  ncReferencia: string | null
  /** en una NC: si la sucursal avisó a cobranzas (o cobranzas ya la revisó) */
  ncInformada: boolean | null
  compromiso: Compromiso | null
  /**
   * la sucursal avisó una nota de crédito para esta factura (la NC llega después con el ERP):
   * total (anula la factura) o parcial por un importe
   */
  anulacionInformada?: { fecha: string; motivo: string; parcial?: boolean; importe?: number } | null
  /** lo que restan las notas de crédito parciales vinculadas */
  acreditado?: number | null
  /** monto aprobado de la orden del siniestro (lo carga Cobranzas en la primera factura del siniestro) */
  montoOrden?: number | null
  /** lo que efectivamente cobró (si no se indica, el saldo) */
  importeCobrado?: number | null
  /** percepciones de IIBB de la factura (vienen del ERP): no se acreditan en la nota de crédito */
  percepciones?: number | null
  /** reclamos a la compañía (facturas vencidas) */
  reclamos: Reclamo[]
  observaciones: string
  documentos: Documento[]
  eventos: Evento[]
  /** pedidos de Cobranzas a la sucursal (errores, refacturación) */
  pedidos?: Pedido[]
  /** quién de Cobranzas la está viendo ahora (para que dos personas no hagan lo mismo a la vez) */
  atendiendo?: { por: string; hasta: string } | null
  /** la compañía pidió que se reenvíe la documentación: vuelve a la lista de Presentar */
  reenviar?: boolean | null
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
  /** plazos de la documentación (Ajustes); si falta, los de siempre */
  plazos?: Plazos
  /** avisos por mail (solo lo ve Cobranzas) */
  avisos?: { porMail: boolean; correosGerencia: string; correoSoporte?: string; nombreSoporte?: string }
  /** quién da soporte a la plataforma (lo ven todos los sectores) */
  soporte?: { nombre: string }
  /** textos de las notificaciones a Gerencia (Ajustes) */
  textos?: Partial<TextosAvisos>
}

/**
 * PDF de una factura que todavía no está en la plataforma: la sucursal escanea el mismo día que
 * factura y el ERP se carga al día siguiente. Al cargarlo, se une al legajo nuevo.
 */
export interface DocumentoEnEspera {
  id: string
  sucursal: string
  puntoVenta: number
  numero: number
  /** factura, orden o las dos juntas */
  tipo: 'factura' | 'orden' | 'documentacion'
  siniestro: string
  archivo: string
  url?: string
  subidoPor: string
  fecha: string
  nombreOriginal: string
  /** id de la factura a la que se unió (vacío mientras espera) */
  asociado?: string | null
}

export interface DatosApp {
  aseguradoras: Aseguradora[]
  comprobantes: Comprobante[]
  /** PDF de facturas de hoy que esperan la carga del ERP */
  enEspera?: DocumentoEnEspera[]
  cobrosPrevistos: CobroPrevisto[]
  meta: MetaDemo
}
