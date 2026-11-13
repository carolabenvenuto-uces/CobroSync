import { describe, expect, it } from 'vitest'
import { viaDe } from '../src/domain/canal'
import type { Aseguradora } from '../src/domain/tipos'

const cia = (extra: Partial<Aseguradora> = {}): Aseguradora => ({ id: 'x', nombre: 'X', email: '', plazoPagoDias: 30, ...extra })

describe('por dónde va cada factura', () => {
  it('mail o plataforma: todas igual', () => {
    expect(viaDe(cia(), { siniestro: '3001' })).toBe('mail')
    expect(viaDe(cia({ canal: 'portal' }), { siniestro: '2001' })).toBe('portal')
  })
  it('las dos: se divide por cómo empieza el siniestro', () => {
    const a = cia({ canal: 'ambas', siniestrosPorMail: '2', siniestrosPorPlataforma: '3' })
    expect(viaDe(a, { siniestro: '2045678' })).toBe('mail')
    expect(viaDe(a, { siniestro: ' 3045678' })).toBe('portal')
    expect(viaDe(a, { siniestro: '1045678' })).toBe('ambas')
    expect(viaDe(a, { siniestro: '' })).toBe('ambas')
  })
  it('las dos sin reglas: siempre las dos opciones', () => {
    expect(viaDe(cia({ canal: 'ambas' }), { siniestro: '2045678' })).toBe('ambas')
  })
  it('varios comienzos separados por coma', () => {
    const a = cia({ canal: 'ambas', siniestrosPorMail: '2, 41' })
    expect(viaDe(a, { siniestro: '4100' })).toBe('mail')
    expect(viaDe(a, { siniestro: '4200' })).toBe('ambas')
  })
})
