import { describe, expect, it } from 'vitest'
import { paraResolver } from '../src/domain/resolver'
import type { Comprobante, Documento } from '../src/domain/tipos'

const HOY = '2026-10-31'
const faltan: Documento[] = [
  { tipo: 'factura', estado: 'faltante' },
  { tipo: 'orden', estado: 'faltante' },
]
const factura = (id: string, fecha: string, cambios: Partial<Comprobante> = {}): Comprobante => ({
  id, ref: id, tipo: 'FC', fecha, sucursal: 'Rocamora', puntoVenta: 35, numero: Number(id.replace(/\D/g, '')) || 1, aseguradoraId: 'sancor',
  siniestro: '', patente: '', total: 1000, fechaDrive: null, subidoPor: null, fechaPresentacion: null, vencimiento: null, fechaCobro: null,
  estado: 'pendiente_drive', ncReferencia: null, ncInformada: null, compromiso: null, reclamos: [], observaciones: '', documentos: faltan, eventos: [],
  ...cambios,
})

describe('para resolver (sucursal)', () => {
  it('primero lo observado, después lo fuera de plazo y lo que vence en 2 días; lo demás no', () => {
    const lista = paraResolver(
      [
        factura('1', '2026-10-30'), // en plazo, faltan 9 días: no
        factura('2', '2026-10-22'), // vence en 1 día
        factura('3', '2026-10-01'), // pasó el plazo
        factura('4', '2026-10-29', { documentos: [{ tipo: 'factura', estado: 'ok' }, { tipo: 'orden', estado: 'observado', motivo: 'Sin firma del cliente' }] }),
      ],
      HOY,
    )
    expect(lista.map((x) => x.c.id)).toEqual(['4', '3', '2'])
    expect(lista[0].motivo).toContain('orden firmada (sin firma del cliente)')
  })
  it('si la sucursal avisó una fecha que todavía no llegó, no se la apura', () => {
    const lista = paraResolver([factura('5', '2026-10-01', { compromiso: { fecha: '2026-11-05', motivo: 'El vehículo sigue en el taller' } })], HOY)
    expect(lista).toHaveLength(0)
  })
})
