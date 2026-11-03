/**
 * Reglas del semáforo operativo.
 *
 *  ROJO     → la sucursal pasó el plazo de 7 días sin subir el legajo completo,
 *             o un documento está ilegible o sin firma. No puede avanzar.
 *  AMARILLO → en curso. Para no mezclar responsabilidades se divide en etapas:
 *             esperando a la sucursal (dentro del plazo) · para presentar (auditoría)
 *             · esperando el pago (compañía).
 *  VERDE    → cobrado.
 *  NEUTRO   → notas de crédito y facturas anuladas.
 *
 * Estas reglas son conocimiento del negocio: por eso viven acá, separadas de las
 * pantallas, y tienen sus propios tests (tests/semaforo.test.ts).
 */
import { diffDias } from '../lib/fechas'
import type {
  ColorSemaforo,
  Comprobante,
  Documento,
  EstadoDocumento,
  Etapa,
  Responsable,
  TipoDocumento,
} from './tipos'

/** Días que tiene la sucursal para subir el legajo completo antes de pasar a rojo. */
export const PLAZO_ESCANEO_DIAS = 7
/** A partir de estos días sin legajo se avisa a la gerencia general. */
export const DIAS_ESCALAR_GERENCIA_GENERAL = 21

export const DOCUMENTOS_REQUERIDOS: TipoDocumento[] = ['factura', 'orden_reparacion', 'remito', 'conformidad']

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
  etapa: Etapa
  /** de quién depende que avance (null si ya está cerrado) */
  responsable: Responsable | null
  /** explicación en palabras: qué bloquea el legajo o en qué etapa está */
  detalle: string[]
}

/** Devuelve el documento de cada tipo requerido; si no existe, lo da por faltante. */
export function documentosDelLegajo(documentos: Documento[]): Documento[] {
  return DOCUMENTOS_REQUERIDOS.map(
    (tipo): Documento => documentos.find((d) => d.tipo === tipo) ?? { tipo, estado: 'faltante' },
  )
}

function textoProblema(d: Documento): string {
  return d.estado === 'faltante'
    ? `Falta ${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()}`
    : `${NOMBRE_DOCUMENTO[d.tipo]}: ${NOMBRE_ESTADO_DOCUMENTO[d.estado].toLowerCase()}`
}

export function calcularSemaforo(c: Comprobante, fechaCorte: string): ResultadoSemaforo {
  if (c.tipo === 'NC') return { color: 'neutro', etapa: 'no_aplica', responsable: null, detalle: ['Nota de crédito'] }
  if (c.estado === 'anulada') {
    return { color: 'neutro', etapa: 'no_aplica', responsable: null, detalle: ['Factura anulada con nota de crédito'] }
  }
  if (c.estado === 'cobrada') return { color: 'verde', etapa: 'cobrado', responsable: null, detalle: ['Cobrado'] }

  const documentos = documentosDelLegajo(c.documentos)
  const conProblemas = documentos.filter((d) => d.estado === 'ilegible' || d.estado === 'sin_firma')
  const faltantes = documentos.filter((d) => d.estado === 'faltante')

  // Un documento ilegible o sin firma bloquea siempre: ya se sabe que está mal.
  if (conProblemas.length > 0) {
    return {
      color: 'rojo',
      etapa: 'bloqueado',
      responsable: 'sucursal',
      detalle: [...conProblemas, ...faltantes].map(textoProblema),
    }
  }

  // Faltan documentos: la sucursal tiene 7 días desde la emisión de la factura.
  if (faltantes.length > 0) {
    const dias = diffDias(c.fecha, fechaCorte)
    const encabezado =
      c.fechaDrive === null ? 'La sucursal todavía no subió el legajo' : 'La sucursal subió el legajo incompleto'
    if (dias > PLAZO_ESCANEO_DIAS) {
      return {
        color: 'rojo',
        etapa: 'bloqueado',
        responsable: 'sucursal',
        detalle: [`${encabezado}: ${dias} días de atraso total`, ...faltantes.map(textoProblema)],
      }
    }
    return {
      color: 'amarillo',
      etapa: 'esperando_sucursal',
      responsable: 'sucursal',
      detalle: [`${encabezado} (día ${dias} de ${PLAZO_ESCANEO_DIAS})`, ...faltantes.map(textoProblema)],
    }
  }

  if (c.fechaPresentacion === null) {
    return {
      color: 'amarillo',
      etapa: 'para_presentar',
      responsable: 'auditoria',
      detalle: ['Legajo completo: listo para presentar a la compañía'],
    }
  }
  return {
    color: 'amarillo',
    etapa: 'esperando_pago',
    responsable: 'compania',
    detalle: ['Presentado: esperando el pago de la compañía'],
  }
}

/** Una factura presentada cuyo vencimiento ya pasó y todavía no se cobró. */
export function estaVencido(c: Comprobante, fechaCorte: string): boolean {
  return c.tipo === 'FC' && c.estado === 'presentada' && c.vencimiento !== null && c.vencimiento < fechaCorte
}

/** Solo se puede presentar un legajo completo que todavía no se presentó. */
export function puedePresentarse(c: Comprobante, fechaCorte: string): boolean {
  return calcularSemaforo(c, fechaCorte).etapa === 'para_presentar'
}
