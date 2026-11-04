/**
 * Reglas del semáforo operativo.
 *
 * Etapas, con el vocabulario de la planilla de control:
 *  Doc. pendiente → falta documentación y la sucursal está dentro de los 7 días
 *  Doc. atrasada  → falta documentación y pasaron más de 7 días (D. Pend. atrasada)
 *  Doc. observada → Auditoría observó un documento (ilegible, sin firma…)
 *  En revisión    → la sucursal subió todo y Auditoría tiene que tildarlo
 *  Pres. pendiente→ legajo completo, falta presentarlo (P. Pend.)
 *  Al día         → presentada y todavía no venció
 *  Vencida        → presentada, vencida y sin cobrar: hay que reclamar
 *  Cobrado · No aplica (NC y anuladas)
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

export const DOCUMENTOS_REQUERIDOS: TipoDocumento[] = ['factura', 'orden', 'firma']

export const NOMBRE_DOCUMENTO: Record<TipoDocumento, string> = {
  factura: 'Factura',
  orden: 'Orden de reparación o repuestos',
  firma: 'Firma del cliente',
}

export const NOMBRE_ESTADO_DOCUMENTO: Record<EstadoDocumento, string> = {
  faltante: 'Falta',
  en_revision: 'Para revisar',
  ok: 'Aprobado',
  observado: 'Observado',
}

/** Motivos con los que Auditoría puede observar un documento. */
export const MOTIVOS_OBSERVACION = ['Ilegible o cortado', 'Sin firma del cliente', 'No corresponde a esta factura', 'Incompleto'] as const

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
  if (d.estado === 'faltante') return `Falta ${NOMBRE_DOCUMENTO[d.tipo].toLowerCase()}`
  if (d.estado === 'observado') return `${NOMBRE_DOCUMENTO[d.tipo]}: ${(d.motivo ?? 'observado').toLowerCase()}`
  return `${NOMBRE_DOCUMENTO[d.tipo]}: ${NOMBRE_ESTADO_DOCUMENTO[d.estado].toLowerCase()}`
}

export function calcularSemaforo(c: Comprobante, fechaCorte: string): ResultadoSemaforo {
  if (c.tipo === 'NC') return { color: 'neutro', etapa: 'no_aplica', responsable: null, detalle: ['Nota de crédito'] }
  if (c.estado === 'anulada') {
    return { color: 'neutro', etapa: 'no_aplica', responsable: null, detalle: ['Factura anulada con nota de crédito'] }
  }
  if (c.estado === 'cobrada') return { color: 'verde', etapa: 'cobrado', responsable: null, detalle: ['Cobrada'] }
  // La sucursal avisó que se anula toda la factura: ya no se le pide documentación; Auditoría confirma
  // (una NC parcial no frena nada: la factura sigue vigente por su saldo)
  if (c.anulacionInformada && !c.anulacionInformada.parcial) {
    return {
      color: 'neutro',
      etapa: 'no_aplica',
      responsable: 'auditoria',
      detalle: [`La sucursal informó que se anula con nota de crédito: ${c.anulacionInformada.motivo}`],
    }
  }

  const documentos = documentosDelLegajo(c.documentos)
  const conProblemas = documentos.filter((d) => d.estado === 'observado')
  const faltantes = documentos.filter((d) => d.estado === 'faltante')
  const paraRevisar = documentos.filter((d) => d.estado === 'en_revision')
  const dias = diffDias(c.fecha, fechaCorte)

  // Un documento observado por Auditoría bloquea siempre: la sucursal tiene que reemplazarlo.
  if (conProblemas.length > 0) {
    return {
      color: 'rojo',
      etapa: 'doc_observada',
      responsable: 'sucursal',
      detalle: [...conProblemas, ...faltantes].map(textoProblema),
    }
  }

  // Faltan documentos: la sucursal tiene 7 días desde la emisión de la factura.
  if (faltantes.length > 0) {
    const encabezado =
      c.fechaDrive === null ? 'La sucursal todavía no subió el legajo' : 'La sucursal subió el legajo incompleto'
    if (dias > PLAZO_ESCANEO_DIAS) {
      return {
        color: 'rojo',
        etapa: 'doc_atrasada',
        responsable: 'sucursal',
        detalle: [`${encabezado}: ${dias} días desde la factura`, ...faltantes.map(textoProblema)],
      }
    }
    return {
      color: 'amarillo',
      etapa: 'doc_pendiente',
      responsable: 'sucursal',
      detalle: [`${encabezado} (día ${dias} de ${PLAZO_ESCANEO_DIAS})`, ...faltantes.map(textoProblema)],
    }
  }

  // La sucursal subió todo: Auditoría revisa y tilda cada documento.
  if (paraRevisar.length > 0) {
    return {
      color: 'amarillo',
      etapa: 'en_revision',
      responsable: 'auditoria',
      detalle: [`Para revisar: ${paraRevisar.map((d) => NOMBRE_DOCUMENTO[d.tipo].toLowerCase()).join(', ')}`],
    }
  }

  if (c.fechaPresentacion === null) {
    return {
      color: 'amarillo',
      etapa: 'pres_pendiente',
      responsable: 'auditoria',
      detalle: ['Legajo completo: falta presentarlo a la compañía'],
    }
  }
  if (c.vencimiento !== null && c.vencimiento < fechaCorte) {
    const diasVencida = diffDias(c.vencimiento, fechaCorte)
    return {
      color: 'rojo',
      etapa: 'vencida',
      responsable: 'compania',
      detalle: [
        `Vencida hace ${diasVencida} días sin cobrar`,
        c.reclamos.length === 0 ? 'Todavía no se reclamó' : `Reclamada ${c.reclamos.length} ${c.reclamos.length === 1 ? 'vez' : 'veces'}`,
      ],
    }
  }
  return {
    color: 'amarillo',
    etapa: 'al_dia',
    responsable: 'compania',
    detalle: [c.vencimiento ? `Presentada: vence el ${c.vencimiento.split('-').reverse().join('/')}` : 'Presentada: esperando el pago'],
  }
}

/** Una factura presentada cuyo vencimiento ya pasó y todavía no se cobró. */
export function estaVencido(c: Comprobante, fechaCorte: string): boolean {
  return c.tipo === 'FC' && c.estado === 'presentada' && c.vencimiento !== null && c.vencimiento < fechaCorte
}

/** Solo se puede presentar un legajo completo que todavía no se presentó. */
export function puedePresentarse(c: Comprobante, fechaCorte: string): boolean {
  return calcularSemaforo(c, fechaCorte).etapa === 'pres_pendiente'
}

/** Etapas en las que la factura espera algo de la sucursal. */
export const ETAPAS_SUCURSAL = ['doc_pendiente', 'doc_atrasada', 'doc_observada'] as const
