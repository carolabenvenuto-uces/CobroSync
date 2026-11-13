import { describe, expect, it } from 'vitest'
import { armarTexto, configurarTextos, textoAviso, TEXTOS_INICIALES } from '../src/domain/textos'

describe('textos de las notificaciones a Gerencia', () => {
  it('completa los datos entre llaves', () => {
    expect(armarTexto(TEXTOS_INICIALES.apoyo, { compania: 'Sancor', cantidad: 2 })).toBe(
      'Cobranzas solicita su apoyo con Sancor: la compañía no responde los reclamos de 2 facturas vencidas.',
    )
    expect(armarTexto('{facturas} de {sucursal}', { sucursal: 'Warnes', cantidad: 1 })).toBe('una factura de Warnes')
  })
  it('usa el texto de Ajustes y, si está vacío, el original', () => {
    configurarTextos({ apoyo: 'Pedimos ayuda con {compania}', critica: '' })
    expect(textoAviso('apoyo', { compania: 'Allianz', cantidad: 3 })).toBe('Pedimos ayuda con Allianz')
    expect(textoAviso('critica', { sucursal: 'Rocamora', cantidad: 2, dias: 21 })).toContain('2 facturas de Rocamora')
    configurarTextos(undefined)
  })
})
