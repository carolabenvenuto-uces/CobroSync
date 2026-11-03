/**
 * Seguimiento de las sucursales: plazos de escaneo, escalamiento y ranking.
 *
 * Regla acordada:
 *  - La sucursal tiene 7 días desde la emisión para subir el legajo completo.
 *  - Del día 8 al 21: atrasado → se avisa al gerente de la sucursal.
 *  - Más de 21 días: crítico → se avisa además a la gerencia general.
 */
import { diffDias, enMes, anioDe } from '../lib/fechas'
import { calcularSemaforo, DIAS_ESCALAR_GERENCIA_GENERAL, PLAZO_ESCANEO_DIAS } from './semaforo'
import { costoDemora, type ParametrosImpacto } from './impacto'
import type { Comprobante, Sucursal } from './tipos'

export type NivelEscaneo = 'en_plazo' | 'atrasado' | 'critico'

export const NOMBRE_NIVEL: Record<NivelEscaneo, string> = {
  en_plazo: 'En plazo',
  atrasado: 'Atrasado',
  critico: 'Crítico',
}

/** La factura espera algo de la sucursal (subir, completar o corregir documentos). */
export function esperaALaSucursal(c: Comprobante, fechaCorte: string): boolean {
  return c.tipo === 'FC' && calcularSemaforo(c, fechaCorte).responsable === 'sucursal'
}

export function diasDeEspera(c: Comprobante, fechaCorte: string): number {
  return diffDias(c.fecha, fechaCorte)
}

export function nivelEscaneo(dias: number): NivelEscaneo {
  if (dias <= PLAZO_ESCANEO_DIAS) return 'en_plazo'
  if (dias <= DIAS_ESCALAR_GERENCIA_GENERAL) return 'atrasado'
  return 'critico'
}

/** A quién se avisa según el nivel. */
export function avisoA(nivel: NivelEscaneo, sucursal: Sucursal | undefined): string {
  if (nivel === 'en_plazo') return '—'
  const gerente = sucursal ? sucursal.gerente : 'Gerente de sucursal'
  return nivel === 'atrasado' ? gerente : `${gerente} y gerencia general`
}

export function compromisoVencido(c: Comprobante, fechaCorte: string): boolean {
  return c.compromiso !== null && c.compromiso.fecha < fechaCorte && esperaALaSucursal(c, fechaCorte)
}

export interface ResumenSucursal {
  sucursal: Sucursal
  facturas: number
  /** días promedio entre la emisión y la primera subida del legajo */
  diasPromedioEscaneo: number | null
  /** % de facturas con legajo subido dentro de los 7 días */
  dentroDePlazoPct: number | null
  pendientes: number
  atrasados: number
  criticos: number
  compromisosVencidos: number
  ncSinInformar: number
  /** plata de facturas que esperan a la sucursal */
  retenido: number
  /** costo financiero estimado por demoras de presentación */
  costoDemora: number
}

/**
 * Ranking de sucursales. `mes` null = todo el año.
 * Los pendientes y lo retenido son siempre "a hoy"; el resto, del período elegido.
 */
export function rankingSucursales(
  comprobantes: Comprobante[],
  sucursales: Sucursal[],
  fechaCorte: string,
  anio: number,
  mes: number | null,
  parametros: ParametrosImpacto,
): ResumenSucursal[] {
  const enPeriodo = (iso: string) => (mes === null ? anioDe(iso) === anio : enMes(iso, anio, mes))

  return sucursales
    .map((sucursal): ResumenSucursal => {
      const propias = comprobantes.filter((c) => c.sucursal === sucursal.nombre)
      const facturas = propias.filter((c) => c.tipo === 'FC' && c.estado !== 'anulada' && enPeriodo(c.fecha))
      const subidas = facturas.filter((c) => c.fechaDrive !== null)
      const demoras = subidas.map((c) => diffDias(c.fecha, c.fechaDrive as string))
      const pendientes = propias.filter((c) => esperaALaSucursal(c, fechaCorte))
      const niveles = pendientes.map((c) => nivelEscaneo(diasDeEspera(c, fechaCorte)))

      return {
        sucursal,
        facturas: facturas.length,
        diasPromedioEscaneo:
          demoras.length === 0 ? null : Math.round((demoras.reduce((s, d) => s + d, 0) / demoras.length) * 10) / 10,
        dentroDePlazoPct:
          facturas.length === 0
            ? null
            : Math.round((demoras.filter((d) => d <= PLAZO_ESCANEO_DIAS).length / facturas.length) * 100),
        pendientes: pendientes.length,
        atrasados: niveles.filter((n) => n === 'atrasado').length,
        criticos: niveles.filter((n) => n === 'critico').length,
        compromisosVencidos: propias.filter((c) => compromisoVencido(c, fechaCorte)).length,
        ncSinInformar: propias.filter((c) => c.tipo === 'NC' && c.ncInformada === false).length,
        retenido: pendientes.reduce((s, c) => s + c.total, 0),
        costoDemora: facturas.reduce((s, c) => s + costoDemora(c, fechaCorte, parametros), 0),
      }
    })
    .sort((a, b) => (b.diasPromedioEscaneo ?? 0) - (a.diasPromedioEscaneo ?? 0))
}
