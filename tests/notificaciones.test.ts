import { describe, it, expect } from 'vitest'
import { partesDe } from '../src/lib/notificaciones'
describe('asunto', () => { it('separa factura y asunto', () => {
  const p = partesDe('Auditoría · FC E 21-11226: Observado: orden firmada (ilegible o cortado). Por favor, volver a subir.')
  expect(p.factura).toBe('FC E 21-11226'); expect(p.asunto).toBe('Observado')
  const q = partesDe('FC E 21-11090: Pasaron 10 días sin legajo completo: se avisó')
  expect(q.asunto).toBe('Pasaron 10 días sin legajo completo')
  expect(partesDe('Auditoría marcó como críticas 8 facturas de Triunvirato: falta').asunto).toBe('Auditoría marcó como críticas 8 facturas de Triunvirato')
})})
