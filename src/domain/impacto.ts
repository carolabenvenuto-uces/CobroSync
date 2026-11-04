/**
 * Impacto económico de las demoras.
 *
 * Idea: cada día que una factura tarda en presentarse por encima de un objetivo
 * razonable es un día más que la plata tarda en entrar. Esa plata "inmovilizada"
 * tiene un costo financiero:
 *
 *   costo = importe × días de demora extra × (tasa anual / 365)
 *
 * Es una estimación para dimensionar el problema, no un cálculo contable.
 * La tasa y el objetivo de días se pueden ajustar en pantalla.
 */
import { anioDe, diffDias, mesDe } from '../lib/fechas'
import { saldoFactura, saldoSinCobro } from './importes'
import type { Comprobante } from './tipos'

export interface ParametrosImpacto {
  /** tasa anual en %, la que use la empresa para valuar el dinero */
  tasaAnualPct: number
  /** días razonables entre la emisión de la factura y su presentación */
  objetivoDias: number
}

export const PARAMETROS_INICIALES: ParametrosImpacto = { tasaAnualPct: 35, objetivoDias: 3 }

/**
 * Días de demora por encima del objetivo, desde la emisión hasta la presentación.
 * Si todavía no se presentó, se cuenta hasta hoy.
 */
export function diasDeDemoraExtra(c: Comprobante, fechaCorte: string, objetivoDias: number): number {
  if (c.tipo !== 'FC' || c.estado === 'anulada') return 0
  const hasta = c.fechaPresentacion ?? fechaCorte
  return Math.max(0, diffDias(c.fecha, hasta) - objetivoDias)
}

export function costoDemora(c: Comprobante, fechaCorte: string, p: ParametrosImpacto): number {
  return (saldoSinCobro(c) * diasDeDemoraExtra(c, fechaCorte, p.objetivoDias) * p.tasaAnualPct) / 100 / 365
}

export interface Impacto {
  /** facturas que hoy no se pueden presentar por falta de documentación */
  retenidoHoy: number
  legajosRetenidos: number
  /** costo financiero estimado de las demoras en el año */
  costoDelAnio: number
  /** demora extra promedio por factura (días por encima del objetivo) */
  diasExtraPromedio: number
  /** DSO actual de las facturas cobradas en el año */
  dsoActual: number | null
  /** DSO si todas se hubieran presentado dentro del objetivo */
  dsoPosible: number | null
  costoPorMes: { mes: number; costo: number }[]
}

export function calcularImpacto(
  comprobantes: Comprobante[],
  fechaCorte: string,
  anio: number,
  p: ParametrosImpacto,
  esperaALaSucursal: (c: Comprobante) => boolean,
): Impacto {
  const facturas = comprobantes.filter((c) => c.tipo === 'FC' && c.estado !== 'anulada' && anioDe(c.fecha) === anio)
  const retenidas = comprobantes.filter(esperaALaSucursal)
  const cobradas = facturas.filter((c) => c.estado === 'cobrada' && c.fechaCobro !== null)

  const costoPorMes = Array.from({ length: 12 }, (_, i) => ({ mes: i + 1, costo: 0 }))
  let costoDelAnio = 0
  let diasExtra = 0
  for (const c of facturas) {
    const costo = costoDemora(c, fechaCorte, p)
    costoDelAnio += costo
    costoPorMes[mesDe(c.fecha) - 1].costo += costo
    diasExtra += diasDeDemoraExtra(c, fechaCorte, p.objetivoDias)
  }

  const promedio = (valores: number[]) =>
    valores.length === 0 ? null : Math.round(valores.reduce((s, v) => s + v, 0) / valores.length)

  return {
    retenidoHoy: retenidas.reduce((s, c) => s + saldoFactura(c), 0),
    legajosRetenidos: retenidas.length,
    costoDelAnio,
    diasExtraPromedio: facturas.length === 0 ? 0 : Math.round((diasExtra / facturas.length) * 10) / 10,
    dsoActual: promedio(cobradas.map((c) => diffDias(c.fecha, c.fechaCobro as string))),
    dsoPosible: promedio(
      cobradas.map((c) => diffDias(c.fecha, c.fechaCobro as string) - diasDeDemoraExtra(c, fechaCorte, p.objetivoDias)),
    ),
    costoPorMes: costoPorMes.filter((m) => m.mes <= (anioDe(fechaCorte) === anio ? mesDe(fechaCorte) : 12)),
  }
}
