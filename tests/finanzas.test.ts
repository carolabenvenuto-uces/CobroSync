import { readFileSync } from 'node:fs'
import { describe, expect, it } from 'vitest'
import { calcularTotales, proyeccionDelMes, serieSemanalDelMes, totalesDelMes } from '../src/domain/finanzas'
import type { CobroPrevisto, Comprobante } from '../src/domain/tipos'

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

  it('el pendiente coincide con la suma de facturas sin cobrar ni anular', () => {
    const sinCobrar = comprobantes
      .filter((c) => c.tipo === 'FC' && c.estado !== 'cobrada' && c.estado !== 'anulada')
      .reduce((s, c) => s + c.total, 0)
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
