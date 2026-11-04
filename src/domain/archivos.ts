/**
 * Carga de varios archivos de una vez: las sucursales escanean muchos documentos juntos. Por el
 * nombre de cada archivo se sugiere a qué factura va y qué documento es; la persona lo revisa
 * antes de subir. La misma regla usa el servidor para la carpeta del Drive (google/Codigo.gs).
 *
 * Nombres que se reconocen (cualquiera sirve, en cualquier orden):
 *  - número de factura: "21-00011032", "21-11032", "FC 21 11032" o solo "11032"
 *  - siniestro, patente o referencia del ERP
 *  - qué es: "factura"/"FC", "orden"/"OR"/"repuestos", "firma"/"conformidad"; si no dice, es todo junto
 */
import type { Comprobante, TipoDocumento } from './tipos'

export type TipoArchivo = TipoDocumento | 'documentacion'

export interface Sugerencia {
  factura: Comprobante | null
  /** por qué se eligió (para mostrarlo): "número", "siniestro", "patente", "referencia" */
  por: string | null
  /** si hay más de una posible, cuáles (la persona elige) */
  candidatas: Comprobante[]
  tipo: TipoArchivo
}

const alfanumerico = (s: string) => s.replace(/[^0-9A-Za-z]/g, '').toUpperCase()

/** Qué documento es, por el nombre. */
export function tipoPorNombre(nombre: string): TipoArchivo {
  const n = ` ${nombre.toLowerCase().replace(/\.[a-z0-9]+$/, '').replace(/[_\-.]+/g, ' ')} `
  const esFirma = /firma|conformidad|conforme|dni/.test(n)
  const esOrden = /orden|\bor\b|\bot\b|repuesto|presupuesto/.test(n)
  const esFactura = /factura|\bfc\b|\bfce\b/.test(n)
  const cuantos = [esFirma, esOrden, esFactura].filter(Boolean).length
  if (cuantos !== 1) return 'documentacion'
  return esFirma ? 'firma' : esOrden ? 'orden' : 'factura'
}

/** A qué factura va, por el nombre. Solo entre las facturas que se le pasan (las de la sucursal). */
export function sugerirFactura(nombre: string, facturas: Comprobante[]): Sugerencia {
  const tipo = tipoPorNombre(nombre)
  const base = nombre.replace(/\.[a-z0-9]+$/i, '')
  const plano = alfanumerico(base)
  const elegir = (lista: Comprobante[], por: string): Sugerencia | null => {
    const unicas = [...new Map(lista.map((c) => [c.id, c])).values()]
    if (unicas.length === 1) return { factura: unicas[0], por, candidatas: [], tipo }
    if (unicas.length > 1) return { factura: null, por: null, candidatas: unicas.slice(0, 8), tipo }
    return null
  }

  // 1) Punto de venta y número juntos: "21-00011032", "21 11032", "FC21-11032"
  const conPv: Comprobante[] = []
  for (const m of base.matchAll(/(\d{1,5})\s*[-_ ]\s*0*(\d{1,8})/g)) {
    const pv = Number(m[1])
    const numero = Number(m[2])
    conPv.push(...facturas.filter((c) => c.puntoVenta === pv && c.numero === numero))
  }
  const r1 = elegir(conPv, 'número')
  if (r1) return r1

  // 2) Referencia del ERP, siniestro o patente dentro del nombre
  const porRef = facturas.filter((c) => c.ref && c.ref.length >= 6 && plano.includes(alfanumerico(c.ref)))
  const r2 = elegir(porRef, 'referencia')
  if (r2) return r2
  const porSiniestro = facturas.filter((c) => {
    const s = alfanumerico(c.siniestro ?? '')
    return s.length >= 6 && plano.includes(s)
  })
  const r3 = elegir(porSiniestro, 'siniestro')
  if (r3) return r3
  const porPatente = facturas.filter((c) => {
    const p = alfanumerico(c.patente ?? '')
    return p.length >= 6 && plano.includes(p)
  })
  const r4 = elegir(porPatente, 'patente')
  if (r4) return r4

  // 3) Solo el número de factura (4 dígitos o más, sin el punto de venta)
  const numeros = [...base.matchAll(/\d{4,8}/g)].map((m) => Number(m[0]))
  const porNumero = facturas.filter((c) => numeros.includes(c.numero))
  const r5 = elegir(porNumero, 'número')
  if (r5) return r5

  return { factura: null, por: null, candidatas: [], tipo }
}

/** Las facturas a las que todavía se les puede subir documentación. */
export function facturasParaCargar(comprobantes: Comprobante[]): Comprobante[] {
  return comprobantes.filter((c) => c.tipo === 'FC' && c.estado !== 'anulada' && c.estado !== 'cobrada')
}
