import type { Comprobante, Documento, DocumentoEnEspera, Sucursal, TipoDocumento } from './tipos'

/**
 * Puntos de venta y números de factura que aparecen en el nombre de un archivo ("35-11032"), los más
 * probables primero:
 *  1) lo que sigue a "FC" o "factura" ("fc 35-11032", "FC 3511032");
 *  2) un par suelto "35-11032" que no sea parte de un número más largo con guiones (un siniestro como
 *     "104-4-102868" no es el punto de venta 104);
 *  3) un número largo pegado ("3511032"), partido donde el comienzo es un punto de venta conocido.
 * Con `puntos` (los puntos de venta de todas las sucursales) se pueden partir los números pegados.
 */
export function numerosDelNombre(nombre: string, puntos: number[] = []): { puntoVenta: number; numero: number }[] {
  const base = nombre.replace(/\.[a-z0-9]+$/i, '')
  const lista: { puntoVenta: number; numero: number }[] = []
  const agregar = (pv: number, numero: number) => {
    if (numero > 0 && !lista.some((x) => x.puntoVenta === pv && x.numero === numero)) lista.push({ puntoVenta: pv, numero })
  }
  const partir = (corrido: string) => {
    for (let i = 1; i < corrido.length && i <= 5; i++) {
      const pv = Number(corrido.slice(0, i))
      if (puntos.includes(pv)) agregar(pv, Number(corrido.slice(i)))
    }
  }
  const leer = (texto: string) => {
    const par = texto.match(/^(\d{1,5})\s*[-_ ./]\s*0*(\d{1,8})$/)
    if (par) agregar(Number(par[1]), Number(par[2]))
    else partir(texto.replace(/\D/g, ''))
  }
  // 1) después de FC o factura
  for (const m of base.matchAll(/(?:\bfce?\b|factura)\s*[:#nº°.]*\s*(\d+(?:\s*[-_ ./]\s*\d+)?)/gi)) leer(m[1])
  // 2) pares sueltos, que no sean parte de un número más largo con guiones (un siniestro)
  for (const m of base.matchAll(/(?<!\d\s*[-_./]\s*)(?<!\d)(\d{1,5})\s*[-_ ]\s*0*(\d{1,8})(?!\d)(?!\s*[-_./]\s*\d)/g)) agregar(Number(m[1]), Number(m[2]))
  // 3) números largos pegados
  for (const m of base.matchAll(/(?<![\d\-_./])\d{6,13}(?![\d\-_./])/g)) partir(m[0])
  return lista
}

/** Todos los puntos de venta de una sucursal. */
export function puntosDeVenta(s: Pick<Sucursal, 'puntoVenta' | 'puntosVenta'>): number[] {
  return s.puntosVenta?.length ? s.puntosVenta : [s.puntoVenta]
}

/**
 * ¿Es el PDF de una factura de hoy (todavía no cargada)? Sí, si el nombre tiene un número con un
 * punto de venta de la sucursal y esa factura no existe todavía en la plataforma.
 */
export function facturaDeHoy(nombre: string, sucursal: Sucursal | undefined, todas: Comprobante[]): { puntoVenta: number; numero: number } | null {
  if (!sucursal) return null
  const pvs = puntosDeVenta(sucursal)
  for (const n of numerosDelNombre(nombre, pvs)) {
    if (!pvs.includes(n.puntoVenta)) continue
    if (todas.some((c) => c.puntoVenta === n.puntoVenta && c.numero === n.numero)) return null
    return n
  }
  return null
}

const normal = (s: string) => s.normalize('NFD').replace(/[̀-ͯ]/g, '').trim().toLowerCase()

/**
 * Al cargar el Excel de Quiter: cada factura nueva toma los PDF en espera con su número (de su sucursal).
 * Devuelve las facturas ya con sus documentos (en revisión) y qué PDF se unieron a cuál.
 */
export function unirEnEspera(
  nuevas: Comprobante[],
  espera: DocumentoEnEspera[],
  hoy: string,
): { comprobantes: Comprobante[]; unidos: { id: string; comprobanteId: string }[] } {
  const unidos: { id: string; comprobanteId: string }[] = []
  const libres = espera.filter((e) => !e.asociado)
  const comprobantes = nuevas.map((c) => {
    if (c.tipo !== 'FC') return c
    const suyos = libres.filter((e) => e.puntoVenta === c.puntoVenta && e.numero === c.numero && normal(e.sucursal) === normal(c.sucursal))
    if (!suyos.length) return c
    const base: Documento[] = c.documentos.length ? c.documentos : (['factura', 'orden'] as TipoDocumento[]).map((t) => ({ tipo: t, estado: 'faltante' }))
    const documentos = base.map((d): Documento => {
      const deEste = suyos.filter((e) => e.tipo === d.tipo || e.tipo === 'documentacion')
      if (!deEste.length) return d
      return {
        tipo: d.tipo,
        estado: 'en_revision',
        archivo: deEste.length > 1 ? `${deEste[0].archivo} (+${deEste.length - 1})` : deEste[0].archivo,
        url: deEste[0].url,
        adjuntos: deEste.length > 1 ? deEste.map((e) => ({ archivo: e.archivo, url: e.url })) : undefined,
        subidoPor: deEste[0].subidoPor,
        fecha: deEste[0].fecha,
        origen: 'varios-automatico',
      }
    })
    suyos.forEach((e) => unidos.push({ id: e.id, comprobanteId: c.id }))
    const primera = [...suyos].sort((a, b) => a.fecha.localeCompare(b.fecha))[0]
    const siniestro = c.siniestro || suyos.find((e) => e.siniestro)?.siniestro || ''
    return {
      ...c,
      documentos,
      siniestro,
      fechaDrive: primera.fecha,
      subidoPor: primera.subidoPor,
      estado: c.estado === 'pendiente_drive' ? 'en_gestion' : c.estado,
      eventos: [
        ...c.eventos,
        {
          fecha: hoy,
          autor: primera.subidoPor,
          area: 'sucursal' as const,
          tipo: 'subida' as const,
          texto: `Subió ${suyos.length === 1 ? 'el PDF' : `${suyos.length} PDF`} antes de que se cargara la factura (${suyos.map((e) => e.nombreOriginal).join(', ')}); se unieron al cargar el Excel de Quiter`,
        },
      ],
    }
  })
  return { comprobantes, unidos }
}

/** Días que lleva esperando un PDF: más de 2 suele ser un número mal tipeado. */
export const DIAS_ESPERA_REVISAR = 2
