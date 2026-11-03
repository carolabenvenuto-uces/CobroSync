import { describe, expect, it } from 'vitest'
import { calcularSemaforo, estaVencido, puedePresentarse } from '../src/domain/semaforo'
import type { Comprobante } from '../src/domain/tipos'

/** Crea una factura completa y sin presentar; cada test cambia solo lo que necesita. */
function factura(cambios: Partial<Comprobante> = {}): Comprobante {
  return {
    id: 'fc-1',
    ref: '6900001',
    tipo: 'FC',
    fecha: '2026-10-01',
    sucursal: 'Casa Central',
    puntoVenta: 21,
    numero: 5000,
    aseguradoraId: 'ceibo',
    siniestro: '1234567',
    patente: 'AB 123 CD',
    total: 1_000_000,
    fechaDrive: '2026-10-02',
    fechaPresentacion: null,
    vencimiento: null,
    fechaCobro: null,
    estado: 'en_gestion',
    ncReferencia: null,
    observaciones: '',
    documentos: [
      { tipo: 'factura', estado: 'ok' },
      { tipo: 'orden_reparacion', estado: 'ok' },
      { tipo: 'remito', estado: 'ok' },
      { tipo: 'conformidad', estado: 'ok' },
    ],
    ...cambios,
  }
}

describe('calcularSemaforo', () => {
  it('un legajo completo sin presentar está en AMARILLO y se puede presentar', () => {
    const c = factura()
    expect(calcularSemaforo(c).color).toBe('amarillo')
    expect(puedePresentarse(c)).toBe(true)
  })

  it('una orden sin firma pone el legajo en ROJO y bloquea la presentación', () => {
    const c = factura({
      documentos: [
        { tipo: 'factura', estado: 'ok' },
        { tipo: 'orden_reparacion', estado: 'sin_firma' },
        { tipo: 'remito', estado: 'ok' },
        { tipo: 'conformidad', estado: 'ok' },
      ],
    })
    const resultado = calcularSemaforo(c)
    expect(resultado.color).toBe('rojo')
    expect(resultado.detalle).toContain('Orden de reparación: sin firma o sello')
    expect(puedePresentarse(c)).toBe(false)
  })

  it('un documento que no figura en el legajo cuenta como faltante', () => {
    const c = factura({ documentos: [{ tipo: 'factura', estado: 'ok' }] })
    const resultado = calcularSemaforo(c)
    expect(resultado.color).toBe('rojo')
    expect(resultado.detalle).toContain('Falta remito')
  })

  it('si la sucursal no subió el legajo al Drive, está en ROJO', () => {
    const resultado = calcularSemaforo(factura({ fechaDrive: null }))
    expect(resultado.color).toBe('rojo')
    expect(resultado.detalle[0]).toBe('La sucursal todavía no subió el legajo')
  })

  it('una factura cobrada está en VERDE', () => {
    expect(calcularSemaforo(factura({ estado: 'cobrada', fechaCobro: '2026-10-20' })).color).toBe('verde')
  })

  it('notas de crédito y facturas anuladas no se gestionan (NEUTRO)', () => {
    expect(calcularSemaforo(factura({ tipo: 'NC', total: -1000 })).color).toBe('neutro')
    expect(calcularSemaforo(factura({ estado: 'anulada' })).color).toBe('neutro')
  })
})

describe('estaVencido', () => {
  const presentada = factura({
    estado: 'presentada',
    fechaPresentacion: '2026-10-03',
    vencimiento: '2026-10-20',
  })

  it('una factura presentada con el vencimiento pasado está vencida', () => {
    expect(estaVencido(presentada, '2026-10-31')).toBe(true)
  })

  it('no está vencida antes del vencimiento', () => {
    expect(estaVencido(presentada, '2026-10-15')).toBe(false)
  })
})
