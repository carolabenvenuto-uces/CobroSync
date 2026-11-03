import { describe, expect, it } from 'vitest'
import type { Aseguradora, Comprobante, Sucursal } from '../src/domain/tipos'
import { importarCompanias } from '../src/services/companias'
import { importarErp, numeroDesde } from '../src/services/erp'

// Filas inventadas con el formato de la exportación de facturas del ERP (hoja "Quiter")
const CSV = [
  'Refer.;Fecha;TC;Clase;BOCA;Número;Nombre;TIVA;CUIT;Exento;Base imp.;IVA21;IVA10.5;Internos;Per IIBB;Per IIBB Cap;Imp. total',
  '7990001;30/10/26;FC E;A;21;De 00004570 a 00004570;ALLIANZ ARGENTINA COMPAÑIA DE SEGUROS;RI;30-50003721-7;0;1.000.000,00;210.000,00;0;0;0;0;1.210.000,00',
  '7990002;30/10/26;NC E;A;35;De 00000801 a 00000801;FEDERACION PATRONAL SEGUROS SAU;RI;33707366589;0;100.000,00;21.000,00;0;0;0;0;121.000,00',
  '7990003;30/10/26;FC E;A;21;De 00004571 a 00004571;JUAN CLIENTE PARTICULAR;CF;20111111112;0;10,00;2,10;0;0;0;0;12,10',
  '7990004;30/10/26;FC E;A;21;De 00004572 a 00004572;ALLIANZ ARGENTINA COMPAÑIA DE SEGUROS;RI;30500037217;0;1,00;0;0;0;0;0;1,00',
].join('\n')

const aseguradoras: Aseguradora[] = [
  { id: 'allianz', nombre: 'Allianz', razonSocial: 'ALLIANZ ARGENTINA COMPAÑIA DE SEGUROS', cuit: '30500037217', email: '', plazoPagoDias: 30 },
  { id: 'fed-patronal', nombre: 'Federación Patronal', cuit: '33707366589', email: '', plazoPagoDias: 7 },
]
const sucursales: Sucursal[] = [
  { nombre: 'Alvarez Thomas', puntoVenta: 21, puntosVenta: [21, 30], gerente: '', personas: [] },
  { nombre: 'Rocamora', puntoVenta: 35, puntosVenta: [35, 37], gerente: '', personas: [] },
]
const existente = { ref: '7990004', tipo: 'FC', puntoVenta: 21, numero: 4572 } as Comprobante

describe('importarErp', () => {
  it('lee el número de "De 00004570 a 00004570"', () => {
    expect(numeroDesde('De 00004570 a 00004570')).toBe(4570)
  })

  it('agrega las facturas de compañías conocidas en Doc. pendiente y saltea repetidas y particulares', () => {
    const r = importarErp(CSV, [existente], aseguradoras, sucursales, '2026-10-31')
    expect(r.nuevas).toHaveLength(2)
    expect(r.repetidas).toBe(1)
    expect(r.ignoradas).toBe(1)
    const [fc, nc] = r.nuevas
    expect(fc).toMatchObject({ ref: '7990001', sucursal: 'Alvarez Thomas', numero: 4570, aseguradoraId: 'allianz', total: 1210000, estado: 'pendiente_drive' })
    expect(fc.documentos.map((d) => d.estado)).toEqual(['faltante', 'faltante', 'faltante'])
    expect(nc).toMatchObject({ tipo: 'NC', sucursal: 'Rocamora', total: -121000, ncInformada: false })
  })

  it('avisa si el archivo no es la exportación del ERP', () => {
    expect(() => importarErp('a;b;c\n1;2;3', [], aseguradoras, sucursales, '2026-10-31')).toThrow(/formato/)
  })
})

describe('importarCompanias', () => {
  it('completa razón social, CUIT, plazo y correos por CUIT o por nombre', () => {
    const csv = [
      'Compañía,Razón social,CUIT,Plazo,Mail',
      'Allianz,ALLIANZ ARGENTINA COMPAÑIA DE SEGUROS,30500037217,30,"presenta@ejemplo.test; reclama@ejemplo.test"',
      'F. Patronal,FEDERACION PATRONAL SEGUROS SAU,33-70736658-9,7,fp@ejemplo.test',
      'Otra,OTRA S.A.,30999999999,30,otra@ejemplo.test',
    ].join('\n')
    const r = importarCompanias(csv, aseguradoras)
    expect(r.actualizadas).toBe(2)
    expect(r.sinCoincidencia).toBe(1)
    expect(r.aseguradoras[0]).toMatchObject({ email: 'presenta@ejemplo.test', emailReclamos: 'reclama@ejemplo.test' })
    expect(r.aseguradoras[1]).toMatchObject({ razonSocial: 'FEDERACION PATRONAL SEGUROS SAU', plazoPagoDias: 7, email: 'fp@ejemplo.test' })
  })
})
