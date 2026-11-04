import { describe, expect, it } from 'vitest'
import { revisarNombre, sugerirFactura, tipoPorNombre } from '../src/domain/archivos'
import type { Comprobante } from '../src/domain/tipos'

const factura = (id: string, puntoVenta: number, numero: number, siniestro: string, patente: string, ref: string): Comprobante => ({
  id,
  ref,
  tipo: 'FC',
  fecha: '2026-10-20',
  sucursal: 'Rocamora',
  puntoVenta,
  numero,
  aseguradoraId: 'sancor',
  siniestro,
  patente,
  total: 1000,
  fechaDrive: null,
  subidoPor: null,
  fechaPresentacion: null,
  vencimiento: null,
  fechaCobro: null,
  estado: 'pendiente_drive',
  ncReferencia: null,
  ncInformada: null,
  compromiso: null,
  reclamos: [],
  observaciones: '',
  documentos: [],
  eventos: [],
})

const facturas = [
  factura('a', 35, 11032, '051-2-335854', 'AB123CD', '6977700'),
  factura('b', 35, 11033, '9566466', 'WG819UL', '6977701'),
  factura('c', 21, 11032, '1234567890', 'AA111AA', '6977702'),
]

describe('carga de varios archivos', () => {
  it('reconoce qué documento es por el nombre', () => {
    expect(tipoPorNombre('Orden 11032.pdf')).toBe('orden')
    expect(tipoPorNombre('firma_cliente.jpg')).toBe('orden')
    expect(tipoPorNombre('orden firmada 11032.pdf')).toBe('orden')
    expect(tipoPorNombre('FC 35-11032.pdf')).toBe('factura')
    expect(tipoPorNombre('scan0001.pdf')).toBe('documentacion')
    expect(tipoPorNombre('FC y orden 11032.pdf')).toBe('documentacion')
  })

  it('encuentra la factura por punto de venta y número', () => {
    expect(sugerirFactura('35-00011032 orden.pdf', facturas).factura?.id).toBe('a')
    expect(sugerirFactura('FC 21 11032.pdf', facturas).factura?.id).toBe('c')
  })

  it('si solo está el número y hay dos facturas con ese número, deja elegir', () => {
    const s = sugerirFactura('11032.pdf', facturas)
    expect(s.factura).toBe(null)
    expect(s.candidatas.map((c) => c.id).sort()).toEqual(['a', 'c'])
  })

  it('encuentra por siniestro, patente o referencia', () => {
    expect(sugerirFactura('siniestro 0512335854.pdf', facturas).factura?.id).toBe('a')
    expect(sugerirFactura('WG819UL firma.jpg', facturas).factura?.id).toBe('b')
    expect(sugerirFactura('6977702.pdf', facturas).por).toBe('referencia')
  })

  it('un escaneo sin datos queda para asignar a mano', () => {
    const s = sugerirFactura('scan0001.pdf', facturas)
    expect(s.factura).toBe(null)
    expect(s.candidatas).toHaveLength(0)
  })
})

describe('nombres obligatorios', () => {
  it('acepta un PDF con el número de una factura de la sucursal', () => {
    const r = revisarNombre('35-00011032 orden.pdf', facturas)
    expect(r.ok && r.factura.id).toBe('a')
    expect(r.tipo).toBe('orden')
    expect(revisarNombre('FC 35-11033.pdf', facturas).ok).toBe(true)
  })
  it('rechaza lo que no es PDF, lo que no tiene número y los números que no existen', () => {
    const foto = revisarNombre('35-00011032 orden.jpg', facturas)
    expect(!foto.ok && foto.error).toContain('PDF')
    const sinNumero = revisarNombre('scan0001.pdf', facturas)
    expect(!sinNumero.ok && sinNumero.error).toContain('no tiene el número')
    const mal = revisarNombre('35-00011099 orden.pdf', facturas)
    expect(!mal.ok && mal.error).toContain('35-11099')
  })
})
