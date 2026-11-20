/**
 * Carga de varios archivos de una vez: las sucursales escanean muchos documentos juntos. Por el
 * nombre de cada archivo se sugiere a qué factura va y qué documento es; la persona lo revisa
 * antes de subir. La misma regla usa el servidor para la carpeta del Drive (google/Codigo.gs).
 *
 * Nombres que se reconocen (cualquiera sirve, en cualquier orden):
 *  - número de factura: punto de venta y número, con o sin ceros adelante y separados por guion, espacio,
 *    punto o barra: "21-00011032", "21-11032", "0021 11032", "21.11032" (pegado no: podría ser un siniestro)
 *  - siniestro, patente o referencia de Quiter
 *  - qué es: "factura"/"FC" u "orden"/"OR"/"repuestos"/"firma" (la orden firmada); si no dice, son las dos juntas
 */
import type { Comprobante, TipoDocumento } from './tipos'
import { limpiarSiniestro } from './siniestros'
import { numerosDelNombre } from './espera'

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

function marcas(nombre: string) {
  // "20834FC" o "F.C." también valen: se separan los números de las letras y se juntan las siglas
  const n = ` ${nombre
    .toLowerCase()
    .replace(/\.[a-z0-9]+$/, '')
    .replace(/\b([fo])\.\s?([cr])\.?(?=\s|$|[^a-z])/g, '$1$2')
    .replace(/(\d)([a-z])/g, '$1 $2')
    .replace(/([a-z])(\d)/g, '$1 $2')
    .replace(/[_\-.+]+/g, ' ')} `
  // La firma del cliente va en la orden: "orden firmada", "firma" o "conformidad" son la orden
  const esOrden = /orden|\bor\b|\bot\b|repuesto|presupuesto|firma|conformidad|conforme/.test(n)
  // "FC 35-5749" o "factura 35-5749" es el número de la factura, no dice qué documento es
  const esFactura = /factura(?!\s*(n[º°o]?\s*)?\d)|\bfce?\b(?!\s*\d)/.test(n)
  return { esOrden, esFactura }
}

/** Qué documento es, por el nombre ("FC OR" o sin nada: las dos juntas). */
export function tipoPorNombre(nombre: string): TipoArchivo {
  const { esOrden, esFactura } = marcas(nombre)
  if (esOrden === esFactura) return 'documentacion'
  return esOrden ? 'orden' : 'factura'
}

/** ¿El nombre aclara qué es? FC, OR, "FC OR" (las dos) o NC. */
export function aclaraQueEs(nombre: string): boolean {
  const { esOrden, esFactura } = marcas(nombre)
  return esOrden || esFactura || esNotaDeCreditoPorNombre(nombre)
}

/**
 * Las facturas cuyo punto de venta y número aparecen en el nombre, separados ("21-11032",
 * "0021 00011032"). Un número pegado no vale: podría ser un siniestro.
 */
