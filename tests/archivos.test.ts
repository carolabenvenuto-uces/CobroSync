import { describe, expect, it } from 'vitest'
import { patenteDelNombre, revisarNombre, siniestroDelNombre, sugerirFactura, tipoPorNombre } from '../src/domain/archivos'
import { limpiarSiniestro } from '../src/domain/siniestros'
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
    expect(tipoPorNombre('35-11032 fc.pdf')).toBe('factura')
    // "FC 35-11032" es el número de la factura: no dice qué documento es
    expect(tipoPorNombre('FC 35-11032.pdf')).toBe('documentacion')
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
    expect(!sinNumero.ok && sinNumero.error).toContain('Falta el número de factura')
    const mal = revisarNombre('35-00011099 orden.pdf', facturas)
    expect(!mal.ok && mal.error).toContain('35-11099')
  })
})

describe('nombres flexibles', () => {
  const lista = [factura('x', 21, 20755, '', '', '8457091'), factura('y', 35, 11032, '', '', '6977700')]
  it('la factura con o sin ceros y con cualquier separador; pegada no (podría ser un siniestro)', () => {
    for (const n of ['21-20755.pdf', '0021-00020755.pdf', '21 20755 orden.pdf', '21.20755.pdf', '21_00020755.pdf', 'FC E 21-20755.pdf'])
      expect(revisarNombre(n, lista).ok, n).toBe(true)
    expect(revisarNombre('2100020755.pdf', lista).ok).toBe(false)
  })
  it('un siniestro no se toma por factura', () => {
    const r = revisarNombre('21-20755 20 02 92907.pdf', lista)
    expect(r.ok && r.factura.id).toBe('x')
    expect(revisarNombre('20 02 92907.pdf', lista).ok).toBe(false)
  })
  it('el siniestro con la palabra bien, abreviada o mal escrita', () => {
    const c = { puntoVenta: 21, numero: 20755 }
    expect(siniestroDelNombre('21-20755 siniestro 22365.pdf', c)).toBe('22365')
    expect(siniestroDelNombre('21-20755 sinestro 22365.pdf', c)).toBe('22365')
    expect(siniestroDelNombre('21-20755 siniesto 029-9-506622.pdf', c)).toBe('029-9-506622')
    expect(siniestroDelNombre('21-20755 sin. 6498-05.pdf', c)).toBe('6498-05')
    expect(siniestroDelNombre('0021-00020755 stro 22365.pdf', c)).toBe('22365')
  })
  it('el siniestro sin la palabra, si es un número aparte del de la factura', () => {
    const c = { puntoVenta: 21, numero: 20755 }
    expect(siniestroDelNombre('21-20755 029-9-506622.pdf', c)).toBe('029-9-506622')
    expect(siniestroDelNombre('2100020755 22365.pdf', c)).toBe('22365')
    expect(siniestroDelNombre('21-20755 orden.pdf', c)).toBe(null)
    expect(siniestroDelNombre('21-20755 15-11-26.pdf', c)).toBe(null) // una fecha no es un siniestro
  })
})

describe('siniestros de Allianz con dos números', () => {
  it('toma el segundo número y deja como están los siniestros con guiones cortos', () => {
    expect(limpiarSiniestro('0042605268-0042584578')).toBe('0042584578')
    expect(limpiarSiniestro(' 0042605268 - 0042584578 ')).toBe('0042584578')
    expect(limpiarSiniestro('C0042601693117-0042601893777')).toBe('0042601893777')
    expect(siniestroDelNombre('23-6400 SINIESTRO ALLIANZ AF601TS C0042601693117-0042601893777.pdf', { puntoVenta: 23, numero: 6400 })).toBe('0042601893777')
    expect(limpiarSiniestro('029-9-506622')).toBe('029-9-506622')
    expect(limpiarSiniestro('6498-05')).toBe('6498-05')
    expect(siniestroDelNombre('21-20755 siniestro 0042605268-0042584578.pdf', { puntoVenta: 21, numero: 20755 })).toBe('0042584578')
    expect(siniestroDelNombre('21-20755 0042605268-0042584578.pdf', { puntoVenta: 21, numero: 20755 })).toBe('0042584578')
  })
})

describe('patente en el nombre del archivo', () => {
  it('toma el formato viejo y el Mercosur, y no confunde la palabra siniestro', () => {
    expect(patenteDelNombre('21-17226 AB123CD.pdf')).toBe('AB123CD')
    expect(patenteDelNombre('21-17226 siniestro 22365 abc123.pdf')).toBe('ABC123')
    expect(patenteDelNombre('21-17226 ab 123 cd orden.pdf')).toBe('AB123CD')
    expect(patenteDelNombre('21-17226 sin 223.pdf')).toBe(null)
    expect(patenteDelNombre('21-17226 siniestro 22365.pdf')).toBe(null)
    expect(patenteDelNombre('0021-00017226 fc.pdf')).toBe(null)
  })
})
