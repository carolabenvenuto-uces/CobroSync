import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calcularTotales, proyeccionDelMes, serieSemanalDelMes, totalesDelMes } from '../src/domain/finanzas'
import { calcularImpacto, diasDeDemoraExtra, PARAMETROS_INICIALES } from '../src/domain/impacto'
import { esperaALaSucursal, rankingSucursales } from '../src/domain/sucursales'
import type { CobroPrevisto, Comprobante, Sucursal } from '../src/domain/tipos'

const leer = <T>(archivo: string): T =>
  JSON.parse(readFileSync(new URL(`../public/datos-demo/${archivo}`, import.meta.url), 'utf8')) as T

const comprobantes = leer<Comprobante[]>('comprobantes.json')
const cobrosPrevistos = leer<CobroPrevisto[]>('cobros-previstos.json')
const FECHA_CORTE = '2026-10-31'

describe('calcularTotales (sobre los datos de demo)', () => {
  const totales = calcularTotales(comprobantes, FECHA_CORTE)

  it('Pendiente = Facturado + NC − Cobrado', () => {
    expect(totales.pendiente).toBeCloseTo(totales.facturado + totales.notasCredito - totales.cobrado, 2)
  })

  it('el pendiente coincide con el saldo de las facturas sin cobrar ni anular', () => {
    const sinCobrar = comprobantes
      .filter((c) => c.tipo === 'FC' && c.estado !== 'cobrada' && c.estado !== 'anulada')
      .reduce((s, c) => s + c.total - (c.acreditado ?? 0), 0)
    expect(totales.pendiente).toBeCloseTo(sinCobrar, 2)
  })

  it('lo vencido nunca supera lo pendiente', () => {
    expect(totales.vencido).toBeLessThanOrEqual(totales.pendiente)
  })
})

describe('serie semanal y proyección', () => {
  it('la suma de las semanas da el total facturado y cobrado del mes', () => {
    const serie = serieSemanalDelMes(comprobantes, 2026, 10)
    const mes = totalesDelMes(comprobantes, 2026, 10)
    expect(serie.reduce((s, x) => s + x.facturado, 0)).toBeCloseTo(mes.facturado, 2)
    expect(serie.reduce((s, x) => s + x.cobrado, 0)).toBeCloseTo(mes.cobrado, 2)
  })

  it('noviembre tiene cobros proyectados por vencimiento y por aviso de las compañías', () => {
    const p = proyeccionDelMes(comprobantes, cobrosPrevistos, 2026, 11)
    expect(p.semanas).toHaveLength(5)
    expect(p.totalPorVencimiento).toBeGreaterThan(0)
    expect(p.totalInformado).toBeGreaterThan(0)
  })
})

describe('datos de demo', () => {
  it('los correos usan el dominio ficticio .example', () => {
    const aseguradoras = leer<{ email: string }[]>('aseguradoras.json')
    for (const a of aseguradoras) expect(a.email.endsWith('.example')).toBe(true)
  })
})

describe('impacto y ranking', () => {
  const p = PARAMETROS_INICIALES
  const espera = (c: Comprobante) => esperaALaSucursal(c, FECHA_CORTE)

  it('si se presenta dentro del objetivo, la demora extra es cero', () => {
    const c = comprobantes.find((x) => x.tipo === 'FC' && x.fechaPresentacion !== null)!
    expect(diasDeDemoraExtra(c, FECHA_CORTE, 999)).toBe(0)
  })

  it('el DSO posible nunca es mayor que el actual', () => {
    const i = calcularImpacto(comprobantes, FECHA_CORTE, 2026, p, espera)
    expect(i.dsoPosible as number).toBeLessThanOrEqual(i.dsoActual as number)
    expect(i.costoDelAnio).toBeGreaterThan(0)
  })

  it('lo retenido por sucursal suma lo retenido total', () => {
    const meta = leer<{ sucursales: Sucursal[] }>('meta.json')
    const ranking = rankingSucursales(comprobantes, meta.sucursales, FECHA_CORTE, 2026, null, p)
    const i = calcularImpacto(comprobantes, FECHA_CORTE, 2026, p, espera)
    expect(ranking).toHaveLength(6)
    expect(ranking.reduce((s, r) => s + r.retenido, 0)).toBeCloseTo(i.retenidoHoy, 2)
  })
})
