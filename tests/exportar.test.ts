import { describe, expect, it } from 'vitest'
import { armarXlsx, fechaExcel, hojaXml } from '../src/lib/exportar'

describe('exportar a Excel', () => {
  it('cada dato va en su celda: textos, importes como números y fechas como fechas', () => {
    const x = hojaXml(['Fecha', 'Total', 'Obs.'], [[fechaExcel('2026-10-31'), 1234.5, 'A & <B>']])
    expect(x).toContain('<c r="A2" s="3"><v>46326</v></c>')
    expect(x).toContain('<c r="B2" s="2"><v>1234.5</v></c>')
    expect(x).toContain('A &amp; &lt;B&gt;')
    expect(x).toContain('<autoFilter ref="A1:C2"/>')
  })
  it('arma un archivo .xlsx (un ZIP que empieza con PK)', () => {
    const b = armarXlsx(['A'], [['x']])
    expect(b[0]).toBe(0x50)
    expect(b[1]).toBe(0x4b)
  })
  it('con encabezado de informe: título arriba y la tabla desde la fila 5', () => {
    const x = hojaXml(['Sucursal', 'Total'], [['Warnes', 10]], { titulo: 'Control por sucursal', subtitulo: 'CobroSync' })
    expect(x).toContain('<c r="A2" t="inlineStr" s="5"><is><t>Control por sucursal</t></is></c>')
    expect(x).toContain('<c r="A5" t="inlineStr" s="1">')
    expect(x).toContain('<autoFilter ref="A5:B6"/>')
  })
})
