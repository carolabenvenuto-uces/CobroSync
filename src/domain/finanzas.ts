/**
 * Cálculos financieros: lo que hoy hacen las hojas "Saldos" y "Cobros Previstos"
 * con fórmulas, pero calculado siempre a partir de los comprobantes.
 *
 * Fórmula base (la misma de la planilla):
 *   Pendiente = Facturado + Notas de crédito (negativas) − Cobrado
 */
import { enMes, diffDias, semanaDelMes, semanasDelMes } from '../lib/fechas'
import { calcularSemaforo, estaVencido } from './semaforo'
import type { Aseguradora, CobroPrevisto, Comprobante } from './tipos'

export interface Totales {
  facturado: number
  notasCredito: number
  cobrado: number
  pendiente: number
  vencido: number
}

export function calcularTotales(comprobantes: Comprobante[], fechaCorte: string): Totales {
  let facturado = 0
  let notasCredito = 0
  let cobrado = 0
  let vencido = 0

  for (const c of comprobantes) {
    if (c.tipo === 'NC') {
      notasCredito += c.total
      continue
    }
    facturado += c.total
    if (c.estado === 'cobrada') cobrado += c.total
    if (estaVencido(c, fechaCorte)) vencido += c.total
  }

  return { facturado, notasCredito, cobrado, pendiente: facturado + notasCredito - cobrado, vencido }
}

export interface TotalesMes {
  facturado: number
  notasCredito: number
  cobrado: number
}

/** Facturado y NC por fecha de emisión; cobrado por fecha de cobro. */
export function totalesDelMes(comprobantes: Comprobante[], anio: number, mes: number): TotalesMes {
  let facturado = 0
  let notasCredito = 0
  let cobrado = 0
  for (const c of comprobantes) {
    if (c.tipo === 'NC' && enMes(c.fecha, anio, mes)) notasCredito += c.total
    if (c.tipo === 'FC' && enMes(c.fecha, anio, mes)) facturado += c.total
    if (c.estado === 'cobrada' && enMes(c.fechaCobro, anio, mes)) cobrado += c.total
  }
  return { facturado, notasCredito, cobrado }
}

export interface SaldoAseguradora extends Totales {
  aseguradora: Aseguradora
  legajosEnRojo: number
}

export function saldosPorAseguradora(
  comprobantes: Comprobante[],
  aseguradoras: Aseguradora[],
  fechaCorte: string,
): SaldoAseguradora[] {
  return aseguradoras
    .map((aseguradora) => {
      const propios = comprobantes.filter((c) => c.aseguradoraId === aseguradora.id)
      return {
        aseguradora,
        ...calcularTotales(propios, fechaCorte),
        legajosEnRojo: propios.filter((c) => calcularSemaforo(c).color === 'rojo').length,
      }
    })
    .sort((a, b) => b.pendiente - a.pendiente)
}

/**
 * DSO simplificado: días promedio entre la emisión de la factura y su cobro,
 * para las facturas cobradas en los últimos `ventanaDias` días.
 */
export function calcularDso(
  comprobantes: Comprobante[],
  fechaCorte: string,
  ventanaDias = 90,
): number | null {
  const dias = comprobantes
    .filter(
      (c) =>
        c.estado === 'cobrada' &&
        c.fechaCobro !== null &&
        diffDias(c.fechaCobro, fechaCorte) <= ventanaDias,
    )
    .map((c) => diffDias(c.fecha, c.fechaCobro as string))
  if (dias.length === 0) return null
  return Math.round(dias.reduce((s, d) => s + d, 0) / dias.length)
}

export interface PuntoSemanal {
  semana: string
  facturado: number
  cobrado: number
}

export function serieSemanalDelMes(comprobantes: Comprobante[], anio: number, mes: number): PuntoSemanal[] {
  const serie: PuntoSemanal[] = Array.from({ length: semanasDelMes(anio, mes) }, (_, i) => ({
    semana: `Semana ${i + 1}`,
    facturado: 0,
    cobrado: 0,
  }))
  for (const c of comprobantes) {
    if (c.tipo !== 'FC') continue
    if (enMes(c.fecha, anio, mes)) serie[semanaDelMes(c.fecha) - 1].facturado += c.total
    if (c.estado === 'cobrada' && enMes(c.fechaCobro, anio, mes)) {
      serie[semanaDelMes(c.fechaCobro) - 1].cobrado += c.total
    }
  }
  return serie
}

export interface SemanaProyeccion {
  semana: number
  /** facturas presentadas cuyo vencimiento cae en esa semana */
  porVencimiento: number
  /** pagos que las compañías informaron para esa semana */
  informado: number
}

export interface Proyeccion {
  semanas: SemanaProyeccion[]
  totalPorVencimiento: number
  totalInformado: number
}

/**
 * Proyección de cobros del mes: compara lo que "debería" entrar según el
 * vencimiento oficial de cada factura con lo que la compañía informó que va a pagar.
 */
export function proyeccionDelMes(
  comprobantes: Comprobante[],
  cobrosPrevistos: CobroPrevisto[],
  anio: number,
  mes: number,
): Proyeccion {
  const semanas: SemanaProyeccion[] = Array.from({ length: semanasDelMes(anio, mes) }, (_, i) => ({
    semana: i + 1,
    porVencimiento: 0,
    informado: 0,
  }))

  for (const c of comprobantes) {
    if (c.tipo === 'FC' && c.estado === 'presentada' && enMes(c.vencimiento, anio, mes)) {
      semanas[semanaDelMes(c.vencimiento) - 1].porVencimiento += c.total
    }
  }
  for (const cp of cobrosPrevistos) {
    if (cp.estado === 'informado' && enMes(cp.fechaIngreso, anio, mes)) {
      semanas[semanaDelMes(cp.fechaIngreso) - 1].informado += cp.monto
    }
  }

  return {
    semanas,
    totalPorVencimiento: semanas.reduce((s, x) => s + x.porVencimiento, 0),
    totalInformado: semanas.reduce((s, x) => s + x.informado, 0),
  }
}

export function proximosVencimientos(
  comprobantes: Comprobante[],
  aseguradoraId: string,
  fechaCorte: string,
  cantidad = 3,
): Comprobante[] {
  return comprobantes
    .filter(
      (c) =>
        c.aseguradoraId === aseguradoraId &&
        c.estado === 'presentada' &&
        c.vencimiento !== null &&
        c.vencimiento >= fechaCorte,
    )
    .sort((a, b) => (a.vencimiento ?? '').localeCompare(b.vencimiento ?? ''))
    .slice(0, cantidad)
}
