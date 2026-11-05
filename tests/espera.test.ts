import { describe, expect, it } from 'vitest'
import { facturaDeHoy, unirEnEspera } from '../src/domain/espera'
import type { Comprobante, DocumentoEnEspera } from '../src/domain/tipos'

const nueva = (extra: Partial<Comprobante> = {}): Comprobante => ({
  id: 'f9', ref: '9', tipo: 'FC', fecha: '2026-11-05', sucursal: 'Rocamora', puntoVenta: 35, numero: 11032, aseguradoraId: 'sancor',
  siniestro: '', patente: 'AA', total: 1000, fechaDrive: null, subidoPor: null, fechaPresentacion: null,
  vencimiento: null, fechaCobro: null, estado: 'pendiente_drive', ncReferencia: null, ncInformada: null, compromiso: null,
  reclamos: [], observaciones: '', documentos: [], eventos: [], ...extra,
}) as Comprobante
const espera = (extra: Partial<DocumentoEnEspera> = {}): DocumentoEnEspera => ({
  id: 'e1', sucursal: 'Rocamora', puntoVenta: 35, numero: 11032, tipo: 'documentacion', siniestro: '22365',
  archivo: '35-11032.pdf', subidoPor: 'Ana', fecha: '2026-11-05', nombreOriginal: '35-11032 siniestro 22365.pdf', ...extra,
})
const sucursal = { nombre: 'Rocamora', puntoVenta: 35, puntosVenta: [35, 36], gerente: 'G', personas: [] }

describe('PDF de facturas de hoy', () => {
  it('reconoce una factura de un punto de venta de la sucursal que todavía no existe', () => {
    expect(facturaDeHoy('35-11032 siniestro 22365.pdf', sucursal, [])).toEqual({ puntoVenta: 35, numero: 11032 })
    expect(facturaDeHoy('99-11032.pdf', sucursal, [])).toBe(null)
    expect(facturaDeHoy('35-11032.pdf', sucursal, [nueva()])).toBe(null)
  })
  it('al cargar el ERP, la factura nueva toma sus PDF y el siniestro', () => {
    const { comprobantes, unidos } = unirEnEspera([nueva()], [espera()], '2026-11-06')
    const c = comprobantes[0]
    expect(unidos).toEqual([{ id: 'e1', comprobanteId: 'f9' }])
    expect(c.documentos.map((d) => d.estado)).toEqual(['en_revision', 'en_revision'])
    expect(c.siniestro).toBe('22365')
    expect(c.estado).toBe('en_gestion')
    expect(c.eventos).toHaveLength(1)
  })
  it('no une PDF de otra sucursal ni los ya unidos', () => {
    expect(unirEnEspera([nueva()], [espera({ sucursal: 'Warnes' })], '2026-11-06').unidos).toHaveLength(0)
    expect(unirEnEspera([nueva()], [espera({ asociado: 'otra' })], '2026-11-06').unidos).toHaveLength(0)
  })
  it('una orden sola completa solo la orden', () => {
    const c = unirEnEspera([nueva()], [espera({ tipo: 'orden' })], '2026-11-06').comprobantes[0]
    expect(c.documentos.find((d) => d.tipo === 'orden')?.estado).toBe('en_revision')
    expect(c.documentos.find((d) => d.tipo === 'factura')?.estado).toBe('faltante')
  })
})
