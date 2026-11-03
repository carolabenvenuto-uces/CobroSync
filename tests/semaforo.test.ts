import { describe, expect, it } from 'vitest'
import { calcularSemaforo, estaVencido, puedePresentarse } from '../src/domain/semaforo'
import { avisoA, nivelEscaneo } from '../src/domain/sucursales'
import type { Comprobante, Documento } from '../src/domain/tipos'

const CORTE = '2026-10-31'

const completos: Documento[] = [
  { tipo: 'factura', estado: 'ok' },
  { tipo: 'orden_reparacion', estado: 'ok' },
  { tipo: 'remito', estado: 'ok' },
  { tipo: 'conformidad', estado: 'ok' },
]

/** Crea una factura completa y sin presentar; cada test cambia solo lo que necesita. */
function factura(cambios: Partial<Comprobante> = {}): Comprobante {
  return {
    id: 'fc-1',
    ref: '6900001',
    tipo: 'FC',
    fecha: '2026-10-20',
    sucursal: 'Sucursal Centro',
    puntoVenta: 21,
    numero: 5000,
    aseguradoraId: 'ceibo',
    siniestro: '1234567',
    patente: 'AB 123 CD',
    total: 1_000_000,
    fechaDrive: '2026-10-21',
    subidoPor: 'Lucía P.',
    fechaPresentacion: null,
    vencimiento: null,
    fechaCobro: null,
    estado: 'en_gestion',
    ncReferencia: null,
    ncInformada: null,
    compromiso: null,
    observaciones: '',
    documentos: completos,
    eventos: [],
    ...cambios,
  }
}

const sinOrden: Documento[] = completos.map((d) => (d.tipo === 'orden_reparacion' ? { ...d, estado: 'faltante' } : d))

describe('calcularSemaforo', () => {
  it('un legajo completo sin presentar le toca a auditoría y se puede presentar', () => {
    const c = factura()
    const r = calcularSemaforo(c, CORTE)
    expect(r.etapa).toBe('para_presentar')
    expect(r.responsable).toBe('auditoria')
    expect(puedePresentarse(c, CORTE)).toBe(true)
  })

  it('si falta un documento y la sucursal está dentro de los 7 días, está en AMARILLO', () => {
    const r = calcularSemaforo(factura({ fecha: '2026-10-26', documentos: sinOrden }), CORTE)
    expect(r.color).toBe('amarillo')
    expect(r.etapa).toBe('esperando_sucursal')
    expect(r.detalle).toContain('Falta orden de reparación')
  })

  it('el día 7 todavía está en plazo; el día 8 pasa a ROJO', () => {
    expect(calcularSemaforo(factura({ fecha: '2026-10-24', documentos: sinOrden }), CORTE).color).toBe('amarillo')
    expect(calcularSemaforo(factura({ fecha: '2026-10-23', documentos: sinOrden }), CORTE).color).toBe('rojo')
  })

  it('un documento sin firma bloquea en ROJO aunque esté dentro del plazo', () => {
    const c = factura({
      fecha: '2026-10-30',
      documentos: completos.map((d) => (d.tipo === 'conformidad' ? { ...d, estado: 'sin_firma' } : d)),
    })
    const r = calcularSemaforo(c, CORTE)
    expect(r.color).toBe('rojo')
    expect(r.detalle).toContain('Conformidad firmada: sin firma o sello')
    expect(puedePresentarse(c, CORTE)).toBe(false)
  })

  it('un documento que no figura en el legajo cuenta como faltante', () => {
    const r = calcularSemaforo(factura({ fecha: '2026-10-01', documentos: [{ tipo: 'factura', estado: 'ok' }] }), CORTE)
    expect(r.color).toBe('rojo')
    expect(r.detalle).toContain('Falta remito')
  })

  it('presentada y sin cobrar: le toca a la compañía', () => {
    const r = calcularSemaforo(factura({ estado: 'presentada', fechaPresentacion: '2026-10-22' }), CORTE)
    expect(r.etapa).toBe('esperando_pago')
    expect(r.responsable).toBe('compania')
  })

  it('una factura cobrada está en VERDE', () => {
    expect(calcularSemaforo(factura({ estado: 'cobrada', fechaCobro: '2026-10-29' }), CORTE).color).toBe('verde')
  })

  it('notas de crédito y facturas anuladas no se gestionan (NEUTRO)', () => {
    expect(calcularSemaforo(factura({ tipo: 'NC', total: -1000 }), CORTE).color).toBe('neutro')
    expect(calcularSemaforo(factura({ estado: 'anulada' }), CORTE).color).toBe('neutro')
  })
})

describe('escalamiento de escaneos', () => {
  const sucursal = { nombre: 'Sucursal Norte', puntoVenta: 35, gerente: 'S. Ferreyra', personas: [] }

  it('hasta 7 días está en plazo y no se avisa a nadie', () => {
    expect(nivelEscaneo(7)).toBe('en_plazo')
    expect(avisoA('en_plazo', sucursal)).toBe('—')
  })

  it('de 8 a 21 días se avisa al gerente de la sucursal', () => {
    expect(nivelEscaneo(8)).toBe('atrasado')
    expect(avisoA('atrasado', sucursal)).toBe('S. Ferreyra')
  })

  it('después de 21 días se suma la gerencia general', () => {
    expect(nivelEscaneo(22)).toBe('critico')
    expect(avisoA('critico', sucursal)).toBe('S. Ferreyra y gerencia general')
  })
})

describe('estaVencido', () => {
  const presentada = factura({ estado: 'presentada', fechaPresentacion: '2026-10-03', vencimiento: '2026-10-20' })

  it('una factura presentada con el vencimiento pasado está vencida', () => {
    expect(estaVencido(presentada, CORTE)).toBe(true)
  })

  it('no está vencida antes del vencimiento', () => {
    expect(estaVencido(presentada, '2026-10-15')).toBe(false)
  })

  it('una factura nunca presentada no puede estar vencida', () => {
    expect(estaVencido(factura({ fecha: '2026-06-01', fechaDrive: null }), CORTE)).toBe(false)
  })
})
