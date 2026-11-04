import { describe, expect, it } from 'vitest'
import { calcularSemaforo, estaVencido, puedePresentarse } from '../src/domain/semaforo'
import { avisoA, nivelEscaneo } from '../src/domain/sucursales'
import { estadoReclamo } from '../src/domain/reclamos'
import { configurarPlazos, esMipyme, PLAZOS_INICIALES } from '../src/domain/plazos'
import type { Comprobante, Documento } from '../src/domain/tipos'

const CORTE = '2026-10-31'

const completos: Documento[] = [
  { tipo: 'factura', estado: 'ok' },
  { tipo: 'orden', estado: 'ok' },
  { tipo: 'firma', estado: 'ok' },
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
    reclamos: [],
    observaciones: '',
    documentos: completos,
    eventos: [],
    ...cambios,
  }
}

const sinOrden: Documento[] = completos.map((d) => (d.tipo === 'orden' ? { ...d, estado: 'faltante' } : d))

describe('calcularSemaforo', () => {
  it('un legajo completo sin presentar le toca a auditoría y se puede presentar', () => {
    const c = factura()
    const r = calcularSemaforo(c, CORTE)
    expect(r.etapa).toBe('pres_pendiente')
    expect(r.responsable).toBe('auditoria')
    expect(puedePresentarse(c, CORTE)).toBe(true)
  })

  it('si falta un documento y la sucursal está dentro de los 10 días, está en AMARILLO', () => {
    const r = calcularSemaforo(factura({ fecha: '2026-10-26', documentos: sinOrden }), CORTE)
    expect(r.color).toBe('amarillo')
    expect(r.etapa).toBe('doc_pendiente')
    expect(r.detalle).toContain('Falta orden de reparación o repuestos')
  })

  it('el día 10 todavía está en plazo; el día 11 pasa a ROJO', () => {
    expect(calcularSemaforo(factura({ fecha: '2026-10-21', documentos: sinOrden }), CORTE).color).toBe('amarillo')
    expect(calcularSemaforo(factura({ fecha: '2026-10-20', documentos: sinOrden }), CORTE).color).toBe('rojo')
  })

  it('una factura MiPyME (desde el monto mínimo) tiene 5 días', () => {
    const mipyme = (fecha: string) => factura({ fecha, total: 18_853_739.6, documentos: sinOrden })
    expect(esMipyme(mipyme('2026-10-26'))).toBe(true)
    expect(calcularSemaforo(mipyme('2026-10-26'), CORTE).color).toBe('amarillo')
    expect(calcularSemaforo(mipyme('2026-10-25'), CORTE).color).toBe('rojo')
    expect(calcularSemaforo(mipyme('2026-10-25'), CORTE).detalle[0]).toContain('MiPyME')
  })

  it('una compañía marcada como que no recibe FCE no tiene facturas MiPyME', () => {
    configurarPlazos(PLAZOS_INICIALES, [{ id: 'ceibo', nombre: 'Ceibo', email: '', plazoPagoDias: 30, recibeFce: false }])
    expect(esMipyme(factura({ total: 18_853_739.6 }))).toBe(false)
    configurarPlazos(PLAZOS_INICIALES, [])
  })

  it('un punto de venta solo para MiPyME marca la factura aunque sea chica', () => {
    configurarPlazos({ ...PLAZOS_INICIALES, puntosVentaMipyme: [50] }, [])
    expect(esMipyme(factura({ puntoVenta: 50, total: 1000 }))).toBe(true)
    configurarPlazos(PLAZOS_INICIALES, [])
  })

  it('un documento observado por Auditoría bloquea aunque esté dentro del plazo', () => {
    const c = factura({
      fecha: '2026-10-30',
      documentos: completos.map((d) => (d.tipo === 'firma' ? { ...d, estado: 'observado', motivo: 'Sin firma del cliente' } : d)),
    })
    const r = calcularSemaforo(c, CORTE)
    expect(r.etapa).toBe('doc_observada')
    expect(r.detalle).toContain('Firma del cliente: sin firma del cliente')
    expect(puedePresentarse(c, CORTE)).toBe(false)
  })

  it('subido y sin revisar: le toca a Auditoría tildarlo', () => {
    const c = factura({ documentos: completos.map((d) => ({ ...d, estado: 'en_revision' })) })
    const r = calcularSemaforo(c, CORTE)
    expect(r.etapa).toBe('en_revision')
    expect(r.responsable).toBe('auditoria')
    expect(puedePresentarse(c, CORTE)).toBe(false)
  })

  it('un documento que no figura en el legajo cuenta como faltante', () => {
    const r = calcularSemaforo(factura({ fecha: '2026-10-01', documentos: [{ tipo: 'factura', estado: 'ok' }] }), CORTE)
    expect(r.color).toBe('rojo')
    expect(r.detalle).toContain('Falta firma del cliente')
  })

  it('presentada y sin cobrar: le toca a la compañía', () => {
    const r = calcularSemaforo(factura({ estado: 'presentada', fechaPresentacion: '2026-10-22' }), CORTE)
    expect(r.etapa).toBe('al_dia')
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
  const comun = factura()
  const mipyme = factura({ total: 10_000_000 })
  const sucursal = { nombre: 'Sucursal Norte', puntoVenta: 35, gerente: 'S. Ferreyra', personas: [] }

  it('hasta 10 días está en plazo y no se avisa a nadie', () => {
    expect(nivelEscaneo(comun, 10)).toBe('en_plazo')
    expect(avisoA('en_plazo', sucursal)).toBe('—')
  })

  it('de 11 a 21 días se avisa al gerente de la sucursal', () => {
    expect(nivelEscaneo(comun, 11)).toBe('atrasado')
    expect(avisoA('atrasado', sucursal)).toBe('S. Ferreyra')
  })

  it('después de 21 días se suma la gerencia general', () => {
    expect(nivelEscaneo(comun, 22)).toBe('critico')
    expect(nivelEscaneo(mipyme, 6)).toBe('atrasado')
    expect(nivelEscaneo(mipyme, 13)).toBe('critico')
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

describe('facturas vencidas y reclamos', () => {
  const vencida = (reclamos: Comprobante['reclamos'], vencimiento = '2026-10-25') =>
    factura({ estado: 'presentada', fechaPresentacion: '2026-09-25', vencimiento, reclamos })

  it('una factura presentada y vencida queda en la etapa Vencida', () => {
    expect(calcularSemaforo(vencida([]), CORTE).etapa).toBe('vencida')
  })

  it('vencida sin reclamos: hay que reclamar', () => {
    expect(estadoReclamo(vencida([]), CORTE)).toBe('sin_reclamar')
  })

  it('con un reclamo reciente: se espera respuesta', () => {
    const r = [{ fecha: '2026-10-28', medio: 'mail' as const, autor: 'Carola B.', nota: '' }]
    expect(estadoReclamo(vencida(r), CORTE)).toBe('reclamada')
  })

  it('con 2 reclamos todavía no se escala, aunque lleve mucho tiempo vencida', () => {
    const r = [
      { fecha: '2026-06-15', medio: 'mail' as const, autor: 'Carola B.', nota: '' },
      { fecha: '2026-07-22', medio: 'portal' as const, autor: 'Carola B.', nota: '' },
    ]
    expect(estadoReclamo(vencida(r, '2026-06-10'), CORTE)).toBe('reclamada')
  })

  it('con 3 reclamos sin respuesta se escala a gerencia', () => {
    const r = ['2026-10-12', '2026-10-19', '2026-10-26'].map((fecha) => ({ fecha, medio: 'mail' as const, autor: 'Carola B.', nota: '' }))
    expect(estadoReclamo(vencida(r, '2026-10-10'), CORTE)).toBe('escalar')
  })

  it('una factura al día no tiene estado de reclamo', () => {
    expect(estadoReclamo(vencida([], '2026-11-15'), CORTE)).toBe(null)
  })
})
