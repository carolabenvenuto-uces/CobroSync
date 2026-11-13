/**
 * Plazos de la documentación, distintos para las facturas MiPyME (factura de crédito electrónica).
 *
 * En Quiter una factura MiPyME se ve igual que cualquier otra ("FC E"), así que se reconoce por la
 * regla del régimen: se emite a una gran empresa (las compañías marcadas como "recibe FCE") y su
 * importe total llega al monto mínimo vigente. También se pueden indicar puntos de venta que se usen
 * solo para MiPyME.
 *
 * La compañía tiene pocos días para aceptar o rechazar una factura MiPyME: por eso su documentación
 * tiene un plazo más corto. Los números se cambian en Ajustes (Cobranzas) y se guardan en la
 * pestaña Config de Google.
 */
import type { Aseguradora, Comprobante } from './tipos'
import type { TextosAvisos } from './textos'

export interface Plazos {
  /** días que tiene la sucursal para subir la documentación de una factura común */
  comun: number
  /** ídem, factura MiPyME */
  mipyme: number
  /** desde estos días sin documentación, la factura común pasa a crítica (aviso a Gerencia) */
  criticaComun: number
  /** ídem, factura MiPyME */
  criticaMipyme: number
  /** monto mínimo de la factura de crédito electrónica MiPyME (importe total) */
  montoMinimoMipyme: number
  /** puntos de venta que se usan solo para facturas MiPyME (opcional) */
  puntosVentaMipyme: number[]
  /** días que se espera la respuesta de la compañía después de un reclamo */
  respuestaReclamo: number
  /**
   * Desde esta fecha de factura (yyyy-mm-dd) CobroSync pide la documentación. Las anteriores son
   * documentación en el Drive de la empresa: no se pide en la plataforma. Vacía: se pide todo.
   */
  inicio?: string
}

export const PLAZOS_INICIALES: Plazos = {
  comun: 10,
  mipyme: 5,
  criticaComun: 21,
  criticaMipyme: 12,
  montoMinimoMipyme: 5_549_862,
  puntosVentaMipyme: [],
  respuestaReclamo: 7,
  inicio: '',
}

let actuales: Plazos = PLAZOS_INICIALES
let sinFce = new Set<string>()
let tolerancias = new Map<string, number>()

/** Lo llama la aplicación cada vez que cambian los datos o los ajustes. */
export function configurarPlazos(plazos: Plazos | undefined, aseguradoras: Aseguradora[]): void {
  actuales = { ...PLAZOS_INICIALES, ...(plazos ?? {}) }
  // Las compañías son grandes empresas: reciben FCE salvo que se indique lo contrario
  sinFce = new Set(aseguradoras.filter((a) => a.recibeFce === false).map((a) => a.id))
  tolerancias = new Map(aseguradoras.filter((a) => Number(a.toleranciaReclamo) > 0).map((a) => [a.id, Number(a.toleranciaReclamo)]))
}

/** Días después del vencimiento antes de reclamarle a esta compañía (las que suelen pagar tienen más). */
export function toleranciaReclamo(aseguradoraId: string): number {
  return tolerancias.get(aseguradoraId) ?? 0
}

/** Factura emitida antes de que empezara CobroSync: no se le pide documentación. */
export function antesDelInicio(c: Pick<Comprobante, 'fecha'>): boolean {
  return !!actuales.inicio && c.fecha < actuales.inicio
}

export function plazosActuales(): Plazos {
  return actuales
}

export function esMipyme(c: Pick<Comprobante, 'tipo' | 'puntoVenta' | 'aseguradoraId' | 'total'>, p: Plazos = actuales): boolean {
  if (c.tipo !== 'FC') return false
  if (p.puntosVentaMipyme.includes(c.puntoVenta)) return true
  return !sinFce.has(c.aseguradoraId) && c.total >= p.montoMinimoMipyme
}

/** Días que tiene la sucursal para esta factura. */
export function plazoSucursal(c: Comprobante): number {
  return esMipyme(c) ? actuales.mipyme : actuales.comun
}

/** Desde cuántos días sin documentación esta factura es crítica. */
export function diasCritica(c: Comprobante): number {
  return esMipyme(c) ? actuales.criticaMipyme : actuales.criticaComun
}

/** "10 días (MiPyME: 5)" para los textos de ayuda. */
export function textoPlazo(p: Plazos = actuales): string {
  return `${p.comun} días (MiPyME: ${p.mipyme})`
}

export function textoCritica(p: Plazos = actuales): string {
  return `más de ${p.criticaComun} días (MiPyME: ${p.criticaMipyme})`
}

/** Lo que se cambia en la pantalla Ajustes (Cobranzas). */
export interface Ajustes {
  plazos: Plazos
  /** ids de las compañías que NO reciben factura de crédito MiPyME */
  companiasSinFce: string[]
  /** correoSoporte: la desarrolladora; recibe los reportes de problemas técnicos del Manual */
  avisos: { porMail: boolean; correosGerencia: string; correoSoporte?: string; nombreSoporte?: string }
  textos: TextosAvisos
}

export const AVISOS_INICIALES = { porMail: false, correosGerencia: '', correoSoporte: '', nombreSoporte: '' }
