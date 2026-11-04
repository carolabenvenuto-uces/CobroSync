import { describe, expect, it } from 'vitest'
import { configurarPlazos } from '../src/domain/plazos'
import { atendidaPorOtra, pedidosAbiertos } from '../src/domain/pedidos'
import { cambiosPorRespuesta, estadoReclamo } from '../src/domain/reclamos'
import type { Comprobante } from '../src/domain/tipos'

const CORTE = '2026-10-31'
const base = (extra: Partial<Comprobante> = {}): Comprobante => ({
  id: 'f1', ref: '1', tipo: 'FC', fecha: '2026-08-01', sucursal: 'Rocamora', puntoVenta: 35, numero: 1, aseguradoraId: 'sancor',
  siniestro: '1', patente: 'AA', total: 1000, fechaDrive: '2026-08-02', subidoPor: 'x', fechaPresentacion: '2026-08-10',
  vencimiento: '2026-09-10', fechaCobro: null, estado: 'presentada', ncReferencia: null, ncInformada: null, compromiso: null,
  reclamos: [], observaciones: '', documentos: [], eventos: [], ...extra,
})
const reclamo = (fecha: string) => ({ fecha, medio: 'mail' as const, autor: 'A', nota: '' })

describe('reclamos con respuesta y tolerancia', () => {
  it('una compañía con tolerancia no se reclama hasta que pasen esos días', () => {
    configurarPlazos(undefined, [{ id: 'sancor', nombre: 'Sancor', email: '', plazoPagoDias: 30, toleranciaReclamo: 60 }])
    expect(estadoReclamo(base({ vencimiento: '2026-10-01' }), CORTE)).toBe('tolerancia')
    expect(estadoReclamo(base({ vencimiento: '2026-08-01' }), CORTE)).toBe('sin_reclamar')
    configurarPlazos(undefined, [])
  })
  it('"pasa a pagos" espera un mes; después hay que volver a reclamar', () => {
    const r = cambiosPorRespuesta(base({ reclamos: [reclamo('2026-10-20')] }), 'pagos', '', '2026-10-25', 'A')!
    expect(estadoReclamo(base(r.campos), CORTE)).toBe('en_pagos')
    expect(estadoReclamo(base(r.campos), '2026-12-10')).toBe('volver')
  })
  it('"reenviar la documentación" la devuelve a Presentar', () => {
    const r = cambiosPorRespuesta(base({ reclamos: [reclamo('2026-10-20')] }), 'documentacion', 'falta la orden', CORTE, 'A')!
    expect(r.campos.reenviar).toBe(true)
    expect(estadoReclamo(base(r.campos), CORTE)).toBe('reenviar')
  })
  it('"refacturar" abre un pedido a la sucursal y deja de contar para pedir apoyo', () => {
    const tres = ['2026-09-01', '2026-09-10', '2026-09-20'].map(reclamo)
    const r = cambiosPorRespuesta(base({ reclamos: tres }), 'refacturar', 'monto mal', CORTE, 'A')!
    const c = base(r.campos)
    expect(estadoReclamo(c, CORTE)).toBe('refacturar')
    expect(pedidosAbiertos([c], CORTE).map((p) => p.pedido.tipo)).toEqual(['refacturar'])
  })
})

describe('pedidos a sucursales', () => {
  it('una nota de crédito sin aviso genera su pedido sola', () => {
    const nc = base({ id: 'n1', tipo: 'NC', total: -100, ncInformada: false, estado: 'nota_credito' })
    const lista = pedidosAbiertos([nc, base()], CORTE)
    expect(lista).toHaveLength(1)
    expect(lista[0].automatico).toBe(true)
  })
  it('lo respondido queda para cerrar y lo cerrado ya no aparece', () => {
    const c = base({
      pedidos: [
        { id: 'a', fecha: '2026-10-01', tipo: 'error_factura', detalle: 'x', autor: 'A' },
        { id: 'b', fecha: '2026-10-02', tipo: 'otro', detalle: 'y', autor: 'A', respuesta: { fecha: '2026-10-03', autor: 'S', texto: 'listo' } },
        { id: 'c', fecha: '2026-10-02', tipo: 'otro', detalle: 'z', autor: 'A', cerrado: { fecha: '2026-10-04', autor: 'A' } },
      ],
    })
    const lista = pedidosAbiertos([c], CORTE)
    expect(lista.map((p) => [p.pedido.id, p.estado])).toEqual([['a', 'esperando'], ['b', 'respondido']])
  })
  it('una factura tomada por otra persona de Auditoría avisa quién la tiene, hasta que vence', () => {
    const c = base({ atendiendo: { por: 'Melina', hasta: '2026-10-31T12:20:00Z' } })
    expect(atendidaPorOtra(c, 'Carola', new Date('2026-10-31T12:00:00Z'))).toBe('Melina')
    expect(atendidaPorOtra(c, 'Melina', new Date('2026-10-31T12:00:00Z'))).toBe(null)
    expect(atendidaPorOtra(c, 'Carola', new Date('2026-10-31T12:30:00Z'))).toBe(null)
  })
})
