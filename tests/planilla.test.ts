import { describe, expect, it } from 'vitest'
import { calcularSemaforo } from '../src/domain/semaforo'
import { fechaIso, importarPlanilla, importe } from '../src/services/planilla'

// Filas inventadas con el mismo formato que la hoja "Diario" exportada de Google Sheets
const CSV = [
  '"","","Sucursal","CTE.","Número","Compañia","Siniestro/Patente","","","","","","","","Estado","Notas de Crédito","","Observaciones"',
  '"","","","","","","","","","","","","","","","Anula","",""',
  '"","","C","D","E","F","5","","","","","","","","O","P","","0"',
  '"02-10-26","6990001","Rocamora","FC E","35 - 00009001","F. Patronal","111-2-333444","1.234.567,89","03-10-26","1","06-10-26","3","13-10-26","10-10-26","Cobrado","","",""',
  '"20-10-26","6990002","A. Thomas","FC E","21 - 00050001","Allianz","12345678901","500.000,00","21-10-26","1","22-10-26","1","21-11-26","","Al día","","",""',
  '"01-09-26","6990003","A. Thomas","FC E","21 - 00049001","Sancor","1234567890","750.000,00","","","","","","","D. Pend.","","","Se reclamó"',
  '"30-10-26","6990004","Triunvirato","FC E","19 - 00070001","Zurich","12345678","300.000,00","","","","","","","D. Pend.","","",""',
  '"28-10-26","6990005","V. Lopez","FC E","23 - 00030001","La Segunda","1234567","200.000,00","29-10-26","1","","","","","P. Pend.","","",""',
  '"15-10-26","6990006","Rocamora","NC E","35 - 00000501","F. Patronal","111-2-333444","(1.234.567,89)","","","","","","","NC","","",""',
].join('\n')

const HOY = '2026-11-03'

describe('lectura de la planilla', () => {
  const r = importarPlanilla(CSV, HOY)
  const porRef = (ref: string) => r.datos.comprobantes.find((c) => c.ref === ref)!

  it('lee todas las filas con fecha y sucursal', () => {
    expect(r.filasLeidas).toBe(6)
    expect(r.datos.meta.sucursales).toHaveLength(4)
    expect(r.ultimoMes).toBe(10)
  })

  it('interpreta fechas e importes con formato argentino', () => {
    expect(fechaIso('02-10-26')).toBe('2026-10-02')
    expect(fechaIso('2/10/2026')).toBe('2026-10-02')
    expect(importe('1.234.567,89')).toBeCloseTo(1234567.89, 2)
    expect(importe('(1.234.567,89)')).toBeCloseTo(-1234567.89, 2)
  })

  it('separa punto de venta y número del comprobante', () => {
    const c = porRef('6990001')
    expect(c.puntoVenta).toBe(35)
    expect(c.numero).toBe(9001)
  })

  it('traduce los estados de la planilla a etapas', () => {
    expect(calcularSemaforo(porRef('6990001'), HOY).etapa).toBe('cobrado')
    expect(calcularSemaforo(porRef('6990002'), HOY).etapa).toBe('al_dia')
    expect(calcularSemaforo(porRef('6990003'), HOY).etapa).toBe('doc_atrasada') // D. Pend. de septiembre
    expect(calcularSemaforo(porRef('6990004'), HOY).etapa).toBe('doc_pendiente') // D. Pend. de hace 4 días
    expect(calcularSemaforo(porRef('6990005'), HOY).etapa).toBe('pres_pendiente') // P. Pend.
    expect(calcularSemaforo(porRef('6990006'), HOY).etapa).toBe('no_aplica') // NC
  })

  it('Federación Patronal paga a 7 días; el resto a 30', () => {
    const patronal = r.datos.aseguradoras.find((a) => a.nombre === 'F. Patronal')!
    const allianz = r.datos.aseguradoras.find((a) => a.nombre === 'Allianz')!
    expect(patronal.plazoPagoDias).toBe(7)
    expect(allianz.plazoPagoDias).toBe(30)
  })

  it('las notas de crédito quedan en negativo', () => {
    expect(porRef('6990006').total).toBeLessThanOrEqual(0)
  })

  it('rechaza un archivo que no es la hoja Diario', () => {
    let mensaje = ''
    try {
      importarPlanilla('"a","b","c"\n"1","2","3"', HOY)
    } catch (e) {
      mensaje = (e as Error).message
    }
    expect(mensaje.includes('No reconozco el formato')).toBe(true)
  })
})