export function facturasEnNombre(nombre: string, facturas: Comprobante[]): Comprobante[] {
  const halladas = numerosDelNombre(nombre).flatMap((n) => facturas.filter((c) => c.puntoVenta === n.puntoVenta && c.numero === n.numero))
  return [...new Map(halladas.map((c) => [c.id, c])).values()]
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

  // 1) Punto de venta y número: "21-00011032", "21 11032", "FC21-11032"
  const r1 = elegir(facturasEnNombre(nombre, facturas), 'número')
  if (r1) return r1

  // 2) Referencia de Quiter, siniestro o patente dentro del nombre
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

/** Número de factura como tiene que ir en el nombre: "35-11032". */
export function numeroParaNombre(c: Pick<Comprobante, 'puntoVenta' | 'numero'>): string {
  return `${c.puntoVenta}-${c.numero}`
}

export type RevisionNombre =
  | { ok: true; factura: Comprobante; tipo: TipoArchivo; /** el siniestro escrito en el nombre ('' si no hay) */ siniestro: string }
  | { ok: false; error: string; tipo: TipoArchivo }

const EJEMPLO = '21-20834 104-4-137055 OR.pdf'
const SIN_ACLARAR = 'Falta aclarar al final qué es: FC, OR o FC OR (las dos juntas). Por ejemplo: 21-20827 4500546 FC OR.pdf'
/** Nombres cortos: las plataformas de las compañías rechazan los nombres largos. */
export const LARGO_MAXIMO_NOMBRE = 40

/**
 * La regla que se exige (no solo se pide): PDF y, en el nombre, el punto de venta y el número de una
 * factura de la sucursal, como figura en la factura ("35-11032"; también se acepta con ceros, "35-00011032"). Así no
 * entra un archivo mal tipeado que después nadie sabe de qué factura es.
 */
/**
 * Formato de los nombres: número de factura, siniestro y al final qué es.
 *   "21-20834 FC" solo la factura (sin siniestro) · "21-20834 104-4-137055 OR" la orden (con siniestro)
 *   "21-20827 4500546" factura y orden juntas (con siniestro) · "21-803 NC" la nota de crédito
 *   "21-803 104-4-54203 OR" la orden de esa NC. La compañía o la patente pueden ir, no molestan.
 * La orden y el archivo con todo junto necesitan el siniestro en el nombre, salvo que la factura ya lo
 * tenga. `pedirSiniestro: false` cuando el documento se elige con un botón (desde la factura).
 */
export function revisarNombre(nombre: string, facturas: Comprobante[], esPdf = /\.pdf$/i.test(nombre), pedirSiniestro = true): RevisionNombre {
  const tipo = tipoPorNombre(nombre)
  if (!esPdf) return { ok: false, tipo, error: 'No es un PDF: solo se aceptan PDF.' }
  const base = nombre.replace(/\.[a-z0-9]+$/i, '')
  if (base.length > LARGO_MAXIMO_NOMBRE) {
    return { ok: false, tipo, error: `El nombre es muy largo (más de ${LARGO_MAXIMO_NOMBRE} caracteres). Alcanza con el número de factura y el siniestro: ${EJEMPLO}` }
  }
  // "NC", "N-C" o "N/C" en el nombre: es el PDF de una nota de crédito (si no, el de una factura)
  const nc = esNotaDeCreditoPorNombre(nombre)
  // (sin "NC" en el nombre se prefiere la factura; si solo hay una NC con ese número, por ejemplo al subir
  // desde la misma NC, va a la NC)
  const todas = facturasEnNombre(nombre, facturas)
  const fcs = todas.filter((c) => c.tipo !== 'NC')
  const ncs = todas.filter((c) => c.tipo === 'NC')
  // con FC al final es la factura; si no dice ni FC ni NC y hay las dos con ese número, hay que aclarar
  if (!nc && tipo !== 'factura' && fcs.length && ncs.length) {
    return { ok: false, tipo, error: `Hay una factura y una nota de crédito con ese número: si es de la nota de crédito, agregar NC al nombre.` }
  }
  const halladas = nc ? ncs : fcs.length ? fcs : ncs
  if (halladas.length === 1) {
    const f = halladas[0]
    // Tiene que decir qué es (desde la factura no: el documento se elige con el botón)
    if (pedirSiniestro && !aclaraQueEs(nombre)) return { ok: false, tipo, error: SIN_ACLARAR }
    // La orden (sola o con la FC) lleva siniestro; "21-803 NC" no
    const llevaSiniestro = f.tipo === 'NC' ? tipo === 'orden' || (tipo === 'documentacion' && marcas(nombre).esOrden) : tipo === 'orden' || tipo === 'documentacion'
    const siniestro = siniestroDelNombre(nombre, f) ?? ''
    if (pedirSiniestro && llevaSiniestro && !siniestro && !f.siniestro) {
      return { ok: false, tipo, error: `Falta el siniestro en el nombre. Por ejemplo: ${EJEMPLO}` }
    }
    return { ok: true, factura: f, tipo: f.tipo === 'NC' ? 'factura' : tipo, siniestro }
  }
  if (halladas.length > 1) {
    return { ok: false, tipo, error: `El nombre coincide con más de una factura (${halladas.map(numeroParaNombre).join(', ')}): dejar solo el número de una.` }
  }
  // el número que más parece de factura (no un siniestro con guiones)
  const n = numerosDelNombre(base)[0]
  if (!n) {
    return { ok: false, tipo, error: `Falta el número de factura con el punto de venta separado por un guion. Por ejemplo: ${EJEMPLO}` }
  }
  return { ok: false, tipo, error: `No hay ninguna ${nc ? 'nota de crédito' : 'factura'} ${n.puntoVenta}-${n.numero} pendiente en la sucursal: conviene revisar el número.` }
}

/** ¿El nombre del archivo dice que es una nota de crédito? "NC 21-803", "N-C 21-803", "N/C", "nota de crédito". */
export function esNotaDeCreditoPorNombre(nombre: string): boolean {
  const n = nombre.replace(/\.[a-z0-9]+$/i, '').replace(/(\d)([a-z])/gi, '$1 $2').replace(/([a-z])(\d)/gi, '$1 $2')
  return /(^|[^a-z0-9])n\s*[-/.]?\s*c\.?([^a-z0-9]|$)|nota\s+de\s+cr/i.test(n)
}

/** Las facturas a las que todavía se les puede subir documentación, y las NC sin su PDF aprobado. */
export function facturasParaCargar(comprobantes: Comprobante[]): Comprobante[] {
  return comprobantes.filter((c) =>
    c.tipo === 'NC' ? !c.documentos.some((d) => d.estado === 'ok' || d.estado === 'en_revision') : c.tipo === 'FC' && c.estado !== 'anulada' && c.estado !== 'cobrada',
  )
}

/**
 * Número de siniestro escrito en el nombre del archivo, además del número de factura:
 * "35-11032 siniestro 22365.pdf" → "22365"; "35-11032 or 029-9-506622.pdf" → "029-9-506622". Se usa para completar el siniestro del
 * legajo, que no se conoce hasta tener la orden. Devuelve null si no hay uno (6 dígitos o más).
 */
export function siniestroDelNombre(nombre: string, c: Pick<Comprobante, 'puntoVenta' | 'numero'>): string | null {
  let base = nombre.replace(/\.[a-z0-9]+$/i, '')
  // se saca el número de factura (con o sin ceros, con cualquier separador o todo junto)
  base = base.replace(new RegExp(`(^|\\D)0*${c.puntoVenta}\\s*[-_ ./]?\\s*0*${c.numero}(?=\\D|$)`), '$1 ')
  // 1) lo que sigue a la palabra siniestro, aunque esté abreviada o mal escrita: "siniestro", "sin.", "stro", "sinestro", "siniesto"
  for (const m of base.matchAll(/([a-záéíóúñ]+)\.?\s*[:#nº°]*\s*([a-z]{0,3}\d[\w\-/.]*)/gi)) {
    if (!esPalabraSiniestro(m[1])) continue
    const valor = m[2].replace(/[.\-/]+$/, '')
    if (valor.replace(/\D/g, '').length >= 4) return limpiarSiniestro(valor)
  }
  // 2) sin la palabra: un número largo aparte del de la factura (no una fecha)
  base = base.replace(/[a-záéíóúñ]+/gi, ' ')
  const candidatos = (base.match(/\d[\d\-/.]*\d/g) ?? []).filter((x) => !/^\d{1,2}[-/.]\d{1,2}[-/.](\d{2}|\d{4})$/.test(x))
  const hallado = candidatos.find((x) => x.replace(/\D/g, '').length >= 5)
  return hallado ? limpiarSiniestro(hallado) : null
}

/** "siniestro" escrito de muchas formas: abreviado (sin, stro, sto, sn, sint) o con una o dos letras de más o de menos. */
export function esPalabraSiniestro(palabra: string): boolean {
  const p = palabra.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '')
  if (['sin', 'sn', 'st', 'sto', 'stro', 'sint', 'sini', 'sinies', 'siniest'].includes(p)) return true
  return p.length >= 6 && p.startsWith('s') && distancia(p, 'siniestro') <= 2
}

function distancia(a: string, b: string): number {
  const d = Array.from({ length: a.length + 1 }, (_, i) => [i, ...Array(b.length).fill(0)])
  for (let j = 1; j <= b.length; j++) d[0][j] = j
  for (let i = 1; i <= a.length; i++)
    for (let j = 1; j <= b.length; j++) d[i][j] = Math.min(d[i - 1][j] + 1, d[i][j - 1] + 1, d[i - 1][j - 1] + (a[i - 1] === b[j - 1] ? 0 : 1))
  return d[a.length][b.length]
}

/**
 * La patente escrita en el nombre del archivo, si está: formato viejo (ABC123) o Mercosur (AB123CD).
 * "sin 123" no cuenta: es la palabra siniestro abreviada.
 */
export function patenteDelNombre(nombre: string): string | null {
  const base = nombre.replace(/\.[a-z0-9]+$/i, '')
  for (const m of base.matchAll(/(?:^|[^a-z0-9])([a-z]{2}\s?\d{3}\s?[a-z]{2}|[a-z]{3}\s?\d{3})(?=[^a-z0-9]|$)/gi)) {
    const letras = m[1].match(/^[a-z]+/i)![0]
    if (esPalabraSiniestro(letras) || /^(fc|or|fac|ord)$/i.test(letras)) continue
    return m[1].replace(/\s/g, '').toUpperCase()
  }
  return null
}
